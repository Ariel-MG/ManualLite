---
title: 'Geometría del anillo en la extensión'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ad1a606253340425a606761ffdcb669fbaf23e90'
context:
  - _bmad-output/implementation-artifacts/epic-manuallite-v2-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Radios, halo y trazos del anillo de click viven dentro de `annotate.ts`, atados a `OffscreenCanvas` y `createImageBitmap`. El MCP no puede reutilizar esa geometría sin APIs de browser.

**Approach:** Extraer `paintClickRing` a un módulo Node-safe en `src/lib`. `annotate.ts` sigue obteniendo el contexto 2D en el service worker y llama esa función. El backend napi-rs queda para 1.4.

## Boundaries & Constraints

**Always:**
- `paintClickRing(ctx, x, y, width, height)` concentra radios, halo `rgba(220, 38, 38, 0.18)`, trazo blanco `rgba(255, 255, 255, 0.9)` y anillo `#dc2626`. Misma fórmula que hoy: `radius = max(16, min(width, height) * 0.025)`; halo `radius * 1.9`; blanco `lineWidth = max(5, radius * 0.28)`; rojo `lineWidth = max(3, radius * 0.18)`.
- El módulo de geometría no importa `OffscreenCanvas`, `createImageBitmap`, `ImageBitmap`, IndexedDB, `downloadBlob` ni `File`.
- `annotate.ts` obtiene bitmap y canvas (`createImageBitmap` + `OffscreenCanvas`), hace `drawImage`, llama `paintClickRing` y `convertToBlob`. Firma de `annotateScreenshot` sin cambio.
- El pipeline de captura (`session.ts`: DPR, `captureVisibleTab`, `addStep`) no cambia. `package.json` de la extensión no depende de `@napi-rs/canvas`.
- Entregado `formatVersion` 1: parse+serialize conservan `app`, `formatVersion`, portada, pasos e imágenes (incl. `screenshot` y `annotated`).

**Never:**
- No cablear `@napi-rs/canvas` ni pintar desde el MCP (eso es 1.4). No polyfillear `OffscreenCanvas` / `createImageBitmap` / `ImageBitmap`.
- No tests golden de PNG idéntico del anillo. No copiar `annotate.ts` entero. No extraer `packages/core`.
- No tocar `pdfLayout.ts`, editor, `projectFile.ts`, `project.ts`, tools MCP ni captura del side panel.
- No commitear el JSON de MBs del entregado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Orden y colores | ctx mock, click (100, 80), canvas 800×600 | Halo fill → stroke blanco → stroke `#dc2626`; radios y `lineWidth` según la fórmula | N/A |
| Radio mínimo | `min(width, height) * 0.025 < 16` | `radius = 16`; halo 30.4 | N/A |
| Radio relativo | canvas 2000×1200 | `radius = 30` (`min * 0.025`) | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/annotate.ts` — Hoy `annotateScreenshot` (L16–56): bitmap, OffscreenCanvas, `drawImage`, geometría inline L30–52, `convertToBlob`. Dejar I/O de canvas del SW; mover L30–52 a `paintClickRing`.
- `src/lib/clickRing.ts` — Crear. Exportar `paintClickRing`. Solo primitivos + `CanvasRenderingContext2D`. Sin APIs de browser.
- `src/background/session.ts` — Único call site: L98–103 escala click × DPR y llama `annotateScreenshot`. No modificar.
- `src/background/session.test.ts` — Mock de `annotateScreenshot`. No exige OffscreenCanvas en Vitest.
- `src/types.ts` — `ClickPoint`. `paintClickRing` no lo importa (números); `annotate.ts` sí.
- `package.json` (raíz) — Sin `@napi-rs/canvas`. `mcp-server/package.json` ya lo tiene; no tocarlo.
- `src/lib/projectFile.ts` / `src/lib/projectFile.test.ts` — Round-trip de 1.1. No modificar. Reusar para NFR4.
- Continuidad 1.2: MCP ya importa `projectFile.ts`. No anillo ni napi-rs en esta story.
- `/Users/arielmg/Documents/Gitlab/odoo-docker/Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.manuallite.json` — Entrega real (8 screenshot + 8 annotated). No commitear.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/clickRing.ts` -- `paintClickRing` con la geometría actual (radios, halo, trazos, colores). -- FR5
- [x] `src/lib/annotate.ts` -- Backend SW: OffscreenCanvas + createImageBitmap + drawImage; llamar `paintClickRing`. -- FR6
- [x] `src/lib/clickRing.test.ts` -- Cubrir la matriz I/O con ctx mock (secuencia, colores, radios). Sin PNG golden. -- NFR6

**Acceptance Criteria:**
- Given `annotate.ts` dibuja el anillo contra OffscreenCanvas, when se extrae `paintClickRing(ctx, …)`, then radios, halo, trazo blanco y `#dc2626` viven solo ahí, and `annotate.ts` obtiene el contexto con OffscreenCanvas + createImageBitmap y llama esa función, and esas APIs no se importan desde el módulo de geometría.
- Given la extensión tras el cambio, when se graba un click con el side panel, then el paso sale anotado como hoy, the pipeline de captura no cambia, and `package.json` de la extensión no depende de `@napi-rs/canvas`.
- Given un `.manuallite.json` ya entregado con `screenshot` y `annotated`, when se parsea y se serializa, then el archivo no requiere migración y las imágenes se conservan, and no se rediseña el editor.

## Implementation Notes

- `paintClickRing` en `src/lib/clickRing.ts`. `annotate.ts` hace `createImageBitmap` + `OffscreenCanvas` + `drawImage` y llama esa función. Assertion `as unknown as CanvasRenderingContext2D` porque el ctx de OffscreenCanvas no es asignable.
- `bun run test`: 35/35, 3/3 de `clickRing.test.ts` (orden/colores 800×600, radio mínimo 16/halo 30.4, radio relativo 30). `bun run typecheck` ok.
- `clickRing.ts` sin OffscreenCanvas/createImageBitmap/ImageBitmap/indexedDB/downloadBlob/File. Raíz sin `@napi-rs/canvas`. `session.ts` sin diff.
- Entregado factura-cliente: parse→serialize conserva `app`, `formatVersion`, portada, 14 pasos y 16 dataURL (8 screenshot + 8 annotated).
- No se grabó un click en Chrome; el pipeline de captura no cambió.
- Review patch: `src/lib/annotate.test.ts` stubbea `createImageBitmap` y `OffscreenCanvas` y afirma `drawImage` + anillo en el click. Suite 36/36.

## Spec Change Log

## Review Triage Log

- `false` — Blind: `CanvasRenderingContext2D` obliga a `as unknown as` y no es agnóstico. El contrato de AD-7 es esa función; Design Notes aceptan el assertion. `clickRing.ts` no importa OffscreenCanvas ni otras APIs de browser.
- `false` — Blind: 800×600 duplica el radio mínimo y falta portrait. La fila 1 afirma orden y colores, no un radio distinto; `min(800,600)*0.025=15` → 16 está en la fórmula. La fila 3 cubre radio 30. `Math.min(width, height)` está en el extracto; portrait no es fila de la matriz.
- `false` — Blind: tests recomputan la fórmula y el radio mínimo no cubre `lineWidth`. En radio 16 el primer test afirma `lineWidth` 5 y 3 y los colores. Las filas 2 y 3 clavan 16 / 30.4 / 30 / 57; un cambio solo en producción las rompe.
- `medium` — Blind: nada prueba que `annotateScreenshot` llame `paintClickRing` con bitmap y click. `session.test.ts` mockea `annotateScreenshot`; borrar la llamada deja la suite verde.
- `false` — Blind: no hay `save`/`restore`. Tras el anillo, `annotate.ts` solo hace `convertToBlob`. El código original mutaba igual. Un ctx compartido es 1.4.
- `false` — Blind: comentarios del halo no se movieron. El spec no los exige; `clickRing.ts` ya documenta radios/halo/trazos.
- `false` — Blind: no se grabó el side panel y el entregado solo está en notas. Parse→serialize del factura-cliente se corrió (14 pasos, 16 dataURL). `session.ts` sin diff; el chequeo visual no es un defecto del extracto. El arreglo sería editar la spec o abrir Chrome.
- `false` — Blind: Code Map desactualizado y logs vacíos. El arreglo es editar la spec de este build.
- `medium` — VG: `annotateScreenshot` puede omitir el anillo y `bun run test` sigue verde. `clickRing.test.ts` llama el helper directo; `session.test.ts` stubbea `annotateScreenshot`. Pre-verificado.

## Design Notes

`paintClickRing` recibe `width`/`height` del canvas (no un radio ya calculado) para que 1.4 no duplique la fórmula. `drawImage` y `convertToBlob` se quedan en `annotate.ts`: no son geometría.

Vitest/jsdom no garantiza OffscreenCanvas. Los tests del anillo graban llamadas al ctx; no pintan PNG. Si TypeScript no asigna `OffscreenCanvasRenderingContext2D` a `CanvasRenderingContext2D`, un assertion en `annotate.ts` es aceptable.

## Verification

**Commands:**
- `bun run test` -- verde, incluida la matriz de `clickRing.test.ts`.
- `bun run typecheck` -- sin errores.
- `rg -n "OffscreenCanvas|createImageBitmap|ImageBitmap|indexedDB|downloadBlob" src/lib/clickRing.ts` -- cero matches; tampoco import de `File` como valor.
- `rg -n "@napi-rs/canvas" package.json` -- cero matches.

**Manual checks (if no CLI):**
- Parse + serialize del entregado factura-cliente: se conservan `app`, `formatVersion`, portada, 14 pasos y las 16 dataURL (`screenshot` + `annotated`).
- Side panel: grabar un click; el paso sale con anillo (halo, blanco, `#dc2626`) en el punto. Pausar/reanudar/exportar sin cambio de UI ni de `pdfLayout`.
