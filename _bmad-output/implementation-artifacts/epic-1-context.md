# Epic 1 Context: El mismo manual, sin duplicar formato ni anillo

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Quien graba y quien lee/corrige por el MCP usan la misma definición de `.manuallite.json`. El anillo de click se define una vez; cada frente solo obtiene su canvas. Un archivo ya entregado sigue abriendo y exportando. Este corte cubre solo el núcleo compartido: no añade tools de creación ni biblioteca/procedencia.

## Stories

- Story 1.1: Superficie Node-safe de parse y serialize
- Story 1.2: El MCP importa el núcleo y deja el espejo
- Story 1.3: Geometría del anillo en la extensión
- Story 1.4: Backend de anillo del MCP con napi-rs

## Requirements & Constraints

- Parse y serialize de `ProjectFile` viven en una superficie Node-safe en `src/lib`. Esa superficie no importa IndexedDB, `downloadBlob`, `File`, `OffscreenCanvas` ni `createImageBitmap`. Download e import hacia IndexedDB permanecen en la extensión.
- El MCP valida, lee y escribe `.manuallite.json` importando esa superficie. En el servidor no queda ninguna definición espejo de `ProjectFile`.
- `formatVersion` permanece en 1. Un archivo ya entregado parsea y serializa sin migración. El round-trip conserva `app`, `formatVersion`, metadatos de portada, pasos e imágenes.
- Grabar, pausar, editar y exportar PDF/HTML/Markdown/JSON se comportan igual. El pipeline de captura del side panel no cambia.
- Las tools de revisión (`list_manuals`, `load_manual`, `get_step_image`, `write_corrected_manual`) siguen sirviendo. Una corrección de texto no altera las imágenes.
- El PDF headless sale solo por `scripts/export-pdf.ts`. No se toca `pdfLayout.ts`. No se rediseña el editor.
- Paridad de anotación extensión ↔ MCP: visual, no byte a byte. Prohibidos tests golden de PNG idéntico del anillo.
- El núcleo es la única definición del formato. Ningún frente duplica lógica de pasos ni de exportación.
- Fuera de este corte: tools MCP de crear/anotar/persistir un manual, y biblioteca en disco / procedencia. No se publica el núcleo como paquete npm.

## Technical Decisions

- Brownfield: partir el módulo que hoy mezcla esquema con download/import-a-IDB. Parse/serialize van al núcleo; I/O de navegador se queda en la extensión. No hace falta un workspace `packages/core` si `src/lib` Node-safe basta para que el MCP importe.
- Extensión, MCP y `scripts/export-pdf.ts` importan el núcleo. El archivo que el MCP lee/escribe es el mismo `ProjectFile` que exporta la extensión.
- Geometría del anillo: una función que recibe `CanvasRenderingContext2D` y concentra radios, halo, trazos y colores. No se reimplementa el anillo en el MCP ni se copia el anotador entero.
- Extensión: obtiene el contexto 2D con `OffscreenCanvas` + `createImageBitmap` y llama esa función. Esas APIs no entran al núcleo. El `package.json` de la extensión no depende de `@napi-rs/canvas`.
- MCP: contexto 2D con `@napi-rs/canvas` 1.0.9 (`createCanvas` / `loadImage`), verificado en Bun con `bun run`. No se polyfillean `OffscreenCanvas`, `createImageBitmap` ni `ImageBitmap`. `Bun.Image` no es backend de dibujo.
- Paridad aceptada: media ≈ 0.71/canal en la caja del halo (antialias Skia vs Chrome); línea central del anillo `#dc2626` idéntica.

## Cross-Story Dependencies

- 1.2 requiere la superficie de parse/serialize de 1.1.
- 1.4 requiere la función de geometría de 1.3.
- 1.4 deja el backend de anillo listo; no añade las tools de creación.
- Toda story que toque parse/serialize o el camino de abrir/exportar debe verificar round-trip de un `.manuallite.json` ya entregado.
