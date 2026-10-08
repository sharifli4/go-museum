import { OVERVIEW_SVG_RAW } from "./overview-raw";
import { ESCAPE_DETAIL_SVG_RAW } from "./escape-detail-raw";
import { ESCAPE_DETAIL_TRANSFORM } from "../geometry";

/**
 * The lock (§5) requires one camera on one SVG: zooming a part is a
 * transform, never a swap to a different illustration. We honor that by
 * keeping a single <svg> markup string with every group always present.
 * The escape part additionally carries a richer "detail" sub-drawing
 * (ported from the escape zoom mock) layered inside the same `part-escape`
 * group; EngineStage toggles its opacity instead of mounting new SVG.
 */

const ESCAPE_GROUP_OPEN = `<g id="part-escape" class="part" tabindex="0" role="button" aria-label="02 Escape analysis, 9 steps">`;

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

function buildMarkup(): string {
  const start = OVERVIEW_SVG_RAW.indexOf(ESCAPE_GROUP_OPEN);
  if (start === -1) {
    throw new Error("engine-markup: could not find part-escape group start");
  }
  const contentStart = start + ESCAPE_GROUP_OPEN.length;
  const closeTag = "</g>";
  const closeIndex = findMatchingGroupClose(OVERVIEW_SVG_RAW, contentStart);

  const before = OVERVIEW_SVG_RAW.slice(0, contentStart);
  const compactInner = OVERVIEW_SVG_RAW.slice(contentStart, closeIndex);
  const after = OVERVIEW_SVG_RAW.slice(closeIndex + closeTag.length);

  const { x, y, scale } = ESCAPE_DETAIL_TRANSFORM;
  const detail =
    `<g class="escape-detail" aria-hidden="true" style="display:none" transform="translate(${x} ${y}) scale(${scale})">` +
    ESCAPE_DETAIL_SVG_RAW +
    `</g>`;
  const compact = `<g class="escape-compact">${compactInner}</g>`;

  // Re-close part-escape itself: `before` only runs through its opening tag.
  return `${before}${compact}${detail}</g>${after}`;
}

export const ENGINE_SVG_MARKUP = buildMarkup();
