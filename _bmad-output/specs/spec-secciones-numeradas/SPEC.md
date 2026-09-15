---
id: SPEC-secciones-numeradas
companions:
  - numbering.md
sources:
  - ../../../docs/secciones-numeradas-brief.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# ManualLite — Secciones numeradas en el acta

## Why

Dolor: las actas de entrega de Odoo agrupan varios procedimientos de un mismo módulo en un PDF. ManualLite numera los pasos de corrido (`Paso N. título`), así que un acta de Contabilidad con doce procedimientos es una lista plana: el lector no ve dónde empieza y termina cada uno, y el índice (secciones más todos los pasos) crece hasta volverse inútil. El cliente pidió un PDF por módulo con las secciones bien diferenciadas entre sí.

## Capabilities

- **CAP-1**
  - **intent:** El lector de un acta con varios procedimientos distingue dónde empieza y termina cada uno por la numeración de sección y de paso.
  - **success:** En un manual con `kind: section`, el cuerpo muestra `1. Generar factura` y debajo `1.1. …`, `1.2. …`, luego `2. …` con `2.1. …`. La palabra "Paso" no aparece en ese modo.

- **CAP-2**
  - **intent:** El índice sirve para saltar entre procedimientos, no para listar cada click.
  - **success:** El índice del mismo export lista solo las secciones, ya numeradas (`1. Generar factura`, `2. Agregar nuevo cliente`); no incluye líneas de paso.

- **CAP-3**
  - **intent:** Un manual de un solo procedimiento, sin secciones, se sigue leyendo como hoy.
  - **success:** Un `.manuallite.json` sin `kind: section` exporta `Paso N. título` en cuerpo e índice. No se inventa una sección 1 y el archivo no se reescribe.

- **CAP-4**
  - **intent:** El autor se entera si dejó acciones fuera de toda sección, en vez de que el export las numere en silencio.
  - **success:** Un manual con al menos un `kind: section` y acciones antes de la primera sección no inventa numeración; el export falla o avisa con el mensaje `hay pasos fuera de toda sección`. El autor las acomoda en el editor.

## Constraints

- Los cuatro exporters (PDF, HTML, Markdown, índice) emiten la misma numeración. Reglas en `numbering.md`.
- Los `.manuallite.json` ya entregados abren y exportan sin migración manual. La numeración se deriva al exportar; no se toca `ProjectFile` ni se añade un campo obligatorio de número.
- El PDF sale solo por `scripts/export-pdf.ts`.
- No se toca `src/lib/exporters/pdfLayout.ts`. La paginación no cambia.
- No se rediseña el editor. El cambio es de export, no de UI de edición.
- No hay página separadora por sección. El corte visual es la jerarquía numérica.
- No se toca el pipeline de captura ni `paintClickRing`.
- No hay numeración silenciosa ni sección implícita para acciones antes de la primera sección. Ver `numbering.md`.

## Non-goals

- Partir un manual en varios PDF. Un PDF por módulo.
- Numeración configurable (reiniciar vs continua a lo largo del documento). La jerarquía la resuelve.
- Reordenar o mover secciones desde el editor.
- Índice con pasos, expandible o multinivel.
- Representar en el documento las agrupaciones del catálogo de Contabilidad ("Día a día", "Cierre", "Config (anexo)"). Son organización del autor, no un tercer nivel de numeración.

## Success signal

Un acta tipo Contabilidad (varios `kind: section`, cada una con acciones) exportada a PDF, HTML y Markdown muestra el mismo esquema `1.` / `1.1.` / `2.` / `2.1.`, índice solo con secciones numeradas, sin la palabra "Paso", sin página separadora y con la paginación de hoy. Un `.manuallite.json` ya entregado sin secciones sigue saliendo `Paso 1. …` sin tocar el archivo.

## Assumptions

- El agrupador ya existe: `kind: section` en el JSON. Este corte numera lo que hay; no introduce un tipo nuevo ni un árbol.
- Notas y reglas siguen sin número, como hoy.
