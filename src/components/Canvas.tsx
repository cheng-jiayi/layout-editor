import { useRef } from "react";
import { beginTransform, useEditorStore } from "../store/useEditorStore";
import { ElementView } from "./ElementView";
import { SelectionOverlay } from "./SelectionOverlay";
import type { LayoutElement } from "../types";
import { BREAKPOINT_SPECS } from "../types";
import { reflowPage } from "../lib/reflow";

const SCALE = 1;

// Desktop: the editable canvas. Drag/select/resize operate on authored layout.
function DesktopCanvas() {
  const page = useEditorStore((s) => s.currentPage());
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const liveUpdate = useEditorStore((s) => s.liveUpdate);

  const selected = page.elements.find((e) => e.id === selectedId) ?? null;
  const dragging = useRef(false);

  function onElementPointerDown(e: React.PointerEvent, el: LayoutElement) {
    if (el.locked) {
      select(el.id);
      return;
    }
    e.stopPropagation();
    select(el.id);
    beginTransform();
    dragging.current = true;

    const start = { x: e.clientX, y: e.clientY };
    const orig = { x: el.x, y: el.y };

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const dx = (ev.clientX - start.x) / SCALE;
      const dy = (ev.clientY - start.y) / SCALE;
      liveUpdate(el.id, {
        x: Math.round(orig.x + dx),
        y: Math.round(orig.y + dy),
      });
    }
    function onUp() {
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const sorted = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="canvas-area" onPointerDown={() => select(null)}>
      <div className="frames">
        <div className="frame">
          <div
            className="page active"
            style={{
              width: BREAKPOINT_SPECS.desktop.width,
              height: page.height,
              background: page.background,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {sorted.map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => onElementPointerDown(e, el)}
                style={{ cursor: el.locked ? "default" : "move" }}
              >
                <ElementView el={el} editing />
              </div>
            ))}
            {selected && selected.visible && !selected.locked && (
              <SelectionOverlay el={selected} scale={SCALE} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tablet/mobile: read-only preview inside a portrait device screen. The device
// viewport is fixed (portrait aspect) and the page scrolls inside it, like a
// real phone/tablet. The content layout comes from the auto-reflow engine.
function PreviewCanvas() {
  const page = useEditorStore((s) => s.currentPage());
  const bp = useEditorStore((s) => s.previewBreakpoint);
  const spec = BREAKPOINT_SPECS[bp];
  const reflow = reflowPage(page, bp);
  const sorted = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="canvas-area">
      <div className="frames">
        <div className="frame">
          <div className="frame-label">
            <span>{spec.label} preview</span>
            <span className="frame-dim">
              {spec.width} × {spec.frameHeight} · portrait
            </span>
          </div>
          {/* Device screen: fixed portrait viewport, scrolls internally. */}
          <div
            className="device-screen"
            style={{ width: spec.width, height: spec.frameHeight }}
          >
            <div
              className="page"
              style={{
                width: reflow.width,
                minHeight: Math.max(reflow.height, spec.frameHeight),
                background: page.background,
              }}
            >
              {sorted.map((el) => (
                <ElementView key={el.id} el={el} geom={reflow.elements[el.id]} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Canvas() {
  const editable = useEditorStore((s) => s.isEditable());
  return editable ? <DesktopCanvas /> : <PreviewCanvas />;
}
