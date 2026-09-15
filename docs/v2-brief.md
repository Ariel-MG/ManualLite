# ManualLite v2 — núcleo compartido y creación por agentes

## Problema
ManualLite hoy solo sabe producir manuales por grabación humana.
La producción real de las actas de Odoo ocurre por fuera: Playwright
recorre la UI, un plan.json describe los pasos, un script arma el
JSON, y ManualLite solo aparece al final para exportar el PDF.

Eso deja dos huecos. Uno, la lógica del manual está duplicada entre
la extensión y los scripts externos, así que cada cambio de formato
hay que hacerlo dos veces. Dos, la biblioteca es una lista plana:
no sabe de qué proyecto viene cada manual ni cómo se produjo, y ya
convive material de Odoo con material de otras apps.

## Enfoque
Un núcleo compartido que define el formato, el modelo de pasos, la
anotación y los exporters. Dos frentes lo consumen: la extensión,
para el humano que graba; y una superficie de creación para agentes,
que hoy solo sabe leer y corregir manuales, no crearlos. Una
biblioteca que organiza por carpeta y guarda procedencia.

Un manual hecho por agente y uno grabado a mano son el mismo objeto.

## Siempre
- El núcleo es la única definición del formato. Ningún frente
  duplica lógica de pasos ni de exportación.
- Los .manuallite.json ya entregados siguen abriendo sin migración
  manual.
- El PDF sigue saliendo solo por export-pdf.ts.
- Lo que hoy funciona (grabar, editar, exportar) sigue funcionando
  igual al terminar.

## Nunca
- La extensión no corre Playwright. La automatización vive del lado
  del agente; la extensión no orquesta navegadores.
- No rediseñar el editor.
- No tocar pdfLayout.ts.
- No cambiar el pipeline de captura: ya se resolvió con el side
  panel.

## Fuera de alcance
- Agrupar varias secciones en un PDF o partir uno en varios.
  Depende de una decisión de cliente que sigue abierta.
- Nube, sincronización, multiusuario.
- Publicación web o help center.
- Traducción de manuales.
- Navegación por carpetas dentro de la extensión. En este corte las
  carpetas son directorios en disco: las ven el MCP y el sistema de
  archivos, no el listado de la extensión, que sigue plano. La
  interfaz de biblioteca se especifica aparte más adelante.
