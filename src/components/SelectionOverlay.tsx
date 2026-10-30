import { useRef } from "react";
import type { LayoutElement } from "../types";
import { beginTransform, useEditorStore } from "../store/useEditorStore";

// Eight resize handles + one rotate handle. Only shown while editing desktop,
// so it operates directly on the element's authored geometry.

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: { id: HandleId; cx: number; cy: number; cursor: string }[] = [
  { id: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
  { id: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
  { id: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
  { id: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
  { id: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
  { id: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
  { id: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
  { id: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
];

const HANDLE_SIZE = 10;

interface Props {
  el: LayoutElement;
  scale: number;
}

export function SelectionOverlay({ el, scale }: Props) {
  const liveUpdate = useEditorStore((s) => s.liveUpdate);
  const dragging = useRef(false);

  function onResizeStart(e: React.PointerEvent, handle: HandleId) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    beginTransform();
    dragging.current = true;

    const start = { x: e.clientX, y: e.clientY };
    const orig = { x: el.x, y: el.y, width: el.width, height: el.height };
    const lockRatio = el.type === "image";

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;

      let { x, y, width, height } = orig;
      const hasW = handle.includes("w");
      const hasE = handle.includes("e");
      const hasN = handle.includes("n");
      const hasS = handle.includes("s");

      if (hasE) width = Math.max(10, orig.width + dx);
      if (hasS) height = Math.max(10, orig.height + dy);
      if (hasW) width = Math.max(10, orig.width - dx);
      if (hasN) height = Math.max(10, orig.height - dy);

      // Images keep a fixed aspect ratio. Corner handles use the dominant axis
      // to drive both dimensions; edge handles derive the opposite dimension.
      if (lockRatio) {
        const aspect = orig.width / orig.height; // w per h
        const isCorner = (hasW || hasE) && (hasN || hasS);
        if (isCorner) {
          // Drive by whichever axis changed more, keep ratio.
          const wFromH = height * aspect;
          if (Math.abs(width - orig.width) >= Math.abs(wFromH - orig.width)) {
            height = width / aspect;
          } else {
            width = height * aspect;
          }
        } else if (hasW || hasE) {
          height = width / aspect; // horizontal edge -> derive height
        } else {
          width = height * aspect; // vertical edge -> derive width
        }
        width = Math.max(10, width);
        height = Math.max(10, height);
      }

      // Re-anchor so west/north edges grow from the opposite side.
      if (hasW) x = orig.x + orig.width - width;
      if (hasN) y = orig.y + orig.height - height;
      // For images, when an EDGE handle derives the other axis, center that
      // derived axis so the image grows symmetrically (stays visually anchored).
      if (lockRatio) {
        const isCorner = (hasW || hasE) && (hasN || hasS);
        if (!isCorner) {
          if (hasW || hasE) y = orig.y + (orig.height - height) / 2; // derived: height
          if (hasN || hasS) x = orig.x + (orig.width - width) / 2; // derived: width
        }
      }

      liveUpdate(el.id, {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
    }

    function onUp(ev: PointerEvent) {
      dragging.current = false;
      (e.target as Element).releasePointerCapture?.(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onRotateStart(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    beginTransform();
    dragging.current = true;

    const box = (e.currentTarget as HTMLElement).closest(
      ".selection-group"
    ) as HTMLElement | null;
    const rect = box?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : e.clientX;
    const cy = rect ? rect.top + rect.height / 2 : e.clientY;

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const angle =
        (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      let snapped = Math.round(angle);
      if (ev.shiftKey) snapped = Math.round(snapped / 15) * 15;
      liveUpdate(el.id, { rotation: snapped });
    }

    function onUp() {
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const groupStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    zIndex: 99999,
    pointerEvents: "none",
  };

  return (
    <div className="selection-group" style={groupStyle}>
      <div
        className="selection-box"
        style={{ left: 0, top: 0, width: "100%", height: "100%" }}
      />

      <div
        className="handle rotate"
        style={{
          left: "50%",
          top: -28,
          marginLeft: -HANDLE_SIZE / 2,
          pointerEvents: "auto",
        }}
        onPointerDown={onRotateStart}
      />

      {HANDLES.map((h) => (
        <div
          key={h.id}
          className="handle"
          style={{
            left: `calc(${h.cx * 100}% - ${HANDLE_SIZE / 2}px)`,
            top: `calc(${h.cy * 100}% - ${HANDLE_SIZE / 2}px)`,
            cursor: h.cursor,
            pointerEvents: "auto",
          }}
          onPointerDown={(e) => onResizeStart(e, h.id)}
        />
      ))}
    </div>
  );
}
