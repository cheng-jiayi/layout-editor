import type { CSSProperties } from "react";
import type { LayoutElement } from "../types";
import type { ReflowedElement } from "../lib/reflow";

// ---------------------------------------------------------------------------
// The SHARED renderer. Edit mode (desktop) and preview/published mode all use
// this. Geometry can come from the element itself (desktop) or from a reflowed
// geometry (tablet/mobile preview), so preview matches the published site.
// ---------------------------------------------------------------------------

interface Props {
  el: LayoutElement;
  // When provided, render at this reflowed geometry instead of the element's
  // own desktop geometry (used for tablet/mobile preview + export parity).
  geom?: ReflowedElement;
  editing?: boolean;
}

export function ElementView({ el, geom, editing = false }: Props) {
  if (!el.visible) return null;

  const x = geom ? geom.x : el.x;
  const y = geom ? geom.y : el.y;
  const width = geom ? geom.width : el.width;
  const height = geom ? geom.height : el.height;
  const rotation = geom ? geom.rotation : el.rotation;
  const fontSize = geom?.fontSize ?? el.content.fontSize;

  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    zIndex: el.zIndex,
  };

  switch (el.type) {
    case "image":
      return (
        <img
          style={{ ...style, objectFit: "cover" }}
          src={el.content.src}
          alt={el.name}
          draggable={false}
        />
      );

    case "text":
      return (
        <div
          style={{
            ...style,
            color: el.content.color,
            fontSize,
            fontWeight: el.content.fontWeight,
            lineHeight: 1.2,
            display: "flex",
            alignItems: "center",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
          }}
        >
          {el.content.text}
        </div>
      );

    case "button":
      return (
        <a
          href={editing ? undefined : el.content.href}
          onClick={editing ? (e) => e.preventDefault() : undefined}
          style={{
            ...style,
            background: el.content.backgroundColor,
            color: el.content.color,
            fontSize,
            fontWeight: el.content.fontWeight,
            borderRadius: el.content.borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            cursor: editing ? "inherit" : "pointer",
            userSelect: "none",
          }}
        >
          {el.content.text}
        </a>
      );

    case "shape":
      return (
        <div
          style={{
            ...style,
            background: el.content.backgroundColor,
            borderRadius: el.content.borderRadius,
          }}
        />
      );
  }
}
