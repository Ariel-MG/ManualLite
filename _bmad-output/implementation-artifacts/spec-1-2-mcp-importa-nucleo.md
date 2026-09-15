---
title: 'El MCP importa el núcleo y deja el espejo'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '14387cc63448ed58747579988c6bc0c2c064fd4c'
context:
  - _bmad-output/implementation-artifacts/epic-manuallite-v2-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El MCP valida `.manuallite.json` con un Zod espejo en `mcp-server/src/schema.ts`, y `scripts/export-pdf.ts` parsea a mano. El formato vive duplicado.

**Approach:** Carga, validación y guardado del MCP, y el parse del PDF headless, importan `parseProjectFile` / `serializeProjectFile` de `src/lib/projectFile.ts`. Se elimina `schema.ts`. Las tools de revisión no cambian de contrato.

## Boundaries & Constraints

**Always:**
- Import relativo a `src/lib/projectFile.ts`. Validar es el núcleo (`app` + `steps` array). Zod no modela el archivo; se queda solo en parámetros de tools.
- `mcp-server/src/schema.ts` se elimina. En `mcp-server/` no queda ninguna definición de `ProjectFile`.
- `loadProject` envuelve I/O (`No se pudo leer el archivo: …`) y JSON inválido (`El archivo no es JSON válido: …`). Formato inválido: mensaje del núcleo, sin dump Zod.
- `saveProject` usa `serializeProjectFile`. Corregir caption/description no altera dataURL.
- Entregado `formatVersion` 1: parse+serialize conservan `app`, `formatVersion`, portada, pasos e imágenes (igualdad de campos).
- Las cuatro tools de revisión siguen sirviendo. El PDF sale por `scripts/export-pdf.ts`.

**Never:**
- No extraer `packages/core`. No meter Zod en el núcleo. No tools de creación (CAP-3). No anillo ni `@napi-rs/canvas` (1.3/1.4).
- No cambiar nombres, argumentos ni `defaultRevisedPath` de las tools. No tocar `decodeDataUrl`, `project.ts`, `annotate.ts`, captura, editor ni `pdfLayout.ts`.
- No commitear el JSON de MBs del entregado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load válido | Fixture compacta v1 (portada + paso con dataURL + sección) | Mismos campos | N/A |
| Load inválido | `app` distinto o `steps` no array | No hay proyecto | `El archivo no es un proyecto válido de ManualLite.` |
| JSON roto | Texto no JSON | No hay proyecto | `El archivo no es JSON válido: <path>` |
| Corrección | Load → cambiar `caption` → save → load | Caption nuevo; dataURL idénticos | N/A |
| list | Dir con un válido y un inválido | Solo el válido | Inválido ignorado |
| Round-trip | parse → serialize | Igualdad de campos | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/projectFile.ts` — Reusar `parseProjectFile`, `serializeProjectFile`, tipo `ProjectFile`. No modificar (1.1).
- `mcp-server/src/manual.ts` — Único consumidor de `schema.ts`. `loadProject`: `readFile` + `JSON.parse` + `ProjectFileSchema.safeParse` → `parseProjectFile(raw)`. `saveProject`: `JSON.stringify` → `serializeProjectFile`. `listManuals` / `defaultRevisedPath` / `decodeDataUrl` sin cambio de contrato.
- `mcp-server/src/schema.ts` — Espejo Zod. Borrar. Nadie más importa `FORMAT`/`ProjectFile` de ahí.
- `mcp-server/src/tools.ts` — Las cuatro tools delegan en `manual.ts`. No cambiar handlers.
- `mcp-server/tsconfig.json` — `include: ["src"]` sin paths al padre. Resolver `../../src/lib/projectFile.ts`. Si `tsc` falla por `Blob` en `src/types.ts`, `lib` DOM es solo tipos.
- `mcp-server/package.json` — `zod` se queda. Añadir `"test": "bun test"` si falta.
- `mcp-server/README.md` — L70–71 documentan el espejo; apuntar al núcleo.
- `scripts/export-pdf.ts` — L20–24 parse ad-hoc. Sustituir por `parseProjectFile`. No tocar `buildPdfDoc` ni `pdfLayout.ts`.
- Continuidad 1.1: fixture PNG 1×1 en tests; verificación del entregado `.../crear-factura-cliente.manuallite.json` y PDF `crear-factura-cliente.pdf.pdf`.

## Tasks & Acceptance

**Execution:**
- [x] `mcp-server/src/manual.ts` -- Parse/serialize/tipo del núcleo; conservar envoltorios I/O y JSON inválido. -- FR3
- [x] `mcp-server/src/schema.ts` -- Eliminar. -- Sin `ProjectFile` en el servidor
- [x] `mcp-server/tsconfig.json` -- Typecheck del import relativo (include/paths; DOM solo si `Blob` lo exige). -- typecheck MCP
- [x] `mcp-server/src/manual.test.ts` -- Matriz I/O con fixture compacta v1 en temp dir. -- NFR2/NFR4
- [x] `mcp-server/package.json` -- Script `test`: `bun test` si hace falta. -- Correr la matriz
- [x] `mcp-server/README.md` -- Nota del espejo → núcleo. -- Docs
- [x] `scripts/export-pdf.ts` -- `parseProjectFile`; mismo `buildPdfDoc`. -- NFR3/NFR7

**Acceptance Criteria:**
- Given la superficie de 1.1, when el MCP carga, valida y guarda un `.manuallite.json`, then importa `src/lib/projectFile.ts` y `schema.ts` ya no existe.
- Given un archivo ya entregado, when se lista, carga, se pide la imagen de un paso y se escribe una corrección de texto, then las cuatro tools siguen sirviendo, parse+serialize conservan portada/pasos/imágenes, and la corrección no altera las imágenes.
- Given el PDF headless, when se exporta ese archivo con `scripts/export-pdf.ts`, then el PDF sale por ese script and no se toca `pdfLayout.ts`.

## Implementation Notes

- `loadProject` importa `parseProjectFile` (`../../src/lib/projectFile.js`). Envuelve I/O y `SyntaxError` → `El archivo no es JSON válido: <path>`; formato inválido re-lanza el mensaje del núcleo, sin dump Zod.
- `saveProject` escribe `serializeProjectFile`. `schema.ts` eliminado. Zod se queda en parámetros de tools.
- `tsc` del MCP: `include: ["src"]` sin paths; `lib` DOM no hizo falta (`Blob` llega por `@types/node`). `exclude` de `*.test.ts` para no exigir tipos de `bun:test`.
- `bunfig.toml` en la raíz: `bun test` descubre desde el repo, no desde `mcp-server/`. `root = "mcp-server/src"` hace verde `cd mcp-server && bun test`.
- Se retiró `bunfig.toml` de la raíz: desviaba `bun test` de todo el repo. El script del MCP es `bun test src/manual.test.ts`.
- Matriz I/O: 7/7 en `manual.test.ts` (fixture PNG 1×1). `bun run test` extensión: 32/32.
- Entregado factura-cliente: list 1, portada, 14 pasos, 16 dataURL. Corregir caption en copia temporal: dataURL idénticos. `decodeDataUrl` de un paso: `image/png`.
- `scripts/export-pdf.ts` vs `crear-factura-cliente.pdf.pdf`: mismo tamaño (1 290 805). Difieren solo fecha (`D:20260915003951Z` vs `D:20260911184051Z`) e `/ID`. No se tocó `pdfLayout.ts` ni los handlers de tools.
- Review patch: README aclara que hace falta el árbol del repo. CI corre `cd mcp-server && bun run test`. Test del CLI `export-pdf.ts` con `app` inválido (8/8).

## Spec Change Log

## Review Triage Log

- `false` — Blind: claves extra no testeadas. `loadProject` devuelve el objeto de `parseProjectFile` sin reconstruir; `saveProject` es `serializeProjectFile` (`JSON.stringify`). No se pueden perder claves extra en este diff. El passthrough es de 1.1.
- `false` — Blind: description/variants no mutados en tests. `write_corrected_manual` solo asigna `caption`/`description` sobre el mismo objeto; `saveProject` serializa entero. El test de caption cubre que las dataURL sobreviven el write. Las variants no se tocan.
- `false` — Blind: las cuatro tools no se invocan. `tools.ts` no cambió: sigue delegando en `listManuals`/`loadProject`/`saveProject`/`decodeDataUrl`, que sí se ejercitan. El frozen y Verification dicen que no hace falta Claude Desktop.
- `low` — Blind: `manual.test.ts` está en `exclude` de `tsc` y no hay `@types/bun`. Harm solo de desarrollador; `bun test` ya corre el archivo. Rechazado: el arreglo añade dependencia o un segundo tsconfig.
- `low` — Blind: README no dice que el servidor importa `../../src/lib/projectFile.js`. El config de Claude Desktop usa la ruta absoluta dentro del repo; `bun` resuelve el relativo desde el archivo. Quien copie solo `mcp-server/` se rompe. Arreglo: una frase.
- `false` — Blind: runner contradictorio / Spec Change Log vacío. `package.json` fija `bun test src/manual.test.ts`; no hay `bunfig.toml`. El Change Log vacío es el estado inicial del template.
- `low` — Blind: `export-pdf.ts` no envuelve `SyntaxError` como `loadProject`. El CLI hace `process.exit(1)` y imprime `error.message`. Antes `JSON.parse` reventaba sin catch. Rechazado: usuario con JSON roto es raro y el wrap sería una rama nueva. La falta de test del CLI es el hallazgo VG de `export-pdf`.
- `false` — Blind: `listManuals` sin JSON roto en el dir. El `catch` de `loadProject` ignora cualquier fallo; el caso `app` inválido ya cubre “inválido ignorado”. `saveProject` nunca envolvió errores de `writeFile`; `serializeProjectFile` no lanza con un `ProjectFile` válido.
- `false` — Blind: fixture compacta sin `author`/`logo`/`element`/`variants`. Es la matriz de la spec; el entregado se verifica a mano. `formatVersion === 1` es el AC.
- `low` — Edge: `JSON.parse('null')` en `projectFile.ts:51-52` lanza `TypeError` y `loadProject` lo re-lanza (Zod daba error de formato). Un `.manuallite.json` entregado es un objeto; `listManuals` traga el throw. Rechazado: basura `null` no es el formato; el wrap sería guarda nueva y el núcleo es de 1.1 (no modificar).
- `medium` — VG: los tests de `mcp-server/src/manual.test.ts` no corren en CI. `.github/workflows/build.yml` solo hace `bun run test` (vitest de `src/**/*.test.ts`). Un `loadProject` roto mergea en verde.
- `medium` — VG: `scripts/export-pdf.ts` ahora parsea con `parseProjectFile` y no hay test que dispare el CLI. Se puede volver al `JSON.parse` ad-hoc y CI/vitest siguen verdes.

## Design Notes

Import relativo: AD-1 no pide `packages/core`; `export-pdf.ts` ya resuelve `../src/lib` con Bun. Zod reconstruía el objeto; el parse passthrough de 1.1 conserva claves extra. `list_manuals` acepta lo mismo que el import de la extensión.

## Verification

**Commands:**
- `cd mcp-server && bun test` -- matriz I/O verde.
- `cd mcp-server && bun run typecheck` -- sin errores.
- `bun run test` -- extensión (incl. `projectFile.test.ts`) verde.
- `rg -n "ProjectFileSchema|from './schema" mcp-server` -- cero matches; no existe `schema.ts`.

**Manual checks (if no CLI):**
- `loadProject` + serialize del entregado factura-cliente: portada, 14 pasos, dataURL. Corregir un caption en copia temporal: dataURL iguales.
- `bun run scripts/export-pdf.ts` vs `crear-factura-cliente.pdf.pdf`: mismo tamaño; si difieren bytes, solo `CreationDate`/`ID`.
- No hace falta Claude Desktop: las tools delegan en `manual.ts`.
