---
epic: 1
date: 2026-09-15
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospectiva — Epic 1: El lector distingue procedimientos en el acta

## Epic summary

- **Epic:** 1 — El lector distingue procedimientos en el acta (`_bmad-output/planning-artifacts/epics-secciones-numeradas.md` L72–74, L76–138). Cubrió FR1, FR2, FR3. CAP-3 entra como NFR / no-regresión, no como epic aparte.
- **Criterios:** **declared** (AC del epic + stories 1.1 y 1.2 + `_bmad-output/specs/spec-secciones-numeradas/SPEC.md` / `numbering.md`).
- **Modo:** sprint. `_bmad-output/implementation-artifacts/sprint-status.yaml` existe: v2 es `epic-1`, este inventario se rastrea como `epic-2` para no colisionar `1-1`/`1-2`. Ariel declaró 1.1 y 1.2 completadas; ambas specs llevan `status: done`. `epic-2-retrospective: done`.
- **Archivo:** `epic-1-secciones-numeradas-retro-2026-09-15.md` a propósito: `epic-1-retro-2026-09-15.md` ya es la retro del epic 1 de `epics.md`.
- **Rango git:** `e168d96b5ea33c5507d66241f2bab55e096d68f0^..HEAD`. `git_evidence.py`: `commit_count: 3`, `merge_count: 0`, `merges_measured: 0`, `binary_revisions: 1` (`tests/goldens/crear-factura-cliente.crudo.golden.pdf`). Solo `e168d96` nombra `1.1` en el subject; `5dcc16d` y `a2e6c50` tienen `stories: []`. Atribución manual:
  - 1.1 spec `e168d96` — docs: spec 1.1 de numeración jerárquica y golden del modo plano
  - 1.1 impl `5dcc16d75379f0ba7993f0287fa526e5ce1ddd6d` — feat: numeración jerárquica N. / N.M. en cuerpo e índice
  - 1.2 `a2e6c50c0369bf11d3c469c337cc88b69266b63b` — feat: fallar el export si hay acciones fuera de toda sección
- **Inventario disponible:**
  - Epic spec: `_bmad-output/planning-artifacts/epics-secciones-numeradas.md`
  - Contrato: `_bmad-output/specs/spec-secciones-numeradas/SPEC.md`, `numbering.md`
  - Contexto: `_bmad-output/implementation-artifacts/epic-secciones-numeradas-context.md` (antes `epic-1-context.md`, que pisó el contexto v2; recuperado en `epic-manuallite-v2-context.md`)
  - Stories: `spec-1-1-numeracion-jerarquica-cuerpo-indice.md` (`done`), `spec-1-2-export-falla-acciones-fuera-seccion.md` (`done`)
  - Diff: 14 paths en `files`; golden PDF binario
  - Session logs: [bmad-build story 1.1](d086de8e-907e-4c5c-9bba-f4844356805f), [bmad-build story 1.2](94dd48f1-cc25-4764-a30d-5454cf773b2e)
  - Retro previa: `_bmad-output/implementation-artifacts/epic-1-retro-2026-09-15.md` (inventario distinto)
  - Entregado (fuera del repo): `crear-factura-cliente.manuallite.json` y `.crudo.manuallite.json`
- **Faltante:** atribución automática de 1.1-impl y 1.2 (subjects sin `1.x`); ejercicio UI (NFR6: editor no tocado).
- **Phase 3:** omitida (no se pidió party-mode).
- **bmad-review:** lentes `adversarial`, `edge-case-hunter`, `verification-gap` sobre `e168d96^..HEAD` + working tree. Alcance: diff de exporters/helper/tests/specs, no el resto del repo.

## Findings

### Aggregate views

#### Architecture delta

Derivado de los paths del rango (no hay dependency-cruiser/madge; alcance: grep de imports en `src/lib/exporters`).

**Antes:** PDF/HTML/Markdown/TOC numeraban por su cuenta (`Paso ${actionNo}`, `i+1.` en índice). No había helper compartido.

**Después:**

- `src/lib/exporters/numbering.ts` (`numberSteps`) ← `pdf.ts`, `html.ts`, `markdown.ts`, `toc.ts`
- `toc.ts` `buildTocEntries` llama a `numberSteps` (`toc.ts:17`)
- HTML **no** importa `toc.ts`: construye el índice en el walk (`html.ts:35–48, 70–74, 163`)
- `pdf.ts` llama `numberSteps` en `tocContent` (`pdf.ts:109`) y otra vez en el cuerpo (`pdf.ts:255`); `markdown.ts:43` + `buildTocEntries` (`markdown.ts:47`) = doble walk
- `scripts/export-pdf.ts` (WT) importa `ORPHAN_STEPS_MESSAGE` desde `numbering.ts`
- Off-limits sin diff en el rango: `pdfLayout.ts`, `projectFile.ts`, `types.ts`, `src/editor` (salvo que ExportBar no cambió), captura, `paintClickRing` (`git diff --stat e168d96^..HEAD` vacío sobre esos paths)

Nueva dependencia cruzada: ninguna hacia MCP/editor. El CLI ahora depende del mensaje de autoría (WT).

#### Duplication map

- Índice: `buildTocEntries` (PDF/MD) vs walk inline HTML (`html.ts:44–48`). Spec 1.1 Review Triage (`false` — BH: el contrato es `numberSteps`, no `buildTocEntries`). Sigue igual tras 1.2.
- `requireSize: true` solo en PDF (`numbering.ts:16–17`, `pdf.ts:109,255`). HTML/MD numeran acciones con imagen aunque falte width/height. Declarado en Design Notes 1.1.
- Chrome de título: MD usa `numbered.label` (`markdown.ts:83`); PDF plano usa `token` + tres espacios (`pdf.ts:338–340`); HTML plano badgea `actionNo` (`html.ts:92–94`). CAP-3 del PDF es excepción explícita (golden).

#### God-class / size growth

Churn no-merge (`git_evidence.files`): volumen alto en tests y specs (`numbering.test.ts` net +190, `pdf.test.ts` +106, `html.test.ts` +86, `markdown.test.ts` +83, spec 1.1 +122). Producción: `numbering.ts` +123 (archivo nuevo, 123 L actuales), `html.ts` net +6, `markdown.ts` +9, `pdf.ts` +9, `toc.ts` −2. `pdf.ts` sigue en 507 L; el epic apenas lo tocó. Ningún god-class nuevo.

#### Pattern divergence

- Errores CLI: parse (`export-pdf.ts:22–27`) traga cualquier fallo a una línea; autoría (WT `export-pdf.ts:45–54`) solo iguala `ORPHAN_STEPS_MESSAGE` y re-lanza el resto. Asimetría intencional tras el cierre del diferido.
- Tests: Vitest en `src/**/*.test.ts`; el contrato CLI vive en `mcp-server/src/manual.test.ts` (`bun:test`), que CI sí corre (`.github/workflows/build.yml:30–31`).
- Subjects git: F3 de la retro previa pedía `1.x` en el subject; 1.1-impl y 1.2 no lo llevan (`git_evidence.commits[].stories` vacío salvo spec 1.1).
- Colisión de inventario: `epic-1-context.md` se reescribió (`git_evidence` +33/−25) sobre el contexto del epic 1 de `epics.md`. Mismo número, dos cortes.

#### Spec-to-implementation reconciliation

| Contrato | As-built | Disposición |
|---|---|---|
| FR1: cuerpo `N.` / `N.M.`, sin "Paso", herencia `2.1.` | `numbering.ts` + tests `numbering.test.ts:47–67`; exporters consumen `label`/`token` | Criterio cumplido |
| FR2: índice solo secciones numeradas | TOC PDF/MD vía `buildTocEntries`; HTML walk propio, test `html.test.ts:64–77` | Criterio cumplido (HTML no comparte el adaptador) |
| FR3: huérfanas → `hay pasos fuera de toda sección`, sin archivo | Throw en `numberSteps` (`numbering.ts:84–87`); tests helper/HTML/MD/PDF; CLI WT mensaje limpio, `NO_FILE` | Criterio cumplido en WT; HEAD aún imprime stack de Bun |
| NFR1 / CAP-3: sin secciones → `Paso N. título`; golden | `numbering.test.ts:135–160`; `pdf.test.ts:92–98`; golden comparado en sesión 1.1/1.2 (bytes 1 280 351; solo obj 47 `(D:)` e `/ID`) | Criterio cumplido; **no está en CI** (JSON `.crudo` fuera del repo) |
| NFR2: cuatro exporters, misma numeración | Mismo helper; `requireSize` y chrome (badge/`Paso N` sin punto) divergen a propósito | Desviación aceptada (1.1 Design Notes) |
| NFR4: PDF solo por `export-pdf.ts` | Script intacto como camino; WT añade catch de autoría | Criterio cumplido |
| NFR5: no tocar `pdfLayout.ts` | Diff vacío | Criterio cumplido |
| NFR6: no editor / captura / `paintClickRing` | Diff vacío | Criterio cumplido |
| NFR3: no `ProjectFile` ni campo de número | Diff vacío | Criterio cumplido |
| Spec 1.2 Implementation Notes: «no reescribir `export-pdf.ts`» | WT reescribe el catch de `buildPdfDoc` | **Reconciliar spec** (A2) |
| Spec 1.1 Never: no implementar el throw | 1.2 lo implementa en el mismo helper | Desviación aceptada (corte de stories; 1.1 lo aplazaba) |

### Diff-scope review (bmad-review)

Lentes corridas sobre el diff del rango + WT. Hallazgos no verificables contra el archivo se descartan.

#### Adversarial / verification-gap (consolidados)

- **VG1 — CAP-3 golden fuera de CI.** `tests/goldens/crear-factura-cliente.crudo.golden.pdf` no lo lee ningún `*.test.ts`. El `.crudo.manuallite.json` no está en el repo (spec 1.1 Never). `pdf.test.ts:92–98` solo mira `Paso 1` + tres espacios en un doc sintético. **defer.** Spec lo puso en Manual checks; se verificó en sesión.
- **VG2 — HTML/MD plano sin test de exporter.** `html.test.ts` y `markdown.test.ts` solo jerárquico + throw. El chrome CAP-3 (`<ol>`, `i+1.`, badge `.num`) no se ejecuta. `numbering.test.ts` plano no llama a `exportHtml`/`exportMarkdown`. **defer.**
- **VG3 — TOC PDF plano.** `pdf.ts:116` `` `${i+1}.  ${line}` ``; `pdf.test.ts` plano no llama a `tocLines`. **defer.** El golden bytes es la red de seguridad, y no corre en CI (VG1).
- **VG4 — Cuerpo de sección no afirmado en exporters.** Tests clavan `1. Alfa` en el índice y `1.1.` en la acción; no hay `h2.section` / `# 1. Alfa` / `sectionHeading`. **defer.** El helper sí afirma `1. Alfa`.
- **ADV — rama `numbered.token` falsy en PDF** (`pdf.ts:343–348`). Tras 1.2, `numberSteps` ya no emite `token: ''`. Rama muerta. **accept as-is** (código muerto, no cambia el contrato actual).
- **ADV — HTML no usa `buildTocEntries`.** Verificado `html.ts` importa solo `numberSteps`. 1.1 lo aceptó. **accept as-is.**
- **ADV — `requireSize`.** Verificado. 1.1 lo declaró. **accept as-is.**
- **ADV — spec 1.2 vs catch CLI.** `spec-1-2-…md` L26 sigue diciendo no reescribir el script; WT lo reescribe. **fix now** (reconciliar notas, no revertir el catch).

#### Edge-case hunter

- **`resolveImageSrc` vacío tras numerar** (`pdf.ts:334–335`). Comentario L330–331 («el número solo se consume si el paso llega al PDF») es falso: `numberSteps` ya corrió en L255. Ya está en `deferred-work.md` (spec 1.1). **defer** (preexistente; no reabrir).
- **CLI catch por igualdad de string** (WT `export-pdf.ts:48–54`). Un wrap del Error volvería a mostrar stack. **accept as-is** para este corte (el mensaje es el contrato).
- **Badge HTML 30px en plano** (`html.ts` CSS `.num` 30px). Ya en `deferred-work.md` (spec 1.1). **defer.**
- **Caption de sección solo espacios** (`numbering.ts:97` `caption \|\| 'Sección'`). 1.1 lo rechazó como low. **accept as-is.**

### Story-boundary (1.1 ↔ 1.2)

1.1 dejó huérfanas con `token: ''` y prohibió el throw. 1.2 borró esa rama y lanza. Restaurar `token: ''` haría fallar `numbering.test.ts:108–111` y los exporters. El PDF aún tiene el fallback de caption suelto (`pdf.ts:343–348`) que 1.1 necesitaba y 1.2 ya no produce. No hay fallo de usuario hoy; hay chrome muerto en un solo exporter.

## Behavior verification

Ejercido en las sesiones 1.1 y 1.2 (no sustituye CI para CAP-3 bytes).

| Flujo | Qué se corrió | Observado |
|---|---|---|
| Unit exporters + helper | `npm test` (vitest): 14 files, 58 tests | Verde |
| Typecheck | `npm run typecheck` | Verde |
| CLI huérfana (WT) | `bun run scripts/export-pdf.ts tmp/orphan.manuallite.json …` | stderr exacto `hay pasos fuera de toda sección`; exit 1; no hay PDF |
| CLI notas antes de sección | `export-pdf.ts` sobre fixture note/rule + section | `PDF escrito en: …` |
| CAP-3 golden | `export-pdf.ts` del `.crudo` vs `tests/goldens/crear-factura-cliente.crudo.golden.pdf` | Mismo tamaño 1 280 351; igual tras normalizar `(D:…Z)` obj 47 e `/ID` |
| MCP/CLI tests | `cd mcp-server && bun test src/manual.test.ts` | 9 pass, incl. mensaje limpio sin `\bat\s` |
| UI editor | no se tocó (NFR6); **no se abrió Chrome** | N/A |

No se grabó un click ni se exportó desde `ExportBar` en el navegador. El alert `No se pudo exportar: ` + mensaje no se vio en runtime; solo se leyó `ExportBar.tsx:45`.

## Previous-retro follow-through

`sprint-status.yaml` **no existe**, así que no hay `action_items` que Phase 5 pueda nombrar con `--set-action-status`. Nada que ofrecer a ese flag.

La retro previa (`epic-1-retro-2026-09-15.md`, otro inventario) listó ítems en prosa. Chequeo contra el código de ahora:

| Ítem (texto de esa retro) | ¿Aterrizó? | Evidencia | Status propuesto |
|---|---|---|---|
| F1 — Typecheck MCP en CI | no evidence found as done | `.github/workflows/build.yml:24–31`: `bun run typecheck` en raíz; MCP solo `bun run test` | (ninguno: no hay id en yaml) |
| F2 — `Number.isFinite` en `paintClickRing` | no evidence found as done | `grep Number.isFinite src/lib/clickRing.ts` → 0 matches | — |
| F3 — `sprint-status.yaml` + subjects `1.x` | yaml creado 2026-09-15; subjects `1.x` no | `sprint-status.yaml`; commits 1.1-impl y 1.2 siguen sin `1.x` en el subject | `done` (solo el archivo; subjects quedan) |
| F4 — Smoke de grabación | no aplica a este epic | este corte no tocó `annotate.ts` / `session.ts` | — |

## Action items

Aterrizados 2026-09-15 (A1–A3). F1/F2/F4 del epic v2 siguen abiertos en `sprint-status.yaml`.

1. **A1 — Commitear el catch CLI.** Owner: Ariel. **Hecho 2026-09-15:** `export-pdf.ts` captura `ORPHAN_STEPS_MESSAGE`; test CLI en `mcp-server/src/manual.test.ts`.
2. **A2 — Reconciliar spec 1.2.** Owner: Ariel. **Hecho 2026-09-15:** Implementation Notes describen el catch; se retiró «no reescribir `export-pdf.ts`».
3. **A3 — No reutilizar `epic-1-*` entre inventarios.** Owner: Ariel. **Hecho 2026-09-15:** contextos en `epic-manuallite-v2-context.md` (recuperado de `14387cc`) y `epic-secciones-numeradas-context.md`. `epic-1-context.md` eliminado.

No se abren ítems nuevos por VG1–VG4 ni por `resolveImageSrc` / badge 30px: ya están en `deferred-work.md` o son deuda de test que no tumba un AC declarado.

## Acceptance verdict

**accepted-with-open-items** (machine). Criterios **declared**.

El chequeo `pending_stories` quedó cubierto al crear `sprint-status.yaml` (este inventario = `epic-2`). Las dos specs dicen `done`. Ariel puede overridear.

Evidencia de cumplimiento: helper único `numberSteps`; cuerpo `N.` / `N.M.` y `2.1.`; índice de secciones; throw `hay pasos fuera de toda sección` sin archivo; plano `Paso N. título` y golden CAP-3 en sesión; `pdfLayout.ts` / editor / `ProjectFile` / `paintClickRing` sin diff. A1–A3 aterrizados. Quedan ítems del epic v2 (F1 typecheck MCP, F2 `Number.isFinite`, F4 smoke) y deuda ya en `deferred-work.md` (`resolveImageSrc`, badge 30px).

## Open questions

- ¿CAP-3 en CI exige un `.crudo` recortado en el repo, o sigue siendo check manual con el entregado fuera?
