import type { Breakpoint, LayoutElement, Page } from "../types";
import { BREAKPOINT_SPECS } from "../types";

// ---------------------------------------------------------------------------
// Auto-reflow engine.
//
// You design ONLY on desktop. This pure function derives what the layout should
// look like at a smaller breakpoint, so tablet/mobile "make sense" without hand
// positioning. It is deterministic and drives BOTH the on-screen preview and
// the exported HTML, so preview == published.
//
// Strategy (desktop -> smaller):
//   1. Scale the frame to the target width; scale x/width proportionally.
//   2. Detect "rows": elements whose vertical ranges overlap sit side by side.
//   3. On mobile, stack a multi-item row vertically (each near full width) when
//      proportional scaling would make items too small; tablet keeps rows.
//   4. Reflow Y so stacked items don't overlap; refit the page height.
//   5. Scale font sizes by width ratio, clamped to a readable minimum.
//
// Absolute coordinates don't encode intent, so this uses predictable heuristics
// rather than guessing. Full-bleed items (spanning ~the whole width) are kept
// full-bleed; everything else gets side padding on mobile.
// ---------------------------------------------------------------------------

export interface ReflowedElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  // Scaled font size for text/button elements (undefined otherwise).
  fontSize?: number;
}

export interface ReflowResult {
  width: number;
  height: number;
  elements: Record<string, ReflowedElement>; // keyed by element id
}

const MOBILE_SIDE_PADDING = 24;
const MOBILE_STACK_GAP = 20;
const MIN_FONT = 13;
// If an element spans at least this fraction of the desktop width, treat it as
// a full-bleed band (hero background, section divider) and keep it edge-to-edge.
const FULL_BLEED_THRESHOLD = 0.9;
// Vertical overlap (as a fraction of the shorter element) needed to call two
// elements part of the same row.
const ROW_OVERLAP_RATIO = 0.4;

function fontOf(el: LayoutElement): number | undefined {
  if (el.type === "text" || el.type === "button") {
    return el.content.fontSize ?? 16;
  }
  return undefined;
}

function verticalOverlap(a: LayoutElement, b: LayoutElement): number {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, bottom - top);
}

function sameRow(a: LayoutElement, b: LayoutElement): boolean {
  const overlap = verticalOverlap(a, b);
  const shorter = Math.min(a.height, b.height);
  return shorter > 0 && overlap / shorter >= ROW_OVERLAP_RATIO;
}

// Group elements into visual rows by vertical overlap. Full-bleed bands are
// their own rows so they aren't stacked with content.
function detectRows(els: LayoutElement[], desktopWidth: number): LayoutElement[][] {
  const sorted = [...els].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: LayoutElement[][] = [];

  for (const el of sorted) {
    const isFullBleed = el.width >= desktopWidth * FULL_BLEED_THRESHOLD;
    if (isFullBleed) {
      rows.push([el]);
      continue;
    }
    // Try to join an existing non-full-bleed row that overlaps vertically.
    const row = rows.find(
      (r) =>
        r.length > 0 &&
        r[0].width < desktopWidth * FULL_BLEED_THRESHOLD &&
        r.some((other) => sameRow(other, el))
    );
    if (row) row.push(el);
    else rows.push([el]);
  }
  return rows;
}

function scaleFont(
  el: LayoutElement,
  ratio: number
): number | undefined {
  const f = fontOf(el);
  if (f === undefined) return undefined;
  return Math.max(MIN_FONT, Math.round(f * ratio));
}

// Proportional scale (used for desktop passthrough and tablet). Horizontal
// position is preserved (scaled), not centered.
function scaledResult(page: Page, els: LayoutElement[], targetWidth: number): ReflowResult {
  const desktopWidth = BREAKPOINT_SPECS.desktop.width;
  const ratio = targetWidth / desktopWidth;

  const out: Record<string, ReflowedElement> = {};
  let maxBottom = 0;

  for (const el of els) {
    const x = Math.round(el.x * ratio);
    const y = Math.round(el.y * ratio);
    const width = Math.round(el.width * ratio);
    const height = Math.round(el.height * ratio);
    out[el.id] = {
      id: el.id,
      x,
      y,
      width,
      height,
      rotation: el.rotation,
      fontSize: scaleFont(el, ratio),
    };
    maxBottom = Math.max(maxBottom, y + height);
  }

  const height = Math.max(Math.round(page.height * ratio), maxBottom);
  return { width: targetWidth, height, elements: out };
}

// Mobile: stack multi-item rows vertically; keep full-bleed bands edge-to-edge.
function stackedResult(els: LayoutElement[], targetWidth: number): ReflowResult {
  const desktopWidth = BREAKPOINT_SPECS.desktop.width;
  const ratio = targetWidth / desktopWidth;
  const contentWidth = targetWidth - MOBILE_SIDE_PADDING * 2;
  const rows = detectRows(els, desktopWidth);

  const out: Record<string, ReflowedElement> = {};
  let cursorY = MOBILE_STACK_GAP;

  for (const row of rows) {
    const isFullBleed =
      row.length === 1 && row[0].width >= desktopWidth * FULL_BLEED_THRESHOLD;

    if (isFullBleed) {
      const el = row[0];
      const height = Math.round(el.height * ratio);
      out[el.id] = {
        id: el.id,
        x: 0,
        y: cursorY - MOBILE_STACK_GAP === 0 ? 0 : cursorY,
        width: targetWidth,
        height,
        rotation: el.rotation,
        fontSize: scaleFont(el, ratio),
      };
      // Full-bleed bands start flush if they're first; advance the cursor.
      const placedY = out[el.id].y;
      cursorY = placedY + height + MOBILE_STACK_GAP;
      continue;
    }

    // Sort the row left-to-right, then top-to-bottom, and stack each item.
    const ordered = [...row].sort((a, b) => a.x - b.x || a.y - b.y);
    for (const el of ordered) {
      const stacked = row.length > 1;
      // Width: stacked items span the content column; otherwise scale but cap.
      const scaledWidth = Math.round(el.width * ratio) || contentWidth;
      const finalWidth = stacked
        ? contentWidth
        : Math.min(contentWidth, scaledWidth);

      // Height: images preserve aspect ratio when widened; text/buttons keep
      // their natural height so a wide short button doesn't become a tall box.
      let height: number;
      if (el.type === "image") {
        const aspect = el.height / el.width;
        height = Math.round(finalWidth * aspect);
      } else {
        height = Math.round(el.height * Math.max(ratio, 0.85));
      }

      out[el.id] = {
        id: el.id,
        x: MOBILE_SIDE_PADDING,
        y: cursorY,
        width: finalWidth,
        height,
        rotation: 0, // rotation rarely survives stacking sensibly
        fontSize: scaleFont(el, Math.max(ratio, 0.8)),
      };
      cursorY += height + MOBILE_STACK_GAP;
    }
  }

  return { width: targetWidth, height: cursorY, elements: out };
}

// Shift every element so the content's actual bounding box is vertically
// centered within the device frame — but only when the content is SHORTER than
// the frame. Taller content keeps its natural top-anchored flow (it scrolls).
function centerVertically(result: ReflowResult, frameHeight: number): ReflowResult {
  const items = Object.values(result.elements);
  if (items.length === 0) return result;

  const top = Math.min(...items.map((g) => g.y));
  const bottom = Math.max(...items.map((g) => g.y + g.height));
  const contentHeight = bottom - top;
  if (contentHeight >= frameHeight) return result;

  // Move the box so equal space sits above and below it.
  const targetTop = Math.round((frameHeight - contentHeight) / 2);
  const offset = targetTop - top;
  if (offset === 0) return result;

  const elements: Record<string, ReflowedElement> = {};
  for (const [id, g] of Object.entries(result.elements)) {
    elements[id] = { ...g, y: g.y + offset };
  }
  // Report the full frame height so the page fills the viewport.
  return { width: result.width, height: frameHeight, elements };
}

// Public entry point: reflow a desktop page to a breakpoint.
export function reflowPage(page: Page, bp: Breakpoint): ReflowResult {
  const visibleEls = page.elements; // visibility handled by renderer
  const spec = BREAKPOINT_SPECS[bp];
  const targetWidth = spec.width;

  if (bp === "desktop") {
    // 1:1 editing view.
    return scaledResult(page, visibleEls, targetWidth);
  }
  if (bp === "tablet") {
    // Scale the composition, then center it vertically only.
    const scaled = scaledResult(page, visibleEls, targetWidth);
    return centerVertically(scaled, spec.frameHeight);
  }
  // mobile: stacked column, vertically centered when shorter than the screen.
  const stacked = stackedResult(visibleEls, targetWidth);
  return centerVertically(stacked, spec.frameHeight);
}
