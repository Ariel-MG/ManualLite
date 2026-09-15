---
title: 'Backend de anillo del MCP con napi-rs'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '6935b771771c8134da9ba137ca566bba379ff3ba'
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El MCP aún no pinta el anillo. `@napi-rs/canvas` 1.0.9 está en `mcp-server/` sin uso; `paintClickRing` vive en el núcleo y solo lo llama la extensión. CAP-3 no puede anotar sin copiar geometría o polyfillear `OffscreenCanvas`.

**Approach:** Un módulo en `mcp-server/` obtiene el contexto 2D con `createCanvas` / `loadImage`, llama `paintClickRing` y exporta PNG. No hay tools de crear/anotar/persistir.

## Boundaries & Constraints

**Always:**
- Backend: `loadImage` + `createCanvas` + `paintClickRing` + `encode('png')` de `@napi-rs/canvas` 1.0.9, con `bun run`. Misma geometría que 1.3 (radios, halo `rgba(220, 38, 38, 0.18)`, blanco `rgba(255, 255, 255, 0.9)`, anillo `#dc2626`).
- Paridad visual con el `annotated` de la extensión, no PNG byte-igual. La línea central del anillo es `#dc2626`.
- Las cuatro tools de revisión siguen igual. Parse + serialize de un `.manuallite.json` entregado (`formatVersion` 1) conservan `app`, `formatVersion`, portada, pasos e imágenes.
- El `package.json` de la extensión no depende de `@napi-rs/canvas`. `paintClickRing` no se reimplementa.

**Never:**
- No polyfillear `OffscreenCanvas`, `createImageBitmap` ni `ImageBitmap`. `Bun.Image` no es backend de dibujo.
- No tools MCP de crear/anotar/persistir (CAP-3). No copiar `annotate.ts`. No extraer `packages/core`.
- No tests golden de PNG idéntico. No umbral de media 0.71/canal como gate (es observación de AD-7, no criterio).
- No tocar `pdfLayout.ts`, editor, `clickRing.ts`, `annotate.ts` de la extensión, `projectFile.ts` ni captura del side panel.
- No commitear el JSON de MBs del entregado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pintar | PNG + `clickOnImage` (x, y) | PNG con halo → stroke blanco → stroke `#dc2626`; radios/`lineWidth` de `paintClickRing` | Buffer ilegible: error de `loadImage` |
| Línea central | Canvas sintético, click conocido | Pixel sobre el radio del anillo ≈ `#dc2626` (antialias Skia; no Buffer igual al de Chrome) | N/A |
| Imagen inválida | Bytes que no son imagen | No hay PNG anotado | Error al cargar |

</frozen-after-approval>

## Code Map

- `src/lib/clickRing.ts` — Reusar `paintClickRing(ctx, x, y, width, height)`. No modificar.
- `mcp-server/src/annotate.ts` — Crear. `loadImage` + `createCanvas` + `drawImage` + `paintClickRing` + `encode('png')`. Import relativo `../../src/lib/clickRing.js`. Assertion `as unknown as CanvasRenderingContext2D` si el ctx de Skia no asigna (igual que `annotate.ts` del SW).
- `mcp-server/src/annotate.test.ts` — Crear. Matriz I/O: PNG sintético (no 1×1; cabe `radius` 16); muestrear píxel del anillo rojo. Sin golden. Sin el JSON entregado en CI.
- `mcp-server/src/manual.ts` / `mcp-server/src/manual.test.ts` — Round-trip y tools de revisión de 1.2. No cambiar contrato. Reusar fixture compacta para NFR4.
- `mcp-server/src/tools.ts` — Las cuatro tools. No añadir handlers ni imports del backend.
- `mcp-server/package.json` — `@napi-rs/canvas` `^1.0.9` ya está. Ampliar `"test"` para incluir `annotate.test.ts` (hoy solo `src/manual.test.ts`).
- `mcp-server/tsconfig.json` — `lib: ["ES2022"]`. Si `tsc` falla por `CanvasRenderingContext2D`, añadir `DOM` (solo tipos; no es polyfill).
- `package.json` (raíz) — Sin `@napi-rs/canvas`. No tocarlo salvo que un test raíz lo importe (no debe).
- `src/lib/annotate.ts` — Backend SW. No llamar desde Bun. No modificar.
- Continuidad 1.3: fórmula y colores ya en `paintClickRing`. Continuidad 1.2: `decodeDataUrl` para pasar dataURL → `Buffer` en pruebas manuales.
- `/Users/arielmg/Documents/Gitlab/odoo-docker/Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.manuallite.json` — Entrega real. Paso con `screenshot` + `clickOnImage` + `annotated`. No commitear.

## Tasks & Acceptance

**Execution:**
- [x] `mcp-server/src/annotate.ts` -- Backend napi: loadImage, createCanvas, paintClickRing, encode PNG. -- FR7
- [x] `mcp-server/src/annotate.test.ts` -- Cubrir la matriz I/O (línea `#dc2626`, error de imagen). Sin PNG golden. -- NFR6
- [x] `mcp-server/package.json` -- Script `test` corre también `annotate.test.ts`. -- Matriz en CI/local
- [x] `mcp-server/tsconfig.json` -- Typecheck del import de `clickRing.ts` (DOM solo si hace falta). -- typecheck MCP

**Acceptance Criteria:**
- Given `paintClickRing` y `@napi-rs/canvas` 1.0.9 en `mcp-server/`, when el MCP obtiene un contexto 2D con `createCanvas` / `loadImage` y llama esa función, then el anillo usa la misma geometría que la extensión, and no se polyfillean `OffscreenCanvas` / `createImageBitmap` / `ImageBitmap`, and no se añaden tools de crear/anotar/persistir.
- Given una captura sin anotar y el `clickOnImage` de un `.manuallite.json` ya entregado, when se pinta el anillo con el backend del MCP, then el resultado coincide a la vista con el `annotated` de la extensión, and no se exige PNG byte-igual, and la línea central es `#dc2626`.
- Given las tools de revisión, when se listan, cargan y corrigen manuales ya entregados, then siguen funcionando, parse+serialize conservan portada/pasos/imágenes, and la extensión no depende de `@napi-rs/canvas`.

## Implementation Notes

- `annotateScreenshot` en `mcp-server/src/annotate.ts`: `loadImage` + `createCanvas` + `drawImage` + `paintClickRing` + `encode('png')`. Import `../../src/lib/clickRing.js`. Assertion `as unknown as CanvasRenderingContext2D` para el ctx de Skia.
- `tsc` exigió `"DOM"` en `mcp-server/tsconfig.json` (solo tipos). Script `test` corre `manual.test.ts` y `annotate.test.ts`.
- `cd mcp-server && bun run test`: 10/10 (2 de annotate: halo/blanco/`#dc2626` en PNG 120×80, bytes inválidos; 8 de 1.2). `typecheck` ok. Extensión: 36/36. Raíz sin `@napi-rs/canvas`. `mcp-server/src` sin OffscreenCanvas/createImageBitmap/ImageBitmap. Siguen 4 tools.
- Entregado factura-cliente: parse→serialize conserva `app`, `formatVersion` 1, portada, 14 pasos y 16 dataURL. Paso «Abrir Contabilidad»: recorte MCP vs `annotated` no byte-igual; pixel sobre el radio = `220,38,38`.
- Review patch: `Number.isFinite` antes de `paintClickRing`. Test 800×800 click (200, 150) radio 20; NaN/Infinity lanzan. `bun test` MCP 12/12.

## Spec Change Log

## Review Triage Log

- `false` — Blind: falta pegamento dataURL↔Buffer. El helper es PNG `Buffer` de propósito; `decodeDataUrl` + `Buffer.from` es el hop documentado para el entregado. CAP-3 queda fuera del intent.
- `low` — Blind: `ClickOnImage` duplica `ClickPoint`. `src/types.ts` es el modelo de la extensión con `Blob`; el MCP no debe importarlo. `{x,y}` local coincide con `paintClickRing`. Rechazado: el arreglo acopla tipos de browser.
- `low` — Blind: `"DOM"` legaliza `OffscreenCanvas` en `tsc`. Design Notes ya aceptan DOM solo como tipos; en runtime no hay polyfill (`rg` cero). Rechazado: un tipo mínimo añade complejidad.
- `low` — Blind: `annotate.test.ts` está en `exclude` de `tsc`. Igual que 1.2; `bun test` ya corre el archivo. Rechazado: haría falta `@types/bun` o un segundo tsconfig.
- `low` — Blind: el test copia la fórmula del radio. Igual que `clickRing.test.ts`. Rechazado: extraer el radio del núcleo no está en el intent.
- `false` — Blind: el sample blanco en `radius+1` sigue en el trazo rojo. Sin el stroke blanco, G/B no suben `+40`; el assert no es vacuo.
- `false` — Blind: faltan clicks fraccionarios, borde, buffers vacíos. El entregado con `788.1484375` pintó `#dc2626`. Vacío/ilegible lo cubre `rejects.toThrow`. Fuera de lienzo es recorte de canvas (hallazgo EC).
- `low` — Blind: no se afirma width/height de salida. `createCanvas(image.width, height)` conserva el tamaño en 120×80 y en 1440×900. Rechazado: un `expect` extra no cambia el backend.
- `low` — Blind: `toThrow()` sin mensaje. `loadImage` es la primera llamada; acoplar el texto de napi es complejidad. Rechazado.
- `false` — Blind: el script lista archivos en vez de `bun test`. Corre `manual.test.ts` y `annotate.test.ts`; no hay un tercer test que se quede fuera. El listado es el patrón de 1.2 (sin `bunfig.toml`).
- `false` — Blind: path absoluto del factura-cliente en el Code Map. El arreglo sería editar la spec de este build.
- `false` — Blind: no hay guarda si `getContext` es null. En napi, `getContext('2d')` devuelve contexto; la guarda de `annotate.ts` es de OffscreenCanvas.
- `false` — Blind: no se reexporta desde `index.ts`. El intent prohíbe tools; el módulo es la superficie para CAP-3.
- `false` — Blind: Spec Change Log vacío pese a DOM. El Code Map ya autorizaba DOM; Implementation Notes lo registran. El arreglo sería editar la spec.
- `medium` — Edge: `NaN`/`Infinity` en el click abortan el proceso (Skia `unwrap` en `sk.rs`, exit 134). El backend exportado es el entregable; un caller futuro mata el MCP.
- `false` — Edge: `clickOnImage` null/undefined lanza TypeError. El tipo exige el objeto; el TypeError es el fallo ruidoso correcto.
- `false` — Edge: click fuera del lienzo devuelve PNG idéntico. `paintClickRing` pinta fuera y Skia recorta; no es un caso de archivo entregado.
- `maybe-false` — Edge: imagen 0×0 → canvas 350×150. `createCanvas(0,0)` sí defaulta; no se demostró que `loadImage` devuelva 0. Si fuera cierto sería `low`. Rechazado.
- `medium` — VG: el único click del test es el centro (60, 40). Ignorar `clickOnImage` y pintar en `width/2,height/2` deja la suite verde. Los clicks reales no están centrados.
- `medium` — VG: 120×80 siempre cae al radio 16. Pasar 1×1 a `paintClickRing` no rompe el test; en 1440×900 el radio correcto es 22.5.

## Design Notes

El backend napi vive en `mcp-server/`, no en `src/lib`: la extensión no puede cargar addons N-API. Añadir `"DOM"` al `lib` de `tsc` solo declara tipos; no polyfillea APIs de browser.

Tests automáticos pintan un PNG sintético y muestrean el anillo. La media ≈ 0.71/canal es la observación de AD-7, no un assert. El entregado factura-cliente se verifica a mano (vista vs `annotated` + round-trip), igual que 1.1–1.3.

## Verification

**Commands:**
- `cd mcp-server && bun test` -- verde, incluida la matriz de `annotate.test.ts` y `manual.test.ts`.
- `cd mcp-server && bun run typecheck` -- sin errores.
- `bun run test` -- extensión verde; no importa `@napi-rs/canvas`.
- `rg -n "@napi-rs/canvas" package.json` -- cero matches en la raíz.
- `rg -n "OffscreenCanvas|createImageBitmap|ImageBitmap" mcp-server` -- cero matches (tampoco polyfill).
- `rg -n "server.tool" mcp-server/src/tools.ts` -- siguen las cuatro tools de revisión.

**Manual checks (if no CLI):**
- Pintar el `screenshot` + `clickOnImage` de un paso del factura-cliente; a la vista coincide con su `annotated` (halo, blanco, `#dc2626` en el click). No comparar Buffers.
- Parse + serialize del mismo entregado: se conservan `app`, `formatVersion`, portada, 14 pasos y las 16 dataURL.
