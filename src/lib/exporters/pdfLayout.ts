// Medición y empaquetado del PDF.
//
// pdfmake no sabe rellenar una página: un bloque `unbreakable` que no cabe en el
// espacio restante se empuja entero a la hoja siguiente y deja el hueco en
// blanco. Con capturas de pantalla (≈300 pt de alto) eso significa un paso por
// página y casi media hoja desperdiciada.
//
// Aquí medimos cada bloque por adelantado y decidimos nosotros los saltos de
// página, encogiendo ligeramente una captura cuando con eso el paso cabe en la
// hoja en curso.
//
// Regla de oro: **nunca subestimar**. Si nuestra medida es algo mayor que la
// real, rompemos un poco antes de lo necesario (se pierden unos pt). Si fuera
// menor, pdfmake movería el bloque por su cuenta y nuestro cursor quedaría
// desincronizado del documento real.

/**
 * Alto de línea de Roboto, la fuente por defecto de pdfmake. Medido contra el
 * motor real: una línea de 11 pt con lineHeight 1.4 ocupa exactamente 18.0 pt.
 */
const LINE_FACTOR = 1.17;

/**
 * Ancho medio de carácter de Roboto, en múltiplos del fontSize. El valor real
 * ronda 0.50; usamos 0.55 a propósito para que salgan más líneas de las que
 * habrá y la estimación quede siempre del lado seguro.
 */
const CHAR_W = 0.55;

/**
 * Colchón por bloque (pt). Contrastada contra pdfmake, la estimación de un paso
 * con descripción de una línea da 75.5 pt frente a los 75.7 pt reales, así que
 * con 2 pt sobra: subirlo más solo desperdicia espacio de página.
 */
const SAFETY = 2;

/** No encogemos una captura más de un 15%: por debajo se nota. */
const MIN_SCALE = 0.85;

/**
 * Colchón extra al decidir si un encabezado de sección cabe junto con su primer
 * bloque. Quedarse corto aquí produce el artefacto más feo posible —un título
 * solo al pie de una página—, así que en esta decisión pedimos algo más de aire.
 */
const KEEP_MARGIN = 10;

/** Alto de una línea de texto para un tamaño de fuente dado. */
export function lineHeight(fontSize: number, factor = 1): number {
  return fontSize * LINE_FACTOR * factor;
}

/**
 * Estima el alto que ocupará un texto al fluir en `width` puntos de ancho.
 * Respeta los saltos de línea explícitos.
 */
export function textHeight(
  text: string | undefined,
  fontSize: number,
  width: number,
  factor = 1,
): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * CHAR_W)));
  let lines = 0;
  for (const paragraph of (text ?? '').split('\n')) {
    lines += Math.max(1, Math.ceil(paragraph.length / perLine));
  }
  return Math.max(1, lines) * lineHeight(fontSize, factor);
}

/**
 * Escala una imagen a la columna de contenido manteniendo la proporción.
 * Nunca amplía por encima del tamaño natural.
 */
export function imageFit(
  natW: number,
  natH: number,
  contentWidth: number,
  maxHeight: number,
): [number, number] {
  const ratio = natH / natW;
  let w = Math.min(contentWidth, natW);
  let h = w * ratio;
  if (h > maxHeight) {
    h = maxHeight;
    w = h / ratio;
  }
  return [w, h];
}

/** Un bloque de contenido ya medido, listo para colocar en la página. */
export interface MeasuredBlock {
  /** Alto del contenido, sin el margen superior ni el divisor. */
  height: number;
  /** Margen superior que pide el bloque cuando no es el primero de su página. */
  marginTop: number;
  /** Alto del divisor que lo sigue (0 si no lleva). */
  divider: number;
  /** Alto de la imagen, si la tiene: es el único elemento elástico del bloque. */
  imageHeight?: number;
  /** Los encabezados de sección siguen la regla del espacio libre. */
  isSection?: boolean;
}

/** Decisión de colocación para un bloque. */
export interface PlacedBlock {
  /** Forzar salto de página antes del bloque. */
  pageBreakBefore: boolean;
  /** Escala a aplicar a la imagen (1 = tamaño nominal, nunca por debajo de 0.85). */
  imageScale: number;
  /** El bloque abre página: se le quita el margen superior. */
  firstOnPage: boolean;
  /** false cuando el bloque no cabe en una hoja entera y necesita poder fluir. */
  unbreakable: boolean;
  /**
   * Si dibujar el divisor que sigue al bloque. El último de cada página no lo
   * lleva: ahí no separa nada (el salto de página ya separa) y sus 20 pt son
   * justo lo que a veces falta para que quepa un paso más.
   */
  showDivider: boolean;
}

/**
 * Reparte los bloques en páginas de `usableHeight` puntos de alto útil.
 *
 * Se llena la página en curso probando a añadir un bloque más: si encogiendo
 * *todas* las capturas de la página un mismo porcentaje (nunca por debajo de
 * `MIN_SCALE`) el bloque entra, se acepta. Repartir el déficit entre todas las
 * imágenes de la hoja es mucho más eficaz que cargárselo a la última, y además
 * queda más limpio: todas las capturas de una página se ven del mismo tamaño.
 */
export function packBlocks(blocks: MeasuredBlock[], usableHeight: number): PlacedBlock[] {
  const placed: PlacedBlock[] = new Array(blocks.length);
  /** Índices de los bloques de la página en curso. */
  let page: number[] = [];
  /** Alto rígido de la página sin contar divisores: títulos, textos, márgenes. */
  let rigid = 0;
  /** Suma de las alturas de imagen de la página: lo único elástico. */
  let elastic = 0;
  /** Divisores que sí se dibujan: los de todos los bloques menos el último. */
  let dividers = 0;
  /** Divisor del bloque que ahora mismo cierra la página, y que no se dibuja. */
  let pendingDivider = 0;

  /** Escala necesaria para que quepa lo acumulado más lo que se le añada. */
  const scaleFor = (addRigid: number, addElastic: number, addDividers: number): number => {
    const total = rigid + addRigid + elastic + addElastic + dividers + addDividers;
    if (total <= usableHeight) return 1;
    const shrinkable = elastic + addElastic;
    if (shrinkable <= 0) return 0;
    return 1 - (total - usableHeight) / shrinkable;
  };

  /** Cierra la página en curso aplicando a sus bloques la escala definitiva. */
  const closePage = () => {
    if (page.length === 0) return;
    const scale = Math.min(1, Math.max(MIN_SCALE, scaleFor(0, 0, 0)));
    for (const index of page) placed[index].imageScale = scale;
    // El último de la página no dibuja divisor: ya lo separa el salto de hoja.
    placed[page[page.length - 1]].showDivider = false;
    page = [];
    rigid = 0;
    elastic = 0;
    dividers = 0;
    pendingDivider = 0;
  };

  /** Lo que aporta un bloque a la parte rígida de la página. */
  const rigidOf = (block: MeasuredBlock, opensPage: boolean): number =>
    (opensPage ? 0 : block.marginTop) + (block.height - (block.imageHeight ?? 0)) + SAFETY;

  /**
   * ¿Caben en la página en curso el encabezado de sección `i` y el primer
   * bloque de su sección? Si no, el título tiene que irse a la hoja siguiente.
   */
  const sectionFitsWithNext = (i: number): boolean => {
    const heading = blocks[i];
    const next = blocks[i + 1];
    // Una sección al final del documento solo tiene que caber ella.
    if (!next) return scaleFor(rigidOf(heading, false), 0, pendingDivider) >= MIN_SCALE;
    const image = next.imageHeight ?? 0;
    // El divisor del bloque siguiente no cuenta: al ser el nuevo último de la
    // página, no se dibuja. El del bloque anterior sí vuelve a contar.
    const addRigid =
      rigidOf(heading, false) + rigidOf(next, false) + heading.divider + KEEP_MARGIN;
    return scaleFor(addRigid, image, pendingDivider) >= MIN_SCALE;
  };

  /** Añade el bloque `i` a la página en curso. */
  const place = (i: number, pageBreakBefore: boolean) => {
    const block = blocks[i];
    const image = block.imageHeight ?? 0;
    const opensPage = page.length === 0;
    placed[i] = {
      pageBreakBefore,
      imageScale: 1,
      firstOnPage: opensPage,
      unbreakable: true,
      showDivider: block.divider > 0,
    };
    // Al dejar de ser el último, el bloque anterior recupera su divisor.
    if (!opensPage) dividers += pendingDivider;
    pendingDivider = block.divider;
    rigid += rigidOf(block, opensPage);
    elastic += image;
    page.push(i);
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const image = block.imageHeight ?? 0;

    // Más alto que una hoja entera (descripción larguísima): no puede ser
    // unbreakable o pdfmake se queda sin sitio donde ponerlo. Lo dejamos fluir
    // y reiniciamos, porque ya no sabemos por dónde va la página.
    if (block.height + SAFETY > usableHeight) {
      const opensPage = page.length === 0;
      closePage();
      placed[i] = {
        pageBreakBefore: false,
        imageScale: 1,
        firstOnPage: opensPage,
        unbreakable: false,
        showDivider: block.divider > 0,
      };
      continue;
    }

    // Encabezado de sección: se pagina junto con el primer bloque de la sección
    // (keep-with-next). Mirar solo el hueco libre no basta —puede sobrar media
    // página y aun así no caber el paso siguiente—, y el título se quedaría
    // solo al pie, que es justo el artefacto que queremos evitar.
    if (block.isSection && page.length > 0 && !sectionFitsWithNext(i)) {
      closePage();
      place(i, true);
      continue;
    }

    if (page.length === 0) {
      place(i, false);
      continue;
    }

    // Solo entra mientras las capturas no tengan que encoger de más. El divisor
    // del bloque candidato no cuenta: al ser el nuevo último, no se dibuja.
    if (scaleFor(rigidOf(block, false), image, pendingDivider) < MIN_SCALE) {
      closePage();
      place(i, true);
      continue;
    }

    place(i, false);
  }

  closePage();
  return placed;
}
