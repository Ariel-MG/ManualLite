- source_spec: `_bmad-output/implementation-artifacts/spec-widget-grabacion-side-panel.md`
  summary: El GET_STATE inicial del content script puede resolver idle después de un RECORDING_CHANGED de inicio y dejar de capturar clicks.
  evidence: Race preexistente en src/content/index.ts (el listener GET_STATE ya estaba). Se confirmaría si un GET_STATE in-flight aplica paused/recording=false tras un start ya broadcast.
