# Sprint Change Proposal — anotación MCP / OffscreenCanvas

**Fecha:** 2026-09-14  
**Iniciativa:** ManualLite v2 (`spec-manuallite-v2`)  
**Alcance:** Minor (ajuste de arquitectura + un constraint de verificación)  
**Camino:** Direct Adjustment

## 1. Issue Summary

`architecture.md` (Brownfield) pedía que el MCP llamara `annotate.ts` tal cual. Eso no corre en Bun: en 1.3.14 no existen `OffscreenCanvas`, `createImageBitmap` ni `ImageBitmap`. Se descubrió al verificar el companion, **antes de escribir stories**.

Evidencia: probe en Bun 1.3.14; `@napi-rs/canvas` 1.0.9 carga con `bun run` en `mcp-server/`; anillo reproducido sobre el paso 0 de `reporte-de-eventos-preprod.manuallite.json` (coinciden a la vista; media 0.71/canal en la caja del halo; línea central `#dc2626` idéntica).

## 2. Impact Analysis

| Artefacto | ¿Existe? | Impacto |
|---|---|---|
| PRD | No | N/A |
| Epics / stories / `sprint-status.yaml` | No (aún no se partió el spec) | N/A — las stories futuras deben nacer ya con AD-7 |
| UX | No | N/A (el anillo no cambia para el humano) |
| `architecture.md` | Sí | **Conflicto.** Brownfield incorrecto; AD-1 demasiado optimista; falta invariante de backends |
| `SPEC.md` | Sí | Capabilities CAP-2..CAP-6 intactas. CAP-1 **intent** sigue válido. CAP-1 **success** y Constraints sí: si no, un test de PNG idéntico fallaría y alguien reimplementaría el anillo o polyfillearía globales |
| Brief `docs/v2-brief.md` | Sí | No. El brief no prescribe OffscreenCanvas |

**Técnico:** `@napi-rs/canvas` ya está en `mcp-server/package.json`. La extensión no lo debe tomar. Extraer `paintClickRing(ctx, …)` al núcleo; `annotate.ts` queda como backend del SW.

## 3. Recommended Approach

**Opción 1 — Direct Adjustment.** Corregir el companion y el kernel ahora, con stories todavía no escritas.

- Rollback: no hay trabajo de implementación que revertir.
- Recorte de MVP: no. CAP-3 (el MCP anota) se mantiene; cambia el cómo.

Esfuerzo: bajo. Riesgo: bajo (decisión ya verificada en runtime). Timeline: nulo.

## 4. Detailed Change Proposals

### Architecture (`architecture.md`) — aplicado

- **AD-1:** el núcleo lleva la *geometría* del anillo, no `OffscreenCanvas`. I/O de canvas de browser fuera del núcleo.
- **AD-7 (nuevo):** función compartida + dos backends; sin polyfill; sin napi-rs en la extensión; paridad visual.
- **MCP / Anotar:** `@napi-rs/canvas`, no “la misma función de `annotate.ts`”.
- **Brownfield:** reemplazado el bullet falso por el split real.

### SPEC (`SPEC.md`) — aplicado (no hay capability nueva ni ID reusado)

- **CAP-1 success:** un cambio del anillo es un solo módulo; paridad visual, no PNG idéntico.
- **Constraints:** geometría en `CanvasRenderingContext2D`; no polyfill; extensión sin `@napi-rs/canvas`; paridad visual (cita AD-7).
- **Non-goals:** polyfill de canvas en Bun; napi-rs en la extensión.
- CAP-2…CAP-6 sin cambios. CAP-3 sigue: el MCP anota; no navega.

### Stories / epics / sprint-status

Nada que editar. Al partir stories, la de anotación MCP debe citar AD-7 y prohibir golden PNG byte-igual.

## 5. Implementation Handoff

**Clasificación:** Minor — el Developer agent, cuando implemente CAP-1/CAP-3.

**Hecho en este correct-course:** `architecture.md`, `SPEC.md`, memlog.

**Pendiente de implementación (no ahora):** extraer la función de geometría; wire OffscreenCanvas (extensión) y `@napi-rs/canvas` (MCP).

**Criterio de éxito:** el MCP anota con la función compartida; la extensión no importa `@napi-rs/canvas`; un recorte del anillo se ve igual al de la extensión; no se exige `Buffer` idéntico.

**Checklist (correct-course)**

- [x] 1.1 Trigger: N/A (no hay story; verificación pre-stories)
- [x] 1.2 Limitación técnica + error de arquitectura
- [x] 1.3 Evidencia Bun + napi-rs
- [N/A] 2.x Epics
- [N/A] 3.1 PRD
- [x] 3.2 Architecture
- [N/A] 3.3 UX
- [x] 3.4 Tests de paridad (no byte a byte)
- [x] 4.1 Direct Adjustment viable (Low / Low)
- [N/A] 4.2 Rollback
- [x] 4.3 MVP intacto
- [x] 4.4 Opción 1
- [N/A] 6.4 sprint-status.yaml
