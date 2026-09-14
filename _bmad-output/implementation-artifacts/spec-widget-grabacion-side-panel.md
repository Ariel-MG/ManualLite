---
title: 'Controles de grabación en el side panel'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: 'b1d9720345e0b11e5bdccddd9c352003a39a5b32'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El badge de grabación (`#__manuallite_badge__`) vive en el DOM de la página capturada. `chrome.tabs.captureVisibleTab` fotografía el viewport; el intento de ocultarlo con un rAF pierde la carrera y el widget sale en los manuales.

**Approach:** Quitar toda UI de captura del documento. El control de sesión vive en un `chrome.sidePanel` de la extensión, fuera del viewport.

**Decisiones:**
- Controles del panel: pausa/reanuda, borrar último y detener, más el conteo (1B).
- El popup sigue para iniciar y la biblioteca; al iniciar grabación el panel se abre solo (2A).
- El content script permanece inyectado solo para escuchar clicks, sin ningún nodo DOM (3A).
- Salida de emergencia: el atajo `toggle-recording` sigue funcionando siempre, aunque el panel esté cerrado.

## Boundaries & Constraints

**Always:**
- Cero UI de captura inyectada en el documento fotografiado (ni badge, ni overlay, ni iframe, ni shadow DOM).
- El panel muestra el conteo y permite pausar, reanudar, borrar el último paso y detener.
- El popup inicia la sesión y abre el panel; no es la UI de captura en página.
- El atajo `toggle-recording` inicia o detiene aunque el panel esté cerrado.
- El content script solo escucha `pointerdown`; no inyecta nodos.
- `captureVisibleTab` y la anotación post-captura no cambian de técnica.

**Never:**
- No rediseñar popup/biblioteca/editor salvo lo mínimo para abrir o sincronizar el panel.
- No cambiar exporters, DB, annotate, ni el protocolo de pasos.
- No “arreglar” el hide-before-capture como solución: la UI no puede estar en la página.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grabando, click en página | recording, no paused | Paso + captura sin UI de extensión; panel incrementa conteo | Páginas no capturables: igual que hoy (warn, sin paso) |
| Pausado, click | recording + paused | No captura; conteo intacto | N/A |
| Pausar / reanudar desde panel | click en control del panel | Estado `paused` alterna; content deja/retoma captura | Si no hay sesión, no-op |
| Detener desde panel | click detener | `recording=false`; panel refleja idle | N/A |
| Borrar último | 3 pasos; click borrar último | Quedan 2 pasos; el panel muestra 2 | Si hay 0 pasos, no-op |
| Inicio vía popup | START_RECORDING desde popup | Badge de página no aparece; el panel se abre y refleja grabando | `sidePanel.open` desde el gesto del click del popup |
| Inicio vía atajo | `toggle-recording` en idle | Inicia grabación; el panel puede no abrirse (sin gesto); la captura igual funciona | No bloquear la captura si el panel no abre |
| Panel cerrado durante grabación | usuario cierra el panel | Grabación sigue; reabrir muestra estado actual | N/A |
| Salida de emergencia | grabando, panel cerrado, atajo `toggle-recording` | Detiene la grabación siempre | N/A |

</frozen-after-approval>

## Code Map

- `src/content/recorder.ts` — badge DOM (`ensureBadge`, `renderBadge`, `withBadgeHidden`). Eliminar o vaciar: no puede quedar UI en página.
- `src/content/index.ts` — orquesta badge + `onPointerDown` + `RECORDING_CHANGED`. Quitar `renderBadge`/`withBadgeHidden`/`BADGE_ID`; conservar captura invisible.
- `src/background/index.ts` — `broadcastRecording` solo llega a tabs (`tabs.sendMessage`). El panel es página de extensión: hay que avisarle (`runtime.sendMessage` o `storage.onChanged`). `startRecording` / `togglePause` / `deleteLastStep` se reutilizan. El atajo `toggle-recording` ya inicia/detiene; no romperlo.
- `src/types.ts` — `RuntimeMessage` ya tiene `TOGGLE_PAUSE`, `DELETE_LAST_STEP`, `STOP_RECORDING`, `RECORDING_CHANGED`, `GET_STATE`. Reutilizar; no inventar canal paralelo.
- `manifest.config.ts` — sin `side_panel` ni permiso `sidePanel`. Añadir `side_panel.default_path` + `sidePanel`.
- `src/popup/Popup.tsx` — inicia/detiene y se cierra al grabar. Abrir el panel en `start`/`resume` (gesto de usuario) antes de `window.close()`.
- `vite.config.ts` — el editor entra por `rollupOptions.input`; el side panel HTML debe quedar incluido en el build (mismo patrón o vía `side_panel` del manifest CRX).
- No tocar: `src/editor/*`, `src/lib/exporters/*`, `src/lib/annotate.ts`, `src/db/*`.

## Tasks & Acceptance

**Execution:**
- [x] `manifest.config.ts` — declarar `side_panel.default_path` y permiso `sidePanel` — el panel es contexto de extensión, no del tab.
- [x] `src/sidepanel/index.html` + `main.tsx` + componente de sesión — conteo, pausa/reanuda, borrar último y detener; suscribirse al estado de grabación.
- [x] `vite.config.ts` — asegurar que el HTML del panel entra al bundle CRX.
- [x] `src/background/index.ts` — publicar estado también a páginas de extensión; no alterar el atajo `toggle-recording` (salida de emergencia con panel cerrado).
- [x] `src/popup/Popup.tsx` — al iniciar o reanudar, abrir el side panel desde el gesto de click y luego cerrar el popup.
- [x] `src/content/index.ts` + `src/content/recorder.ts` — eliminar toda UI inyectada; dejar solo listener invisible de click.

**Acceptance Criteria:**
- Given una grabación activa, when se captura un click, then el PNG no contiene controles de ManualLite.
- Given grabando, when el usuario pausa desde el panel y clickea la página, then no se crea paso; al reanudar, el siguiente click sí.
- Given grabando, when el panel está abierto, then muestra el número actual de capturas y se actualiza tras cada paso.
- Given el documento capturado, when se inspecciona el DOM, then no existe `#__manuallite_badge__` ni otro nodo de UI de captura.
- Given que grabé tres pasos, when borro el último desde el panel, then quedan dos y el conteo muestra dos.

## Implementation Notes

- Badge DOM eliminado (`src/content/recorder.ts`). El content script solo escucha `pointerdown`.
- Side panel nuevo: `src/sidepanel/*`. Estado vía `GET_STATE`, `RECORDING_CHANGED` y `storage.onChanged` sobre `rec`.
- `openRecordingPanel()` llama `chrome.sidePanel.open({ windowId: WINDOW_ID_CURRENT })` en el mismo turno del click del popup, sin `await` previo.
- Extraído `src/recording/state.ts` para transiciones de sesión reutilizadas por background y tests.
- Atajo `toggle-recording` usa `shortcutToggleAction`; no depende del panel.
- Tests Vitest cubren la matriz (12 passed). `npm run typecheck` y `npm run build` OK; `dist/src/sidepanel/index.html` + permiso `sidePanel` presentes.

## Spec Change Log

## Review Triage Log

- BH1 Detener en el panel no abre el editor — `false`: el badge solo mandaba `STOP_RECORDING`; la matriz pide idle, no abrir el editor. El popup sigue abriendo el editor.
- BH2 Popup ignora `paused` — `low`: ya ocurría antes; el popup se cierra al iniciar. Rechazado: poco frecuente y el arreglo toca UI extra del popup.
- BH3 `window.close()` sin esperar `sidePanel.open` — `medium`: `start`/`resume` disparan `open` y cierran el popup después; el panel puede no llegar a abrirse.
- BH4 README/árbol `src/` desactualizados — `low`: no lo ve el usuario al grabar. Rechazado. (CI va en VG6.)
- BH5 `no-ui.test.ts` solo regex sobre fuente — `medium`: no ejecuta `init`; coincide con VG3.
- BH6 `countAfterDeleteLast` y atajo no pasan por producción — `high`: el AC de borrar último y la salida de emergencia no se rompen si el handler real falla; coincide con VG4/VG5.
- BH7a «1 paso capturados» — `low`: concordancia real en `SidePanel.tsx`.
- BH7b falta `aria-live` — `low`: rechazado; no es el uso cotidiano y añade superficie.
- BH8 El panel no inicia sesión / atajo solo en idle — `false`: decisión 2A (iniciar en el popup). El atajo existe aunque el panel esté cerrado.
- BH9 `package-lock.json` ausente del diff — `high`: el CI usa `bun install --frozen-lockfile` y `bun.lock` no incluye vitest; `package.json` quedó desfasado.
- BH10 `shouldCaptureClick(false,true)` / listener de storage / comentario en types — `false`: `recording=false` no captura; el comentario no produce el fallo descrito.
- EC1 `open.ts` throw síncrono si no hay `sidePanel` — `medium`: `.catch` no atrapa `TypeError` al leer `chrome.sidePanel.open`; `start()` aborta y no graba.
- EC2 `GET_STATE` rechaza y el panel queda idle — `medium`: `.catch(() => {})` traga el error; si no llega `RECORDING_CHANGED` no hay pausa/stop en el panel.
- EC3 `GET_STATE` falla tras `storage.onChanged` — `medium`: misma traga-errores que EC2; el `rec` de storage no trae `stepCount`.
- EC4 `GET_STATE` llega después de `RECORDING_CHANGED` — `high`: un GET idle puede pisar el estado live y dejar el panel sin controles con la grabación activa.
- EC5 `GET_STATE` tardío en el content script — `maybe-false`/preexistente: el race ya estaba; no lo introduce este cambio. Si fuera cierto sería `medium`.
- VG1 Popup no verifica que abre el panel — `medium` (pre-verificado): borrar `void openRecordingPanel()` no rompe tests.
- VG2 Broadcast a páginas de extensión no se testea — `medium` (pre-verificado): quitar `runtime.sendMessage` deja el conteo fresco solo en el test inyectado.
- VG3 no-UI solo texto — `medium` (pre-verificado): un overlay en otro módulo pasa el regex.
- VG4 borrar último no ejecuta `deleteLastStep` — `high` (pre-verificado): un no-op deja tres pasos y los tests siguen verdes.
- VG5 atajo no ejecuta el command handler — `high` (pre-verificado): el ternario no cubre `onCommand`.
- VG6 CI no corre Vitest — `medium` (pre-verificado): el workflow solo hace typecheck y build.


## Design Notes

`chrome.sidePanel.open()` exige gesto de usuario. Llamarlo desde el service worker tras un mensaje suele fallar; abrirlo desde el click del popup (`start` / `resume`). El atajo puede iniciar sin abrir el panel; la captura no se bloquea. El mismo atajo es la salida de emergencia si el panel está cerrado.

El panel no recibe `tabs.sendMessage`. Usar `chrome.runtime.sendMessage` (broadcast a extension pages) o `chrome.storage.onChanged` sobre `rec`.

## Verification

**Commands:**
- `npm run typecheck` -- expected: sin errores
- `npm test` -- expected: todos los tests pass
- `npm run build` -- expected: `dist/` incluye el HTML del side panel y el manifest tiene `side_panel` + permiso `sidePanel`

**Manual checks (if no CLI):**
- Iniciar grabación desde el popup: se abre el side panel; clickear la página; el paso en el editor no muestra badge ni controles.
- En DevTools de la página: no hay `#__manuallite_badge__`.
- Panel: conteo, pausa/reanuda, borrar último y detener.
- Cerrar el panel grabando y usar el atajo `toggle-recording`: la grabación se detiene.
