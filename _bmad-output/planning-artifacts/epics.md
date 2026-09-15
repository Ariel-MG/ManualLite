---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/specs/spec-manuallite-v2/SPEC.md
  - _bmad-output/specs/spec-manuallite-v2/architecture.md
  - docs/v2-brief.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-14.md
scope: CAP-1 only
deferredCapabilities:
  - CAP-3
  - CAP-5
acceptanceGuarantees:
  - CAP-2
  - CAP-4
  - CAP-6
---

# ManualLite v2 - Epic Breakdown

## Overview

Desglose de epics y stories para ManualLite v2, **solo CAP-1** (núcleo compartido). CAP-2, CAP-4 y CAP-6 no se parten: son garantías de no romper lo existente y entran como criterios de aceptación. CAP-3 (creación por agente) y CAP-5 (biblioteca en disco / procedencia) quedan fuera de este inventario hasta un desglose posterior.

No hay PRD ni contrato UX; el contrato es el SPEC + architecture.

## Requirements Inventory

### Functional Requirements

FR1: Existe una superficie Node-safe de parse y serialize del `ProjectFile` (`.manuallite.json`) en `src/lib`, sin IndexedDB, `downloadBlob`, `File`, `OffscreenCanvas` ni `createImageBitmap`.

FR2: La extensión exporta e importa `.manuallite.json` usando esa superficie. Download del archivo e import hacia IndexedDB permanecen en código de la extensión.

FR3: El MCP valida, lee y escribe `.manuallite.json` importando esa superficie. `mcp-server/src/schema.ts` deja de ser un espejo a mano de `ProjectFile`.

FR4: `formatVersion` permanece en 1. Un `.manuallite.json` ya entregado parsea sin migración manual.

FR5: La geometría del anillo (radios, halo, trazos, colores) vive en una sola función que recibe un `CanvasRenderingContext2D`. No se reimplementa el anillo en el MCP ni se copia `annotate.ts` entero.

FR6: En la extensión, `annotate.ts` obtiene el contexto 2D con `OffscreenCanvas` + `createImageBitmap` y llama la función compartida. Esas APIs no entran al núcleo.

FR7: En el MCP, el contexto 2D se obtiene con `@napi-rs/canvas` 1.0.9 (Bun, `bun run`) y se llama la misma función. No se polyfillean `OffscreenCanvas` / `createImageBitmap` / `ImageBitmap`. La extensión no depende de `@napi-rs/canvas`.

FR8: Parse + serialize de un `.manuallite.json` ya entregado hace round-trip: `app`, `formatVersion`, metadatos de portada, pasos e imágenes se conservan.

### NonFunctional Requirements

NFR1 (CAP-2): Grabar, pausar, editar y exportar PDF/HTML/Markdown/JSON se comportan igual que antes de este corte. El pipeline de captura del side panel no cambia.

NFR2 (CAP-4): `list_manuals`, `load_manual`, `get_step_image` y `write_corrected_manual` siguen sirviendo el flujo de revisión.

NFR3 (CAP-6): Un `.manuallite.json` ya entregado abre en la extensión (import actual) y el PDF headless sale por `scripts/export-pdf.ts`, sin migración.

NFR4: Cada story que toque parse/serialize o el camino de abrir/exportar incluye un criterio de round-trip sobre un `.manuallite.json` ya entregado.

NFR5: No se toca `src/lib/exporters/pdfLayout.ts`. No se rediseña el editor.

NFR6: Paridad de anotación extensión ↔ MCP: visual, no byte a byte. Prohibidos tests golden de PNG idéntico del anillo.

NFR7: El núcleo es la única definición del formato. Ningún frente duplica lógica de pasos ni de exportación.

### Additional Requirements

- Brownfield: partir `src/lib/project.ts`. Parse/serialize → superficie Node-safe; download/import-a-IDB → extensión. (AD-1)
- El MCP y `scripts/export-pdf.ts` importan el núcleo; no hace falta `packages/core` en este corte.
- AD-7: backends de canvas distintos; geometría compartida; paridad visual aceptada (media ≈ 0.71/canal en halo; línea central `#dc2626` idéntica).
- `Bun.Image` no es backend de dibujo.
- CAP-3 (tools MCP de crear/anotar/persistir un manual) y CAP-5 (carpetas, procedencia en el archivo) no se implementan en este desglose. FR7 deja el backend de anillo del MCP listo; no añade las tools de creación.
- Starter template: ninguno (brownfield).

### UX Design Requirements

Ninguno. Este corte no toca UI; no hay contrato UX.

### FR Coverage Map

FR1: Epic 1 — Superficie Node-safe de parse/serialize
FR2: Epic 1 — Extensión exporta/importa contra esa superficie
FR3: Epic 1 — MCP importa el núcleo; desaparece el espejo
FR4: Epic 1 — formatVersion 1; sin migración
FR5: Epic 1 — Geometría del anillo en una función
FR6: Epic 1 — Extensión: OffscreenCanvas
FR7: Epic 1 — MCP: @napi-rs/canvas
FR8: Epic 1 — Round-trip de un .manuallite.json entregado

## Epic List

### Epic 1: El mismo manual, sin duplicar formato ni anillo
Quien graba y quien lee/corrige por el MCP usan la misma definición de `.manuallite.json`. El anillo de click se define una vez; cada frente solo obtiene su canvas. Un archivo ya entregado sigue abriendo y exportando.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8

## Epic 1: El mismo manual, sin duplicar formato ni anillo

Quien graba y quien lee/corrige por el MCP usan la misma definición de `.manuallite.json`. El anillo de click se define una vez; cada frente solo obtiene su canvas. Un archivo ya entregado sigue abriendo y exportando.

### Story 1.1: Superficie Node-safe de parse y serialize

As a quien ya tiene `.manuallite.json` entregados,
I want que parse y serialize del formato vivan en un módulo Node-safe,
So that la extensión deja de mezclar el esquema con download e IndexedDB, y un archivo actual sigue abriendo.

**Acceptance Criteria:**

**Given** `src/lib/project.ts` mezcla esquema, download e import a IndexedDB
**When** se extrae parse/serialize a una superficie en `src/lib`
**Then** esa superficie no importa IndexedDB, `downloadBlob`, `File`, `OffscreenCanvas` ni `createImageBitmap` (FR1)
**And** download e import a IndexedDB siguen en código de la extensión (FR2)

**Given** un `.manuallite.json` ya entregado (`formatVersion` 1, sin campos nuevos)
**When** se parsea y se vuelve a serializar con la superficie nueva
**Then** se conservan `app`, `formatVersion`, metadatos de portada, pasos e imágenes (FR4, FR8, NFR4)
**And** no hace falta migración manual (NFR3 / CAP-6)

**Given** la extensión tras el cambio
**When** se graba con el side panel, se edita y se exporta PDF/HTML/Markdown/JSON
**Then** el comportamiento es el de antes (NFR1 / CAP-2)
**And** no se toca `pdfLayout.ts` ni se rediseña el editor (NFR5)

### Story 1.2: El MCP importa el núcleo y deja el espejo

As a quien revisa manuales con el MCP,
I want que el servidor lea y escriba `.manuallite.json` con la misma superficie que la extensión,
So that el formato no viva duplicado en `mcp-server/src/schema.ts`.

**Acceptance Criteria:**

**Given** la superficie Node-safe de parse/serialize de la story 1.1
**When** el MCP carga, valida y guarda un `.manuallite.json`
**Then** lo hace importando esa superficie, no un esquema espejo (FR3)
**And** `mcp-server/src/schema.ts` se elimina del repo (no queda en él ninguna definición de `ProjectFile`)

**Given** un `.manuallite.json` ya entregado
**When** se lista, carga, se pide la imagen de un paso y se escribe una corrección de texto
**Then** `list_manuals`, `load_manual`, `get_step_image` y `write_corrected_manual` siguen sirviendo (NFR2 / CAP-4)
**And** parse + serialize del archivo original conserva portada, pasos e imágenes (FR8, NFR4)
**And** la corrección de texto no altera las imágenes

**Given** el PDF headless
**When** se exporta ese archivo ya entregado con `scripts/export-pdf.ts`
**Then** el PDF sale por ese script, sin segundo pipeline (NFR3 / CAP-6)
**And** no se toca `pdfLayout.ts` (NFR5)

### Story 1.3: Geometría del anillo en la extensión

As a quien graba a mano,
I want que el anillo de click se dibuje desde una función de geometría compartida,
So that el marcador no esté atado a `OffscreenCanvas` dentro del núcleo, y la grabación siga igual.

**Acceptance Criteria:**

**Given** `src/lib/annotate.ts` dibuja radios, halo y trazos contra `OffscreenCanvas` y `createImageBitmap`
**When** se extrae esa geometría a una función que recibe `CanvasRenderingContext2D`
**Then** radios, halo `rgba(220,38,38,0.18)`, trazo blanco y anillo `#dc2626` viven solo ahí (FR5)
**And** `annotate.ts` obtiene el contexto con `OffscreenCanvas` + `createImageBitmap` y llama esa función (FR6)
**And** esas APIs de browser no se importan desde el módulo de geometría

**Given** la extensión tras el cambio
**When** se graba un click con el side panel
**Then** el paso sale anotado como hoy (NFR1 / CAP-2)
**And** el pipeline de captura no cambia
**And** `package.json` de la extensión no depende de `@napi-rs/canvas`

**Given** un `.manuallite.json` ya entregado (con `screenshot` y `annotated`)
**When** se parsea, se importa en la extensión y se vuelve a serializar
**Then** el archivo abre sin migración y las imágenes se conservan (FR8, NFR3, NFR4)
**And** no se rediseña el editor (NFR5)

### Story 1.4: Backend de anillo del MCP con napi-rs

As a quien armará manuales desde el MCP más adelante,
I want que el MCP pinte el anillo con `@napi-rs/canvas` y la misma geometría,
So that no haga falta copiar el anillo ni polyfillear `OffscreenCanvas` cuando llegue CAP-3.

**Acceptance Criteria:**

**Given** la función de geometría de la story 1.3 y `@napi-rs/canvas` 1.0.9 en `mcp-server/`
**When** el MCP obtiene un contexto 2D con `createCanvas` / `loadImage` y llama esa función
**Then** el anillo se dibuja con la misma geometría que la extensión (FR7)
**And** no se polyfillean `OffscreenCanvas`, `createImageBitmap` ni `ImageBitmap`
**And** no se añaden tools MCP de crear/anotar/persistir un manual (eso es CAP-3)

**Given** una captura sin anotar y el `clickOnImage` de un `.manuallite.json` ya entregado
**When** se pinta el anillo con el backend del MCP
**Then** el resultado coincide a la vista con el `annotated` de la extensión (NFR6)
**And** no se exige PNG byte-igual (antialias Skia vs Chrome)
**And** la línea central del anillo es `#dc2626`

**Given** las tools de revisión del MCP
**When** se listan, cargan y corrigen manuales ya entregados
**Then** siguen funcionando (NFR2 / CAP-4)
**And** parse + serialize de un `.manuallite.json` ya entregado conserva portada, pasos e imágenes (FR8, NFR4)
**And** la extensión no depende de `@napi-rs/canvas`
