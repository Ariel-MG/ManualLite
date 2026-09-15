- source_spec: `_bmad-output/implementation-artifacts/spec-widget-grabacion-side-panel.md`
  summary: El GET_STATE inicial del content script puede resolver idle después de un RECORDING_CHANGED de inicio y dejar de capturar clicks.
  evidence: Race preexistente en src/content/index.ts (el listener GET_STATE ya estaba). Se confirmaría si un GET_STATE in-flight aplica paused/recording=false tras un start ya broadcast.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-numeracion-jerarquica-cuerpo-indice.md`
  summary: Si `resolveImageSrc` falla, el PDF ya consumió el número y el índice puede mostrar un paso que el cuerpo omite.
  evidence: Preexistente: antes se hacía `actionNo += 1` y luego `if (!dataUrl) continue`. Sigue en `pdf.ts` tras `numberSteps`. Se confirmaría con una acción con imagen que `resolveImageSrc` rechace.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-numeracion-jerarquica-cuerpo-indice.md`
  summary: El círculo HTML del modo plano (`.num` 30px) puede recortar números de dos dígitos.
  evidence: Preexistente; esta story solo añade `.num.compound` para `N.M.`. Se vería en un manual plano con ≥10 acciones.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-export-falla-acciones-fuera-seccion.md`
  summary: El CLI `scripts/export-pdf.ts` imprime stack de Bun además del mensaje `hay pasos fuera de toda sección`.
  evidence: `buildPdfDoc` no está en try/catch (el parse sí). El throw es de esta story; el mensaje sale y no hay archivo. Envolverlo igualaría el UX del parse error.
  status: done 2026-09-15
