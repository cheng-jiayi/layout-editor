// ---------------------------------------------------------------------------
// Data model — the single source of truth.
// The editor WRITES this; the published site READS this. Same JSON, two modes.
//
// You design on DESKTOP only. Tablet and mobile layouts are DERIVED
// automatically by the reflow engine (lib/reflow.ts), so they are never stored.
// ---------------------------------------------------------------------------

export type ElementType = "image" | "text" | "shape" | "button";

// Breakpoints are preview/output targets, not stored layouts.
export type Breakpoint = "desktop" | "tablet" | "mobile";

export const BREAKPOINTS: Breakpoint[] = ["desktop", "tablet", "mobile"];

export interface BreakpointSpec {
  id: Breakpoint;
  label: string;
  width: number; // frame width for this breakpoint
  // Portrait viewport height for the device preview frame. The page can scroll
  // past this; it just sets the visible device-screen aspect ratio.
  frameHeight: number;
  maxWidth?: number; // CSS media-query threshold on export (desktop = base)
}

// Tablet/mobile use real portrait device dimensions so previews look like an
// actual phone/tablet held upright, not a landscape strip.
export const BREAKPOINT_SPECS: Record<Breakpoint, BreakpointSpec> = {
  desktop: { id: "desktop", label: "Desktop", width: 1200, frameHeight: 800 },
  tablet: { id: "tablet", label: "Tablet", width: 820, frameHeight: 1180, maxWidth: 1024 },
  mobile: { id: "mobile", label: "Mobile", width: 390, frameHeight: 844, maxWidth: 640 },
};

export interface ElementContent {
  src?: string; // image url / asset ref
  text?: string; // text / button label
  color?: string; // text color
  backgroundColor?: string; // fill (shape / button)
  fontSize?: number;
  fontWeight?: number;
  href?: string; // link target for buttons
  borderRadius?: number;
}

export interface LayoutElement {
  id: string;
  type: ElementType;
  name: string; // shown in the layers panel

  // Desktop geometry — the single authored layout.
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees

  zIndex: number; // stacking order
  locked: boolean;
  visible: boolean;

  content: ElementContent;
}

export interface Page {
  id: string;
  name: string;
  height: number; // desktop height
  background: string; // css color
  elements: LayoutElement[];
}

export interface Project {
  id: string;
  name: string;
  pages: Page[];
}

// ---------------------------------------------------------------------------
// Default content per element type — used when adding new elements.
// ---------------------------------------------------------------------------
export function defaultContent(type: ElementType): ElementContent {
  switch (type) {
    case "image":
      return {
        src: "https://picsum.photos/400/300",
      };
    case "text":
      return {
        text: "Double-click to edit",
        color: "#1a1a1a",
        fontSize: 28,
        fontWeight: 600,
      };
    case "button":
      return {
        text: "Click me",
        color: "#ffffff",
        backgroundColor: "#5b8cff",
        fontSize: 16,
        fontWeight: 600,
        borderRadius: 8,
        href: "#",
      };
    case "shape":
      return {
        backgroundColor: "#ffd166",
        borderRadius: 12,
      };
  }
}

// ---------------------------------------------------------------------------
// Migration: tolerate older saved projects (which may carry per-breakpoint
// overrides / page width from an earlier version). We keep only desktop base
// geometry; derived breakpoints are recomputed by the reflow engine.
// ---------------------------------------------------------------------------
interface LegacyElement extends LayoutElement {
  overrides?: unknown;
  visibleAt?: unknown;
}
interface LegacyPage extends Page {
  width?: number;
  heightAt?: unknown;
}

export function migrateProject(p: Project): Project {
  return {
    id: p.id,
    name: p.name,
    pages: p.pages.map((pg) => {
      const lp = pg as LegacyPage;
      return {
        id: lp.id,
        name: lp.name,
        height: lp.height,
        background: lp.background,
        elements: lp.elements.map((el) => {
          const le = el as LegacyElement;
          return {
            id: le.id,
            type: le.type,
            name: le.name,
            x: le.x,
            y: le.y,
            width: le.width,
            height: le.height,
            rotation: le.rotation,
            zIndex: le.zIndex,
            locked: le.locked,
            visible: le.visible,
            content: le.content,
          };
        }),
      };
    }),
  };
}
