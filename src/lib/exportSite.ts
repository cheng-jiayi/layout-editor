import type { LayoutElement, Page, Project } from "../types";
import { BREAKPOINT_SPECS } from "../types";
import { reflowPage } from "./reflow";

// Serialize a page to standalone, responsive HTML.
//
// Desktop is the authored base. Tablet and mobile CSS come from the SAME
// reflow engine the preview uses (lib/reflow.ts), emitted as media queries.
// So the published site adapts exactly like the in-editor preview.

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!
  );
}

function cls(el: LayoutElement): string {
  return `el-${el.id}`;
}

function baseRule(el: LayoutElement): string {
  const decls = [
    "position:absolute",
    `left:${el.x}px`,
    `top:${el.y}px`,
    `width:${el.width}px`,
    `height:${el.height}px`,
    `z-index:${el.zIndex}`,
  ];
  if (el.rotation) decls.push(`transform:rotate(${el.rotation}deg)`);
  if (!el.visible) decls.push("display:none");
  return `.${cls(el)}{${decls.join(";")}}`;
}

function contentStyle(el: LayoutElement): string {
  const c = el.content;
  switch (el.type) {
    case "image":
      return "object-fit:cover";
    case "text":
      return `display:flex;align-items:center;color:${c.color ?? "#000"};font-size:${
        c.fontSize ?? 16
      }px;font-weight:${c.fontWeight ?? 400};line-height:1.2;white-space:pre-wrap;overflow:hidden`;
    case "button":
      return `display:flex;align-items:center;justify-content:center;background:${
        c.backgroundColor ?? "#5b8cff"
      };color:${c.color ?? "#fff"};font-size:${c.fontSize ?? 16}px;font-weight:${
        c.fontWeight ?? 600
      };border-radius:${c.borderRadius ?? 0}px;text-decoration:none`;
    case "shape":
      return `background:${c.backgroundColor ?? "#ccc"};border-radius:${
        c.borderRadius ?? 0
      }px`;
  }
}

function elementToHtml(el: LayoutElement): string {
  const c = el.content;
  const className = cls(el);
  const inline = contentStyle(el);
  switch (el.type) {
    case "image":
      return `<img class="${className}" style="${inline}" src="${esc(
        c.src ?? ""
      )}" alt="${esc(el.name)}" />`;
    case "text":
      return `<div class="${className}" style="${inline}">${esc(c.text ?? "")}</div>`;
    case "button":
      return `<a class="${className}" style="${inline}" href="${esc(
        c.href ?? "#"
      )}">${esc(c.text ?? "")}</a>`;
    case "shape":
      return `<div class="${className}" style="${inline}"></div>`;
  }
}

// Tablet: keep the composition, scaled proportionally. Absolute positioning is
// fine here because the frame is wide; we just scale left/top/size per element.
function tabletBlock(page: Page): string {
  const spec = BREAKPOINT_SPECS.tablet;
  const reflow = reflowPage(page, "tablet");

  const rules: string[] = [
    `.page{width:${reflow.width}px;min-height:${reflow.height}px}`,
  ];
  for (const el of page.elements) {
    const g = reflow.elements[el.id];
    if (!g) continue;
    const decls = [
      `left:${g.x}px`,
      `top:${g.y}px`,
      `width:${g.width}px`,
      `height:${g.height}px`,
      g.rotation ? `transform:rotate(${g.rotation}deg)` : "transform:none",
    ];
    if (g.fontSize !== undefined && (el.type === "text" || el.type === "button")) {
      decls.push(`font-size:${g.fontSize}px`);
    }
    rules.push(`.${cls(el)}{${decls.join(";")}}`);
  }
  return `@media (max-width:${spec.maxWidth}px){\n      ${rules.join(
    "\n      "
  )}\n    }`;
}

// Mobile: emit a REAL responsive flex column. The page stops being an absolute
// canvas and becomes a fluid vertical stack, so it adapts to any narrow screen
// (not pinned to one pixel width). Order follows the reflow's stacking order;
// each item keeps its reflowed height and spans the fluid content width.
function mobileBlock(page: Page): string {
  const spec = BREAKPOINT_SPECS.mobile;
  const reflow = reflowPage(page, "mobile");

  // Stacking order = ascending reflowed y.
  const ordered = [...page.elements]
    .filter((el) => reflow.elements[el.id])
    .sort((a, b) => reflow.elements[a.id].y - reflow.elements[b.id].y);

  const rules: string[] = [
    // The page becomes a fluid flex column. Items are left-aligned (stretch);
    // justify-content:center + min-height:100vh centers the stack VERTICALLY in
    // the viewport. Taller-than-screen content just scrolls from the top.
    `.page{position:static;display:flex;flex-direction:column;align-items:stretch;` +
      `justify-content:center;width:100%;max-width:${spec.width}px;margin:0 auto;` +
      `min-height:100vh;height:auto;padding:16px 0;gap:16px}`,
  ];

  for (const el of ordered) {
    const g = reflow.elements[el.id];
    const isFullBleed = g.width >= spec.width; // reflow made it edge-to-edge
    const decls = [
      "position:static",
      "top:auto",
      "left:auto",
      "transform:none",
      `order:${ordered.indexOf(el)}`,
      `height:${g.height}px`,
      "flex:0 0 auto",
    ];
    if (isFullBleed) {
      // Full-bleed bands span the whole width edge to edge.
      decls.push("width:100%", "align-self:stretch");
    } else {
      // Content items: fluid width with left/right gutters (not centered).
      decls.push("width:auto", "align-self:stretch", "margin:0 24px");
    }
    if (g.fontSize !== undefined && (el.type === "text" || el.type === "button")) {
      decls.push(`font-size:${g.fontSize}px`);
    }
    rules.push(`.${cls(el)}{${decls.join(";")}}`);
  }

  return `@media (max-width:${spec.maxWidth}px){\n      ${rules.join(
    "\n      "
  )}\n    }`;
}

export function exportPage(page: Page): string {
  const els = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);
  const body = els.map(elementToHtml).join("\n    ");
  const baseRules = els.map(baseRule).join("\n    ");

  // Tablet then mobile (narrower last so it wins at the smallest size).
  const tablet = tabletBlock(page);
  const mobile = mobileBlock(page);

  const desktopWidth = BREAKPOINT_SPECS.desktop.width;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(page.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f3f3f6; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .page {
      position: relative;
      width: ${desktopWidth}px;
      min-height: ${page.height}px;
      margin: 0 auto;
      background: ${page.background};
      overflow: hidden;
    }
    ${baseRules}
    ${tablet}
    ${mobile}
  </style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`;
}

export function exportProject(project: Project): string {
  return exportPage(project.pages[0]);
}
