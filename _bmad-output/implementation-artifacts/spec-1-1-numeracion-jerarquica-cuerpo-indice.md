---
title: 'Numeración jerárquica en cuerpo e índice'
type: 'feature'
created: '2026-09-15'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
  - _bmad-output/specs/spec-secciones-numeradas/numbering.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Con varios `kind: section`, el acta sigue saliendo como lista plana (`Paso N. título`) y el índice mezcla secciones sin número con todos los clicks. El lector no ve dónde empieza y termina cada procedimiento.

**Approach:** Derivar al exportar, desde el array plano, etiquetas `N. {título}` / `N.M. {título}` (punto tras el número, sin "Paso") y un índice solo de secciones. Sin `kind: section`, se conserva el formato plano actual. Un helper único alimenta PDF, HTML, Markdown e índice.

## Boundaries & Constraints

**Always:**
- Presencia de al menos un `kind: section` decide el modo. El número del paso es el de su sección más su posición entre acciones de esa sección (sección 2, primer paso → `2.1.`). Dos niveles; notas y reglas sin número; acciones sin imagen no consumen número (igual que hoy).
- Índice con secciones: solo esas secciones ya etiquetadas; no líneas de paso; no prefijo extra de lista (`1.  1. Título`).
- Los cuatro exporters emiten la misma etiqueta. Numeración al exportar; el JSON no se reescribe.
- Story 1.2 (fail si hay acciones huérfanas) no entra. En esta story, si hubiera acciones antes de la primera sección, no se inventa `0.1.` ni se mezcla `Paso N`.
- PDF solo por `scripts/export-pdf.ts`.
- El story 1.1 de los epics describía `crear-factura-cliente` como JSON sin secciones: eso era incorrecto. `crear-factura-cliente.manuallite.json` tiene 4 `kind: section` (Menú de aplicaciones, Contabilidad, Facturas, Factura de cliente). Es el caso CAP-1: el PDF entregado (`crear-factura-cliente.pdf.pdf`) cambiará de `Paso N.` a numeración jerárquica; es el comportamiento buscado. No se usa como golden NFR7.
- CAP-3 / NFR7: `crear-factura-cliente.crudo.manuallite.json` (8 acciones, 0 secciones). Golden generado con el código *antes* de tocar exporters: `tests/goldens/crear-factura-cliente.crudo.golden.pdf`. Tras el cambio, `scripts/export-pdf.ts` sobre el `.crudo` coincide salvo `CreationDate` e `/ID`. El golden no es la salida por defecto del script (no se llama `*.crudo.pdf`).

**Never:**
- No tocar `src/lib/exporters/pdfLayout.ts`, `src/lib/projectFile.ts`, `src/types.ts` (no campo de número), editor, captura, `paintClickRing`, `annotate.ts`.
- No página separadora. No tercer nivel. No índice expandible. No rediseñar el editor.
- No implementar el mensaje `hay pasos fuera de toda sección` ni dejar de producir archivo (story 1.2).
- No tratar `crear-factura-cliente.pdf.pdf` como baseline de no-regresión en esta story.
- No commitear JSON grandes del entregado. El PDF golden `tests/goldens/crear-factura-cliente.crudo.golden.pdf` sí se versiona.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Varias secciones | ≥3 `section`, acciones bajo cada una | Cuerpo `1.` / `1.1.` … `2.` / `2.1.` …; índice solo `1.` `2.` `3.` | N/A |
| Herencia | Sección 2, primera acción | `2.1.`, no `1.` ni `1.1.` | N/A |
| Notas/reglas | note/rule entre acciones | Sin número; no desplazan `N.M.` | N/A |
| Sin secciones | `.crudo` (8 acciones, 0 `section`) | Cuerpo e índice `Paso N. título`; sin sección 1 inventada; PDF = golden salvo `CreationDate`/`ID` | N/A |
| Índice | Mismo walk que el cuerpo | Sin líneas de paso; etiqueta idéntica a la del heading de sección | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/exporters/toc.ts` — `buildTocEntries` / `tocLine`: índice mezcla section sin número + `Paso N.`. Con secciones debe listar solo secciones etiquetadas; plano igual que hoy.
- `src/lib/exporters/pdf.ts` — `tocContent` (~L107) prefija `i+1.`; cuerpo: section heading = caption crudo (~L254); acción `Paso ${actionNo}` sin punto (~L334). Consumir el helper; no tocar `pdfLayout.ts`.
- `src/lib/exporters/html.ts` — TOC inline (no llama `buildTocEntries`); badge `.num` 30px (~L91, CSS L127). Mismo helper; en modo sección el círculo debe admitir `N.M.` (no recortar).
- `src/lib/exporters/markdown.ts` — índice `${i+1}. **${tocLine}**` (~L44); cuerpo `# caption` / `## Paso N. caption` (~L57–74).
- `src/lib/exporters/numbering.ts` — Crear: walk del array plano → etiqueta de sección/acción. Un solo contrato para los cuatro call sites.
- Off-limits: `pdfLayout.ts`, `projectFile.ts`, `types.ts` (`section` ya existe).
- `scripts/export-pdf.ts` — No reescribir. Golden plano: `tests/goldens/crear-factura-cliente.crudo.golden.pdf` (1 280 351 bytes; generado 2026-09-15 con exporters actuales).
- Entregado (no commitear), dir. `.../crear-factura-cliente/`: `.manuallite.json` (14 pasos, 4 secciones) → CAP-1, el PDF entregado cambiará; `.crudo.manuallite.json` (8 acciones, 0 secciones) → CAP-3.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/exporters/numbering.ts` + `numbering.test.ts` -- Walk plano → `N.` / `N.M.` o `Paso N.`; notas no cuentan; herencia `2.1.` -- Un contrato, tests de la matriz
- [ ] `src/lib/exporters/toc.ts` -- Índice: con secciones solo esas etiquetas; sin secciones `Paso N.` -- CAP-2 y CAP-3
- [ ] `src/lib/exporters/pdf.ts` -- Headings e índice usan el helper; quitar prefijo `i+1.` -- Cuerpo PDF = contrato
- [ ] `src/lib/exporters/html.ts` -- TOC y headings; badge no recorta `N.M.` -- Paridad de etiqueta
- [ ] `src/lib/exporters/markdown.ts` -- Índice y headings sin doble numeración -- Paridad MD
- [ ] `bun run scripts/export-pdf.ts` del `.crudo` vs `tests/goldens/crear-factura-cliente.crudo.golden.pdf` -- CAP-3 / NFR7 (salvo `CreationDate` e `/ID`)
- [ ] Export del `.manuallite.json` entregado: índice y cuerpo `1.` / `1.1.` / `2.1.` -- CAP-1; no comparar contra `crear-factura-cliente.pdf.pdf`

**Acceptance Criteria:**
- Given un manual con ≥3 secciones y acciones bajo cada una, when se exporta PDF/HTML/MD, then cuerpo `N.` / `N.M.` con punto, sin "Paso", y la primera acción de la sección 2 es `2.1.`
- Given el mismo export, when se lee el índice, then solo secciones ya numeradas, mismas etiquetas que el cuerpo, sin pasos
- Given `crear-factura-cliente.crudo.manuallite.json`, when se exporta PDF, then `Paso N. título` y el buffer iguala el golden salvo `CreationDate` e `/ID`
- Given `crear-factura-cliente.manuallite.json` (4 secciones), when se exporta, then jerarquía `1.` / `1.1.` / `2.1.`; el PDF entregado deja de ser `Paso N.` a propósito
- Given grabar/editar/exportar, then editor, captura, `paintClickRing`, `ProjectFile` y `pdfLayout.ts` intactos

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Helper sobre el array plano (delimitadores `section`). Acciones numerables = las de hoy (imagen; PDF también `width`/`height`). El índice muestra esa etiqueta, sin `i+1.` ni `<ol>` que recuente. HTML plano: círculo actual; con secciones el badge crece para `N.M.`. PDF plano: no cambiar `Paso N` sin punto; con secciones el heading y `textHeight` usan `N.` / `N.M.` (puede envolver; no se toca `pdfLayout.ts`).

## Verification

**Commands:**
- `npm test` -- `numbering.test.ts` (y toc si aplica) en verde; matriz I/O cubierta
- `npm run typecheck` -- sin errores

**Manual checks:**
- `bun run scripts/export-pdf.ts` del `.crudo` vs `tests/goldens/crear-factura-cliente.crudo.golden.pdf` (solo `CreationDate` e `/ID`)
- Mismo script sobre el `.manuallite.json` entregado: índice solo secciones `1.`–`4.`; primera acción de Contabilidad = `2.1.`
