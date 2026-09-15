---
title: 'El export falla si hay acciones fuera de toda sección'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
  - _bmad-output/specs/spec-secciones-numeradas/numbering.md
  - _bmad-output/implementation-artifacts/spec-1-1-numeracion-jerarquica-cuerpo-indice.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Con al menos un `kind: section`, las acciones antes de la primera sección se exportan en silencio (`token` vacío, caption suelto). El autor puede mandar al cliente un PDF numerado que oculta pasos fuera de procedimiento.

**Approach:** Si hay secciones y alguna acción aparece antes de la primera, el export (PDF, HTML, Markdown e índice) falla con el mensaje exacto `hay pasos fuera de toda sección` y no produce archivo. No inventa `0.1.`, sección implícita ni `Paso N` mezclado. Notas y reglas antes de la primera sección no disparan el error. Sin secciones, se conserva `Paso N. título`.

</frozen-after-approval>

## Implementation Notes

- Fallar en `numberSteps` (`src/lib/exporters/numbering.ts`): `Error` con `message` exacto `hay pasos fuera de toda sección` (sin punto). Los cuatro call sites ya invocan el helper antes de `downloadBlob` / `writeFileSync`; no reescribir `scripts/export-pdf.ts`. `ExportBar` ya hace `alert('No se pudo exportar: ' + msg)`.
- Huérfana = paso que no es `section`/`note`/`rule` y aparece antes del primer `kind: section`. Independiente de imagen y de `requireSize`, para que PDF/HTML/MD fallen igual. Quitar el branch de `token: ''`.
- `numbering.test.ts`: el caso L108–116 hoy espera caption suelto — debe pasar a `toThrow('hay pasos fuera de toda sección')`. Añadir: notas/reglas antes de la primera sección no lanzan; `THREE_SECTIONS` y el `.crudo` plano no lanzan; `buildTocEntries` con huérfana también lanza.
- Off-limits: `pdfLayout.ts`, `projectFile.ts`, `types.ts`, editor, captura, `paintClickRing`, `annotate.ts`.
- CAP-3: `bun run scripts/export-pdf.ts` del `.crudo` vs `tests/goldens/crear-factura-cliente.crudo.golden.pdf` (solo `CreationDate` e `/ID`).
- Implementado: constante privada `ORPHAN_STEPS_MESSAGE`; se eliminó `inSection` y el `token: ''`. Tests de throw en helper, TOC, HTML (sin `downloadBlob`), Markdown (sin `downloadBlob`) y `buildPdfDoc`. CLI huérfana: exit 1, mensaje exacto, sin archivo. Notas/reglas antes de sección: PDF escrito. Golden `.crudo`: 1 280 351 bytes; igual al golden salvo obj 47 `(D:…Z)` e `/ID`.
- Review: tests de throw anclados a `/^hay pasos fuera de toda sección$/`; JSDoc del throw; se quitó el badge HTML vacío (rama muerta de `token: ''`).

## Review Triage Log

- `medium` — BH: tests usaban `toThrow` por inclusión. Anclados a `/^hay pasos fuera de toda sección$/` en helper, TOC, HTML, MD y PDF.
- `low` — BH: HTML/MD/PDF no cubren notas antes de sección. Rechazado: el gate está en `numberSteps` (test propio); los exporters no cambiaron esa rama.
- `false` — BH: PDF no afirma que `download` no corre. `exportPdf` espera `buildPdfDoc` y luego descarga; el throw corta antes.
- `low` — BH: CLI imprime stack además del mensaje. Diferido: no reescribir `export-pdf.ts`; el mensaje está, no hay archivo.
- `low` — BH: JSDoc de `numberSteps` no documentaba el throw. Parche: una frase en el comentario.
- `medium` — BH: Implementation Notes duplicadas. Parche: se dejó una sola copia.
- `false` — BH: falta I/O matrix / Code Map / Tasks. Ruta oneshot: esas secciones se omiten a propósito.
- `low` — BH: sin caso `kind` omitido ni `[note, action, section]`. Rechazado: `some(isAuthorshipAction)` ya cubre ambos; no hay fallo de usuario.
- `low` — BH: rama HTML `numText` vacío. Parche: se eliminó el ternario; `token: ''` ya no existe.
