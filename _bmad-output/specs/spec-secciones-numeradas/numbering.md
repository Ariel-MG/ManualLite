# Numeración de secciones y pasos

Los cuatro exporters (PDF, HTML, Markdown, índice) aplican estas reglas igual.

## Con secciones — dos niveles fijos

- Sección *N*: `N. {título}` — ejemplo: `1. Generar factura`
- Paso *M* de esa sección: `N.M. {título}` — ejemplo: `1.1. Abrir Facturas`
- El número del paso hereda el de su sección más su posición dentro de ella (sección 2, primer paso → `2.1.`). No es un contador que se resetea.
- La palabra "Paso" no se usa.
- No hay tercer nivel (`1.2.1`) ni sub-sección.

## Sin secciones — formato plano

- Se conserva el formato actual: `Paso N. {título}`
- Cuerpo e índice.
- No hay sección implícita.

## Índice

- Lista solo secciones, ya numeradas (`1. Generar factura`).
- No lista pasos.
- No es expandible ni multinivel.

## Pasos fuera de sección

- Si el manual tiene al menos una sección, toda acción debe quedar bajo una.
- Acciones antes de la primera sección son error de autoría, no un caso soportado.
- El exporter no inventa numeración para ellas (ni sección implícita, ni `0.1`, ni `Paso N` mezclado).
- El export falla con el mensaje `hay pasos fuera de toda sección` y no produce archivo.
- Notas y reglas antes de la primera sección no disparan el error: nunca se numeran. Solo las acciones cuentan como huérfanas.
- El autor acomoda las acciones en el editor.
