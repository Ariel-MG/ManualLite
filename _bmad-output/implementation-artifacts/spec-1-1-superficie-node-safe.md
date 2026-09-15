---
title: 'Superficie Node-safe de parse y serialize'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e22388c2da812e98986c8c5d705d29a7a77303d3'
context:
  - '_bmad-output/implementation-artifacts/epic-manuallite-v2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Parse y serialize de `.manuallite.json` viven mezclados con download e IndexedDB en `src/lib/project.ts`. El MCP y `export-pdf.ts` no pueden reutilizar esa definición sin arrastrar APIs de navegador.

**Approach:** Extraer el esquema `ProjectFile` y las funciones de parse/serialize a un módulo Node-safe en `src/lib`. La extensión sigue descargando e importando a IndexedDB; un archivo `formatVersion` 1 sigue abriendo sin migración.

## Boundaries & Constraints

**Always:**
- La superficie nueva no importa IndexedDB, `downloadBlob`, `File`, `OffscreenCanvas` ni `createImageBitmap`.
- Download e import a IndexedDB permanecen en código de la extensión (`src/lib/project.ts` + `ManualLibrary`).
- `formatVersion` permanece en 1. Parse + serialize de un archivo ya entregado conservan `app`, `formatVersion`, metadatos de portada, pasos e imágenes (igualdad de campos, no bytes JSON). La fixture compacta no sustituye esta prueba sobre un JSON real con imágenes en base64.
- El entregado `Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.manuallite.json` se parsea y serializa con la superficie nueva; el PDF sale por `scripts/export-pdf.ts` y se compara con el PDF ya generado (`crear-factura-cliente.pdf.pdf`). El script no se reescribe en esta story.
- Grabar, pausar, editar y exportar PDF/HTML/Markdown/JSON se comportan igual.

**Never:**
- No cablear el MCP ni `scripts/export-pdf.ts` en esta story (eso es 1.2).
- No tocar `src/lib/exporters/pdfLayout.ts`, `annotate.ts`, captura del side panel, ni rediseñar el editor.
- No añadir `provenance` ni subir `formatVersion`.
- No extraer `packages/core`. No meter Zod en el núcleo de la extensión.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Round-trip entregado | JSON `app=ManualLite`, `formatVersion=1`, portada + pasos con dataURL | Tras parse→serialize se conservan `app`, `formatVersion`, `manual`, `steps` (incl. imágenes) | N/A |
| Import inválido | `app` distinto o `steps` no es array | No hay `ProjectFile` | El mismo error que hoy: `El archivo no es un proyecto válido de ManualLite.` |
| Campos opcionales ausentes | Sin `logo`, sin `screenshot`/`annotated` en algún paso | Parse ok; serialize no inventa esos campos | N/A |
| `steps` vacío | `steps: []` válido | Parse ok; serialize conserva el array vacío | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/project.ts` — Hoy mezcla `ProjectFile` (privado L32–49), `exportProject` (Blobs→dataURL + `downloadBlob`), `importProject` (`File` + IndexedDB), `dataUrlToBlob` (`fetch`). Dejar aquí solo I/O de extensión.
- `src/lib/blob.ts` — `blobToDataURL` (`FileReader`), `downloadBlob` (`document`). No importar desde el núcleo.
- `src/editor/ManualLibrary.tsx` — Único llamador: `exportProjectById` / `importProject`. No cambiar su UI.
- `src/types.ts` — `Manual` / `Step` en memoria (Blobs). Distinto de `ProjectFile` (dataURL).
- `mcp-server/src/schema.ts` — Espejo Zod. No tocarlo en 1.1.
- `scripts/export-pdf.ts` — `JSON.parse` ad-hoc. No tocarlo en 1.1.
- `/Users/arielmg/Documents/Gitlab/odoo-docker/Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.manuallite.json` — Entrega real (~3.3 MB). No commitear. Verificación parse/serialize + PDF.
- `/Users/arielmg/Documents/Gitlab/odoo-docker/Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.pdf.pdf` — PDF ya generado; baseline para `scripts/export-pdf.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/projectFile.ts` -- Crear tipos `ProjectFile` / pasos serializados, `FORMAT`, `FORMAT_VERSION`, `parseProjectFile(text)` y `serializeProjectFile(project)`. Parse: `JSON.parse` + validar `app === 'ManualLite'` y `Array.isArray(steps)`; devolver el objeto parseado (no reconstruir campo a campo). Serialize: `JSON.stringify` de ese objeto. -- Única definición Node-safe del formato.
- [x] `src/lib/project.ts` -- Importar parse/serialize/tipos del núcleo. `exportProject` arma el `ProjectFile` (Blobs→dataURL) y descarga `serializeProjectFile`. `importProject` lee `file.text()`, parsea, y sigue escribiendo IndexedDB. -- FR2 sin cambiar el flujo de biblioteca.
- [x] `src/lib/projectFile.test.ts` -- Cubrir la matriz I/O con fixture compacta `formatVersion` 1 (portada, un paso con dataURL mínimo, un paso sin imagen). Assert igualdad de campos, no bytes. -- NFR4 sin meter el JSON de MBs al repo.

**Acceptance Criteria:**
- Given `src/lib/project.ts` mezcla esquema, download e IndexedDB, when se extrae parse/serialize a `src/lib/projectFile.ts`, then ese módulo no importa IndexedDB, `downloadBlob`, `File`, `OffscreenCanvas` ni `createImageBitmap`, and download e import a IndexedDB siguen en `project.ts`.
- Given un `.manuallite.json` `formatVersion` 1 sin campos nuevos, when se parsea y se serializa, then se conservan `app`, `formatVersion`, metadatos de portada, pasos e imágenes, and no hace falta migración.
- Given la extensión tras el cambio, when se graba con el side panel, se edita y se exporta PDF/HTML/Markdown/JSON, then el comportamiento es el de antes, and no se toca `pdfLayout.ts` ni se rediseña el editor.

## Implementation Notes

- `bun run test`: 32/32, incluidos 4/4 de `projectFile.test.ts` (round-trip, inválido, opcionales, `steps: []`).
- `bun run typecheck` ok. `projectFile.ts` no referencia IndexedDB, `downloadBlob`, `File`, `OffscreenCanvas` ni `createImageBitmap`.
- Entregado factura-cliente: parse→serialize conserva `app`, `formatVersion`, portada, 14 pasos y 16 dataURL (8 screenshot + 8 annotated). Bytes JSON bajan 239 por whitespace; igualdad de campos sí.
- PDF `scripts/export-pdf.ts` vs `crear-factura-cliente.pdf.pdf`: mismo tamaño (1 290 805). Difieren solo `CreationDate` e `/ID` (pdfmake). No se reescribió el script.
- No se ejercitó el side panel en navegador: esta story no toca captura ni UI.

## Spec Change Log

## Review Triage Log

- `false` — Blind: JSON `null` / `manual` ausente. `JSON.parse('null')` lanza TypeError al leer `.app` (`projectFile.ts:51-52`). Un `.manuallite.json` entregado es un objeto con `manual`; basura JSON no es el formato. Misma guarda que el `importProject` anterior.
- `false` — Blind: claves extra no testeadas. Parse/serialize son passthrough: un `extra` en raíz, `manual` y paso sobrevive `parse→serialize`. No hay pérdida.
- `false` — Blind: `formatVersion` no se exige. El import anterior tampoco lo validaba; exigir 1 sería migración. Los entregados ya lo traen.
- `false` — Blind: fixture sin `author`/`logo`/`element`/`variants`. El contrato de round-trip grande se cubrió con factura-cliente (14 pasos, 16 dataURL). La fixture compacta es la de la spec.
- `false` — Blind: test de opcionales reusa `fixture()`. `JSON.stringify` omite las claves ausentes; el parse del string no inventa `logo` ni imágenes en el paso sección.
- `false` — Blind: `app` ausente, `steps: null`, texto vacío. Los dos primeros lanzan el Error en español; el vacío es `SyntaxError` de `JSON.parse`, igual que antes.
- `false` — Blind: no exportar el mensaje de error / `export-pdf.ts` usa otra frase. El intent excluye cablear ese script (story 1.2).
- `false` — Blind: AC de side panel no corrido. El diff no toca captura, editor ni exporters; el comportamiento se conserva por no editar esos caminos.
- `false` — Blind: Code Map desactualizado y `rg` incompleto. El arreglo sería editar la spec de este build; se rechaza.
- `false` — Blind: rutas absolutas y comparación débil de PDF. Igual: arreglo de spec. El PDF generado iguala tamaño y solo cambia `CreationDate`/`ID`.
- `false` — Edge-case: TypeError si `JSON.parse` da `null` (`projectFile.ts:51-52`). Mismo caso que el primer hallazgo; no es un archivo del formato.

## Design Notes

Parse no clona campo a campo: así un entregado redondea sin perder claves. `exportedAt: Date.now()` solo al exportar desde `Manual`+`Step` en memoria; un round-trip de archivo conserva el `exportedAt` original.

La fixture de test copia la forma de un entregado `formatVersion` 1 y sustituye dataURL por un PNG 1×1. No entra al repo el JSON de MBs. La prueba contra el archivo real de factura-cliente es verificación (parse/serialize + PDF), no test de Vitest.

## Verification

**Commands:**
- `bun run test` -- todos los tests pasan, incluida la matriz de `projectFile.test.ts`.
- `bun run typecheck` -- sin errores.
- `rg -n "indexedDB|downloadBlob|OffscreenCanvas|createImageBitmap" src/lib/projectFile.ts` -- cero matches; tampoco import de `File` como valor.

**Manual checks (if no CLI):**
- Parse + serialize de `/Users/arielmg/Documents/Gitlab/odoo-docker/Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.manuallite.json` con la superficie nueva: se conservan `app`, `formatVersion`, portada, pasos e imágenes (igualdad de campos, incluidas las dataURL grandes).
- `bun run scripts/export-pdf.ts` sobre ese JSON, comparado contra `/Users/arielmg/Documents/Gitlab/odoo-docker/Manuales/contabilidad/crear-factura-cliente/crear-factura-cliente.pdf.pdf`. Si los bytes no coinciden, inspeccionar si es regresión o no-determinismo de pdfmake; no reescribir `export-pdf.ts`.
- Side panel: grabar un click, pausar, reanudar, detener. Biblioteca: importar/exportar `.manuallite.json`. Editor: exportar PDF/HTML/Markdown/JSON. Sin cambios de UI ni de `pdfLayout`.
