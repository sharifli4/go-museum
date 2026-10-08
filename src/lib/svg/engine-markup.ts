import { OVERVIEW_SVG_RAW } from "./overview-raw";
import { ESCAPE_DETAIL_SVG_RAW } from "./escape-detail-raw";
import { PARSER_DETAIL_SVG_RAW } from "./parser-detail-raw";
import { SLICES_DETAIL_SVG_RAW } from "./slices-detail-raw";
import { ESCAPE_DETAIL_TRANSFORM, SLICES_DETAIL_TRANSFORM } from "../geometry";

/**
 * The lock (§5) requires one camera on one SVG: zooming a part is a
 * transform, never a swap to a different illustration. We honor that by
 * keeping a single <svg> markup string with every group always present.
 * Each steppable part additionally carries a richer "detail" sub-drawing
 * layered inside its own `part-X` group; EngineStage toggles opacity/
 * display instead of mounting new SVG.
 */

interface DetailSpec {
  groupOpenTag: string;
  detailRaw: string;
  transform?: { x: number; y: number; scale: number };
}

const DETAILS: DetailSpec[] = [
  {
    groupOpenTag: `<g id="part-parser" class="part" tabindex="0" role="button" aria-label="01 Parser / AST, 9 steps">`,
    detailRaw: PARSER_DETAIL_SVG_RAW,
    // Authored in the same local coordinates as the compact drawing, so no
    // extra transform is needed -- it overlays exactly where the compact
    // art already is, just with more of the tree built out.
  },
  {
    groupOpenTag: `<g id="part-escape" class="part" tabindex="0" role="button" aria-label="02 Escape analysis, 9 steps">`,
    detailRaw: ESCAPE_DETAIL_SVG_RAW,
    transform: ESCAPE_DETAIL_TRANSFORM,
  },
  {
    groupOpenTag: `<g id="part-slices" class="part" tabindex="0" role="button" aria-label="03 Slices, 9 steps">`,
    detailRaw: SLICES_DETAIL_SVG_RAW,
    // Freshly authored; placed to the right of the parser assembly and
    // below the bus, in open sheet space the compact art doesn't use.
    transform: SLICES_DETAIL_TRANSFORM,
  },
];

/** Finds the index just past the `</g>` that balances the `<g` opened at `fromIndex`. */
function findMatchingGroupClose(markup: string, fromIndex: number): number {
  const tagPattern = /<g[\s>]|<\/g>/g;
  tagPattern.lastIndex = fromIndex;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(markup))) {
    if (match[0] === "</g>") {
      depth -= 1;
      if (depth === 0) return match.index;
    } else {
      depth += 1;
    }
  }
  throw new Error("engine-markup: unbalanced <g> while searching for group close");
}

function spliceDetailInto(markup: string, spec: DetailSpec): string {
  const start = markup.indexOf(spec.groupOpenTag);
  if (start === -1) {
    throw new Error(`engine-markup: could not find group start for ${spec.groupOpenTag}`);
  }
  const contentStart = start + spec.groupOpenTag.length;
  const closeTag = "</g>";
  const closeIndex = findMatchingGroupClose(markup, contentStart);

  const before = markup.slice(0, contentStart);
  const compactInner = markup.slice(contentStart, closeIndex);
  const after = markup.slice(closeIndex + closeTag.length);

  const detail = spec.transform
    ? `<g class="part-detail" aria-hidden="true" style="display:none" transform="translate(${spec.transform.x} ${spec.transform.y}) scale(${spec.transform.scale})">${spec.detailRaw}</g>`
    : `<g class="part-detail" aria-hidden="true" style="display:none">${spec.detailRaw}</g>`;
  const compact = `<g class="part-compact">${compactInner}</g>`;

  // Re-close the group itself: `before` only runs through its opening tag.
  return `${before}${compact}${detail}</g>${after}`;
}

function buildMarkup(): string {
  return DETAILS.reduce((markup, spec) => spliceDetailInto(markup, spec), OVERVIEW_SVG_RAW);
}

export const ENGINE_SVG_MARKUP = buildMarkup();
