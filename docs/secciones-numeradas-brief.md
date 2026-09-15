# ManualLite — Secciones numeradas en el acta

## Problema
Las actas de entrega de Odoo agrupan varios procedimientos de un
mismo módulo en un solo documento. Hoy ManualLite numera los pasos
de corrido con el formato "Paso N. título", así que un acta de
Contabilidad con doce procedimientos produce una lista plana donde
el lector no sabe dónde empieza y termina cada uno, y el índice
crece hasta volverse inútil.

El cliente pidió un PDF por módulo con las secciones bien
diferenciadas entre sí.

## Enfoque
Numeración jerárquica de dos niveles. La sección lleva su número y
cada paso hereda el de su sección más su posición dentro de ella.

  Módulo Contabilidad
  1. Generar factura
     1.1. ...
     1.2. ...
  2. Agregar nuevo cliente
     2.1. ...

El índice lista solo las secciones, no los pasos. La jerarquía
numérica es la que diferencia visualmente los bloques: no hay página
separadora ni cambio de paginación.

Sin secciones, el formato plano actual se conserva (`Paso N. título`).
No hay sección implícita.

## Siempre
- Los cuatro exporters (PDF, HTML, Markdown, índice) usan la misma
  numeración.
- Los .manuallite.json ya entregados siguen abriendo y exportando
  sin migración manual.
- El PDF sigue saliendo solo por export-pdf.ts.
- Si un manual con secciones tiene acciones antes de la primera,
  el export falla o avisa con el mensaje "hay pasos fuera de toda
  sección". El autor las acomoda en el editor.

## Nunca
- No se toca pdfLayout.ts. La paginación no cambia.
- No se rediseña el editor.
- No hay página separadora por sección.
- No se toca el pipeline de captura ni el núcleo de formato
  (ProjectFile, paintClickRing).
- No hay numeración silenciosa para pasos fuera de toda sección.

## Fuera de alcance
- Partir un manual en varios PDF. El cliente ya decidió un PDF por
  módulo.
- Numeración configurable (reiniciar vs continua). La jerarquía la
  resuelve.
- Reordenar o mover secciones desde el editor.
- Índice con pasos, expandible o multinivel.
- Representar en el documento las agrupaciones del catálogo de
  Contabilidad ("Día a día", "Cierre", "Config (anexo)"). Son
  organización del autor, no un tercer nivel de numeración.

## Decisiones
- MANUALES SIN SECCIONES: conservan el formato plano actual
  (`Paso N. título`). No hay sección implícita.
- FORMATO DEL TÍTULO: punto en los dos niveles (`1. Generar factura`,
  `1.1. Abrir Facturas`). Desaparece la palabra "Paso" en el modo
  jerárquico.
- PROFUNDIDAD: dos niveles fijos (sección.paso). No hay sub-secciones.
- PASOS ANTES DE LA PRIMERA SECCIÓN: error de autoría. El exporter
  no inventa numeración; falla o avisa ("hay pasos fuera de toda
  sección").
