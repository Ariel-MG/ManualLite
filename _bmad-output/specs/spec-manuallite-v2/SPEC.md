---
id: SPEC-manuallite-v2
companions:
  - architecture.md
sources:
  - ../../../docs/v2-brief.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# ManualLite v2 — núcleo compartido y creación por agentes

## Why

Dolor: ManualLite solo produce manuales por grabación humana, pero las actas de Odoo se arman fuera (Playwright recorre la UI, un plan.json describe los pasos, un script fabrica el JSON) y la extensión entra al final para el PDF. Eso duplica la lógica de formato entre extensión y scripts, y deja una biblioteca plana que no sabe de qué proyecto viene cada manual ni cómo se produjo — ya conviven Odoo y otras apps. El v2 existe para que un núcleo único defina el manual, lo consuman el humano que graba y el agente que crea, y la biblioteca organice por carpeta con procedencia. Un manual de agente y uno grabado a mano son el mismo objeto.

## Capabilities

- **CAP-1**
  - **intent:** Extensión y agentes producen y exportan el mismo tipo de manual a partir de una sola definición de formato, pasos, anotación y exporters.
  - **success:** Un cambio de formato, de paso, de exporter o de geometría del anillo se hace en un solo módulo; el MCP no mantiene un esquema espejo ni una copia del anillo; un script externo ya no arma el JSON a mano. La anotación extensión vs MCP se verifica a la vista, no por PNG idéntico.

- **CAP-2**
  - **intent:** Quien graba a mano puede iniciar, pausar, capturar, editar y exportar como hoy.
  - **success:** Side panel, editor y exportaciones PDF/HTML/Markdown/JSON se comportan igual que antes de este corte; el pipeline de captura no cambia.

- **CAP-3**
  - **intent:** Un agente puede crear un manual a partir de capturas ya tomadas: anotar el click y armar el archivo en disco.
  - **success:** Playwright (u otro capturador externo) entrega imagen + punto de click + texto; el MCP existente anota, ensambla un `.manuallite.json` válido y lo escribe en una carpeta de proyecto. El MCP no abre ni dirige un navegador.

- **CAP-4**
  - **intent:** Un agente puede seguir listando, leyendo, viendo imágenes y corrigiendo texto de manuales ya existentes.
  - **success:** `list_manuals`, `load_manual`, `get_step_image` y `write_corrected_manual` siguen sirviendo el flujo de revisión; una corrección de texto no reescribe la procedencia de producción.

- **CAP-5**
  - **intent:** La biblioteca sabe a qué proyecto pertenece cada manual y cómo se produjo.
  - **success:** Los `.manuallite.json` viven en directorios de proyecto en disco; cada archivo nuevo lleva procedencia de producción; IndexedDB no es la biblioteca (solo borrador de la sesión de grabación).

- **CAP-6**
  - **intent:** Un manual creado por agente y uno grabado a mano se abren, editan y exportan por los mismos caminos.
  - **success:** El archivo armado por el MCP abre en la extensión (import actual) y el PDF headless sale por `scripts/export-pdf.ts`. Un `.manuallite.json` ya entregado, sin procedencia, abre y exporta sin migración manual.

## Constraints

- El núcleo es la única definición del formato. Ningún frente duplica lógica de pasos ni de exportación.
- Los `.manuallite.json` ya entregados siguen abriendo sin migración manual. `formatVersion` se queda en 1; la procedencia es un objeto opcional aditivo.
- El PDF headless sale solo por `scripts/export-pdf.ts` (mismo motor `pdf.ts`). No hay un segundo pipeline de PDF.
- Grabar, editar y exportar siguen funcionando igual al terminar.
- La extensión no corre Playwright ni orquesta navegadores. La automatización vive del lado del agente.
- El MCP arma, no navega: recibe capturas ya tomadas; no lanza browser.
- No rediseñar el editor. El listado del editor sigue siendo IndexedDB (borradores). Abrir un manual de disco es el import actual; llegar a disco es el export actual.
- No tocar `src/lib/exporters/pdfLayout.ts`.
- No cambiar el pipeline de captura (side panel).
- Procedencia es de **producción del manual**, no historial de edición, y no va por paso. Ver `architecture.md`.
- La geometría del anillo (radios, halo, trazos, colores) vive en una función que recibe `CanvasRenderingContext2D`. No se polyfillean `OffscreenCanvas` / `createImageBitmap` / `ImageBitmap`. La extensión no depende de `@napi-rs/canvas`.
- Paridad de anotación extensión ↔ MCP: visual, no byte a byte. Ver `architecture.md` AD-7.

## Non-goals

- Agrupar varias secciones en un PDF o partir uno en varios (decisión de cliente abierta).
- Nube, sincronización, multiusuario.
- Publicación web o help center.
- Traducción de manuales.
- Rediseñar el editor para navegar la biblioteca en disco.
- Absorber Playwright, `plan.json` o el runner de Odoo dentro de este repo.
- Procedencia por paso (origen/fecha en cada paso).
- Publicar el núcleo como paquete npm aparte.
- Polyfill de APIs de canvas en Bun; `@napi-rs/canvas` dentro de la extensión.

## Success signal

Un agente arma un `.manuallite.json` vía MCP a partir de capturas de Playwright, el archivo queda en una carpeta de proyecto con `provenance.producedBy = "agent"`, abre en la extensión y el PDF sale por `scripts/export-pdf.ts`. Un manual grabado a mano exportado a otra carpeta lleva `producedBy = "human"`. Un `.manuallite.json` ya entregado, sin `provenance`, abre y exporta sin pasos de migración. Grabar con el side panel sigue igual.

## Assumptions

- No hay raíz mágica de biblioteca: el directorio de proyecto lo elige quien llama, como hoy el MCP recibe `dir`.
- Playwright, `plan.json` y el runner de Odoo siguen fuera de este repo; este corte solo deja de duplicar el armado del JSON.
