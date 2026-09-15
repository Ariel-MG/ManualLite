---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/specs/spec-secciones-numeradas/SPEC.md
  - _bmad-output/specs/spec-secciones-numeradas/numbering.md
  - docs/secciones-numeradas-brief.md
scope: CAP-1, CAP-2, CAP-4
acceptanceGuarantees:
  - CAP-3
---

# extenciones - Epic Breakdown (secciones numeradas)

## Overview

Desglose de epics y stories para ManualLite — secciones numeradas en el acta. El contrato es el SPEC + `numbering.md`; no hay PRD ni contrato UX.

Las cuatro capabilities entran en este inventario. **CAP-3 no se parte como epic**: es garantía de no regresión (manuales sin secciones conservan `Paso N. título`) y entra como criterio de aceptación.

Este archivo no reemplaza `_bmad-output/planning-artifacts/epics.md` (inventario v2 / CAP-1).

## Requirements Inventory

### Functional Requirements

FR1: En un manual con `kind: section`, el cuerpo muestra cada sección como `N. {título}` y cada acción como `N.M. {título}` (punto tras el número en ambos niveles). La palabra "Paso" no aparece. El número del paso hereda el de su sección más su posición dentro de ella (sección 2, primer paso → `2.1.`). Dos niveles fijos; no hay `1.2.1`. (CAP-1)

FR2: El índice del mismo export lista solo las secciones, ya numeradas (`1. Generar factura`); no incluye líneas de paso. No es expandible ni multinivel. (CAP-2)

FR3: Si el manual tiene al menos un `kind: section` y acciones antes de la primera sección, el export falla con el mensaje `hay pasos fuera de toda sección` y no produce archivo. No inventa numeración. Notas y reglas antes de la primera sección no disparan el error. (CAP-4)

### NonFunctional Requirements

NFR1 (CAP-3): Un `.manuallite.json` sin `kind: section` exporta `Paso N. título` en cuerpo e índice. No se inventa una sección 1 y el archivo no se reescribe.

NFR2: Los cuatro exporters (PDF, HTML, Markdown, índice) emiten la misma numeración.

NFR3: Los `.manuallite.json` ya entregados abren y exportan sin migración manual. La numeración se deriva al exportar; no se toca `ProjectFile` ni se añade un campo obligatorio de número.

NFR4: El PDF sale solo por `scripts/export-pdf.ts`.

NFR5: No se toca `src/lib/exporters/pdfLayout.ts`. La paginación no cambia. No hay página separadora por sección.

NFR6: No se rediseña el editor. No se toca el pipeline de captura ni `paintClickRing`.

NFR7: Cada story que toque el render del título o del índice incluye un criterio de comparación contra el PDF ya generado de `crear-factura-cliente`: mismo resultado salvo `CreationDate` e `/ID`.

### Additional Requirements

- Brownfield: el agrupador ya existe como `kind: section` en el JSON. Este corte numera lo que hay; no introduce un tipo nuevo ni un árbol.
- Notas y reglas siguen sin número, como hoy.
- Fuera de alcance: partir un manual en varios PDF; numeración configurable (reiniciar vs continua); reordenar o mover secciones desde el editor; índice con pasos, expandible o multinivel; representar en el documento las agrupaciones del catálogo de Contabilidad ("Día a día", "Cierre", "Config (anexo)").
- Starter template: ninguno (brownfield).
- Este inventario vive en `epics-secciones-numeradas.md`; no reemplaza `epics.md`.

### UX Design Requirements

Ninguno. Este corte no toca UI; no hay contrato UX.

### FR Coverage Map

FR1: Epic 1 — numeración jerárquica en el cuerpo (`N.` / `N.M.`)
FR2: Epic 1 — índice solo con secciones numeradas
FR3: Epic 1 — el export falla si hay acciones huérfanas; no produce archivo

## Epic List

### Epic 1: El lector distingue procedimientos en el acta
Tras este epic, un PDF por módulo se lee por secciones (`1.` / `1.1.`), el índice solo lista esas secciones, y si hay acciones antes de la primera sección el export falla sin producir archivo. Un manual sin secciones sigue saliendo `Paso N. título`.
**FRs covered:** FR1, FR2, FR3

## Epic 1: El lector distingue procedimientos en el acta

Tras este epic, un PDF por módulo se lee por secciones (`1.` / `1.1.`), el índice solo lista esas secciones, y si hay acciones antes de la primera sección el export falla sin producir archivo. Un manual sin secciones sigue saliendo `Paso N. título`.

### Story 1.1: Numeración jerárquica en cuerpo e índice

As a lector de un acta de módulo,
I want que secciones y pasos lleven números `1.` / `1.1.` y que el índice liste solo las secciones,
So that vea dónde empieza y termina cada procedimiento sin una lista plana de clicks.

**Acceptance Criteria:**

**Given** un manual con varios `kind: section` y acciones bajo cada una
**When** se exporta a PDF, HTML y Markdown
**Then** el cuerpo muestra `N. {título}` en secciones y `N.M. {título}` en acciones, con punto tras el número, sin la palabra "Paso" (FR1)
**And** el número del paso hereda el de su sección más su posición dentro de ella (sección 2, primer paso → `2.1.`); no es un contador que se resetea (FR1)
**And** el índice lista solo esas secciones ya numeradas; no incluye líneas de paso (FR2)
**And** los cuatro exporters emiten la misma numeración (NFR2)
**And** notas y reglas siguen sin número
**And** no hay página separadora ni cambio de paginación; no se toca `pdfLayout.ts` (NFR5)

**Given** un manual con al menos tres secciones, cada una con acciones
**When** se exporta
**Then** la primera acción de la segunda sección se numera `2.1.`, no `1.` ni `1.1.` (FR1)

**Given** un `.manuallite.json` sin `kind: section` (entregado `crear-factura-cliente`)
**When** se exporta
**Then** cuerpo e índice conservan `Paso N. título`; no se inventa una sección 1 y el archivo no se reescribe (NFR1 / CAP-3)
**And** el PDF por `scripts/export-pdf.ts` coincide con el PDF ya generado salvo `CreationDate` e `/ID` (NFR4, NFR7)

**Given** la extensión tras el cambio
**When** se graba, edita y exporta
**Then** no se rediseña el editor ni se toca captura, `paintClickRing` ni `ProjectFile` (NFR3, NFR6)

### Story 1.2: El export falla si hay acciones fuera de toda sección

As a autor del acta,
I want que el export falle si dejé acciones antes de la primera sección,
So that no salga un PDF numerado en silencio que pueda mandar al cliente.

**Acceptance Criteria:**

**Given** un manual con al menos un `kind: section` y una o más acciones antes de la primera sección
**When** se exporta (PDF, HTML o Markdown)
**Then** el export falla con el mensaje `hay pasos fuera de toda sección` y no produce archivo (FR3)
**And** no inventa numeración para esas acciones (ni sección implícita, ni `0.1.`, ni `Paso N` mezclado) (FR3)

**Given** un manual con al menos un `kind: section` y solo notas o reglas (sin acciones) antes de la primera sección
**When** se exporta
**Then** el export no falla: notas y reglas nunca se numeran y no cuentan como huérfanas (FR3)

**Given** un manual con secciones bien formadas (todas las acciones bajo una sección), como en la story 1.1
**When** se exporta
**Then** el export no falla y la numeración jerárquica de 1.1 se conserva

**Given** un `.manuallite.json` sin `kind: section` (entregado `crear-factura-cliente`)
**When** se exporta
**Then** no se trata como error de autoría: cuerpo e índice siguen `Paso N. título` (NFR1 / CAP-3)
**And** el PDF por `scripts/export-pdf.ts` coincide con el PDF ya generado salvo `CreationDate` e `/ID` (NFR4, NFR7)

**Given** la extensión tras el cambio
**When** el autor acomoda esas acciones en el editor y vuelve a exportar
**Then** no se rediseña el editor ni se toca captura, `paintClickRing`, `ProjectFile` ni `pdfLayout.ts` (NFR3, NFR5, NFR6)
