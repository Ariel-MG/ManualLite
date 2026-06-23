# ManualLite

MVP local para crear **manuales de usuario** capturando una pantalla cada vez que haces click, al estilo de [Scribe](https://scribehow.com/). Genera el manual en **PDF (con portada e índice)**, **HTML** y **Markdown**.

Todo corre **100% en tu navegador**: nada se sube a la nube. Las capturas y los manuales se guardan localmente en IndexedDB.

## Cómo funciona

1. Abres el popup de la extensión en cualquier página web y pulsas **Iniciar grabación**.
2. Cada click que hagas en la página crea un **paso**: una captura del viewport con un marcador (anillo + número) sobre el punto donde clickeaste, más un texto automático del tipo _"Haz click en «Guardar»"_.
3. Pulsas **Detener** y se abre el **editor**, donde puedes:
   - reordenar pasos arrastrándolos,
   - editar el texto de cada paso,
   - borrar pasos,
   - poner **título**, **subtítulo** y **logo** de portada.
4. Exportas a **PDF**, **HTML** o **Markdown**.

## Stack

- **bun** como gestor de paquetes y runtime
- **Vite** + **@crxjs/vite-plugin** (extensión Manifest V3)
- **TypeScript** + **React**
- **IndexedDB** (`idb`) para almacenamiento local
- **pdfmake** para el PDF (índice/TOC automático)
- **@dnd-kit** para reordenar pasos
- **jszip** para empaquetar el export de Markdown + imágenes

## Desarrollo

Requiere [bun](https://bun.sh) instalado.

```bash
bun install        # instalar dependencias
bun run dev        # desarrollo con HMR (genera dist/ en caliente)
bun run build      # build de producción a dist/
bun run typecheck  # comprobar tipos
```

> Los iconos placeholder se generan con `bun run scripts/make-icons.ts` (ya incluidos en `public/icons/`).

## Cargar la extensión en Chrome

1. `bun run build` (o `bun run dev`).
2. Ve a `chrome://extensions`.
3. Activa **Modo de desarrollador** (arriba a la derecha).
4. **Cargar descomprimida** → selecciona la carpeta **`dist/`**.
5. Fija el icono de ManualLite en la barra y ábrelo en cualquier web.

Tras un `bun run build` nuevo, pulsa el botón de recargar en la tarjeta de la extensión.

## Estructura

```
src/
├── types.ts              # modelo de datos + protocolo de mensajes
├── db/                   # CRUD sobre IndexedDB (idb)
├── background/           # service worker: captura + anotación + guardado
├── content/              # listener de clicks + indicador "grabando"
├── lib/
│   ├── caption.ts        # texto automático del paso
│   ├── annotate.ts       # dibuja el marcador sobre la captura
│   ├── blob.ts           # utilidades de imágenes/descarga
│   └── exporters/        # pdf.ts · html.ts · markdown.ts
├── popup/                # iniciar/detener grabación
└── editor/               # editar pasos + portada + exportar
```

## Limitaciones (MVP)

- `captureVisibleTab` solo captura **el viewport visible** (no la página completa con scroll). Es lo esperado para manuales paso a paso.
- Chrome **no permite capturar** páginas internas (`chrome://`), la Chrome Web Store ni PDFs abiertos en el navegador. En esas páginas no se generan pasos.
- La captura se toma en `pointerdown`, es decir el **estado previo** al click (con el marcador sobre el destino). Si un click navega muy rápido, ese paso puede perderse.
- El texto del paso es heurístico: revísalo/edítalo en el editor.

## Ideas para v2

- Mejorar los textos de pasos con IA.
- Captura de página completa (full-page) con scroll.
- Edición de la anotación (mover el marcador, recortar la imagen).
- Difuminar zonas sensibles antes de exportar.
