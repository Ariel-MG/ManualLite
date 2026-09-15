# ManualLite MCP

Servidor [MCP](https://modelcontextprotocol.io) para **revisar manuales de ManualLite con IA**
desde Claude Desktop: revisar pasos, escritura y ortografía, y revisar las imágenes para sugerir
captions.

Lee los archivos `.manuallite.json` que exporta la extensión (incluyen texto e imágenes) y puede
escribir un archivo corregido reimportable.

## Requisitos

- [bun](https://bun.sh) instalado.
- Un manual exportado desde la extensión (botón de exportar → `*.manuallite.json`).

## Instalación

```bash
cd mcp-server
bun install
bun run typecheck   # opcional: comprobar tipos
```

## Configurar en Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) y añade:

```json
{
  "mcpServers": {
    "manuallite": {
      "command": "bun",
      "args": ["run", "/Users/arielmg/Documents/dev/extenciones/mcp-server/src/index.ts"]
    }
  }
}
```

Reinicia Claude Desktop. Aparecerá el servidor **manuallite** con sus herramientas.

## Herramientas

| Herramienta | Para qué sirve |
|---|---|
| `list_manuals` | Lista los `*.manuallite.json` de un directorio (p. ej. `~/Downloads`) con título y nº de pasos. |
| `load_manual` | Devuelve los metadatos y todos los pasos como texto (sin base64). Insumo para revisar pasos, redacción y ortografía. |
| `get_step_image` | Devuelve la imagen de un paso para que Claude la *vea* y sugiera caption/description. |
| `write_corrected_manual` | Aplica correcciones de texto por índice de paso y escribe un nuevo `*.revisado.manuallite.json` (conserva imágenes y demás campos). |

## Flujo de uso

1. Exporta el manual desde la extensión.
2. En Claude Desktop, pide algo como:
   _"Lista los manuales en mi carpeta de Descargas, revisa los pasos y la ortografía del manual X,
   mira las imágenes y sugiere mejores captions, y escribe un archivo corregido."_
3. Claude usará `list_manuals` → `load_manual` → `get_step_image` → `write_corrected_manual`.
4. **Reimporta** el `*.revisado.manuallite.json` en la extensión (función Importar) para aplicar
   los cambios. Las imágenes se conservan intactas.

## Prueba local sin Claude Desktop

Con el [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
bunx @modelcontextprotocol/inspector bun run src/index.ts
```

## Notas

- Solo lee/escribe archivos en disco; no usa red ni credenciales.
- El formato del archivo lo define el núcleo `src/lib/projectFile.ts` (el mismo que usa la extensión).
  Carga, validación y guardado importan `src/lib/projectFile.ts` del árbol del repo; no basta copiar solo `mcp-server/`.
  No hay un esquema espejo en el servidor.
