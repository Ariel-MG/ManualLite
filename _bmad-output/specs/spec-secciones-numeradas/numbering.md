# Numeración de secciones y pasos

Los cuatro exporters (PDF, HTML, Markdown, índice) aplican estas reglas igual.

## Con secciones — dos niveles fijos

- Sección *N*: `N. {título}` — ejemplo: `1. Generar factura`
- Paso *M* de esa sección: `N.M. {título}` — ejemplo: `1.1. Abrir Facturas`
- El número de paso se reinicia en cada sección (`1.1`, `1.2`, luego `2.1`).
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
- El export falla o avisa con el mensaje: `hay pasos fuera de toda sección`.
- El autor las acomoda en el editor.
