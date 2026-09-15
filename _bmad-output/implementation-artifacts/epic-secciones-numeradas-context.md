# Epic 1 Context: El lector distingue procedimientos en el acta

<!-- Inventario: _bmad-output/planning-artifacts/epics-secciones-numeradas.md. No escribir epic-N-context.md genérico: colisiona con ManualLite v2. -->
<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change; el output debe ser este path, no epic-1-context.md. -->

## Goal

Un acta de módulo con varios procedimientos deja de leerse como una lista plana de clicks. Tras este epic, un manual con `kind: section` exporta cuerpo `N.` / `N.M.`, índice solo con esas secciones, y si hay acciones antes de la primera sección el export falla sin producir archivo. Un manual sin secciones sigue saliendo `Paso N. título`. El lector ve dónde empieza y termina cada procedimiento; el autor no manda al cliente un PDF numerado en silencio.

## Stories

- Story 1.1: Numeración jerárquica en cuerpo e índice
- Story 1.2: El export falla si hay acciones fuera de toda sección

## Requirements & Constraints

Con al menos un `kind: section`, el cuerpo muestra cada sección como `N. {título}` y cada acción como `N.M. {título}` (punto tras el número en ambos niveles). La palabra "Paso" no aparece. El número del paso hereda el de su sección más su posición dentro de ella (sección 2, primer paso → `2.1.`); no es un contador global ni un `1.1.` que se reinicia como si no hubiera sección. Dos niveles fijos: no hay `1.2.1` ni sub-sección.

El índice del mismo export lista solo las secciones, ya numeradas. No incluye líneas de paso. No es expandible ni multinivel.

Notas y reglas nunca se numeran.

Si el manual tiene al menos una sección y hay acciones antes de la primera, el export (PDF, HTML o Markdown) falla con el mensaje exacto `hay pasos fuera de toda sección` y no produce archivo. No inventa numeración (ni sección implícita, ni `0.1.`, ni `Paso N` mezclado). Notas y reglas antes de la primera sección no disparan el error: solo las acciones cuentan como huérfanas. El autor las acomoda en el editor existente.

Si el JSON no tiene ningún `kind: section`, cuerpo e índice conservan `Paso N. título`. No se inventa una sección 1 y el archivo no se reescribe. Eso no es error de autoría.

Los cuatro exporters (PDF, HTML, Markdown, índice) emiten la misma numeración. El PDF sale solo por `scripts/export-pdf.ts`. No se toca `src/lib/exporters/pdfLayout.ts`: la paginación no cambia y no hay página separadora por sección; el corte visual es la jerarquía numérica.

No se rediseña el editor. No se toca el pipeline de captura ni `paintClickRing`. No se toca `ProjectFile` ni se añade un campo obligatorio de número: la numeración se deriva al exportar. Los `.manuallite.json` ya entregados abren y exportan sin migración manual.

El entregado `crear-factura-cliente.manuallite.json` tiene 4 `kind: section`; no es el fixture del modo plano. Su PDF entregado cambiará de `Paso N.` a `N.` / `N.M.` (CAP-1). El golden del modo plano (CAP-3 / NFR7) es el PDF generado del `.crudo` antes de cambiar exporters: `tests/goldens/crear-factura-cliente.crudo.golden.pdf` (salvo `CreationDate` e `/ID`).

Fuera de alcance: partir un manual en varios PDF; numeración configurable (reiniciar vs continua); reordenar o mover secciones desde el editor; índice con pasos, expandible o multinivel; representar en el documento las agrupaciones del catálogo de Contabilidad ("Día a día", "Cierre", "Config (anexo)") como tercer nivel.

## Technical Decisions

El agrupador ya existe como `kind: section` en el JSON. Este corte numera lo que hay; no introduce un tipo nuevo ni un árbol.

Hay dos modos, no un híbrido: con secciones, jerarquía `N.` / `N.M.` sin "Paso"; sin secciones, formato plano actual. La presencia de `kind: section` decide el modo.

Las reglas de numeración son un contrato único para los cuatro exporters. Se aplican al exportar, no se persisten en el archivo.

Pasos antes de la primera sección son error de autoría, no un caso soportado. Fallar cerrado: mensaje fijo, sin archivo, sin numeración inventada.

CAP-3 (manuales sin secciones) no es un epic aparte: es garantía de no regresión en las stories de este epic.

## Cross-Story Dependencies

1.2 asume que un manual bien formado (todas las acciones bajo una sección) conserva la numeración de 1.1 y no falla.

Ambas stories deben preservar el modo plano en el `.crudo` (golden) y aplicar jerarquía al `.manuallite.json` entregado. El fallo de autoría solo aplica cuando ya hay al menos una sección.
