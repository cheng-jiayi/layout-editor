import { useEffect } from "react";
import { Toolbar } from "./components/Toolbar";
import { LayersPanel } from "./components/LayersPanel";
import { Canvas } from "./components/Canvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ElementView } from "./components/ElementView";
import { useEditorStore } from "./store/useEditorStore";
import { saveProject } from "./lib/persistence";
import type { Breakpoint } from "./types";
import { BREAKPOINTS } from "./types";
import { reflowPage } from "./lib/reflow";

// Published/view mode: render the layout read-only, no editing chrome.
// Reached via ?mode=view — the same data, rendered as the live site would be.
// Optional ?bp=desktop|tablet|mobile previews a specific auto-reflowed layout.
function ViewMode({ bp }: { bp: Breakpoint }) {
  const page = useEditorStore((s) => s.currentPage());
  const reflow = reflowPage(page, bp);
  const sorted = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f3f6" }}>
      <div
        style={{
          position: "relative",
          width: reflow.width,
          minHeight: reflow.height,
          margin: "0 auto",
          background: page.background,
          overflow: "hidden",
        }}
      >
        {sorted.map((el) => (
          <ElementView key={el.id} el={el} geom={reflow.elements[el.id]} />
        ))}
      </div>
    </div>
  );
}

function Editor() {
  const project = useEditorStore((s) => s.project);
  const selectedId = useEditorStore((s) => s.selectedId);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const nudge = useEditorStore((s) => s.nudge);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const duplicateElement = useEditorStore((s) => s.duplicateElement);

  // Autosave to LocalStorage whenever the project changes (debounced).
  useEffect(() => {
    const t = setTimeout(() => saveProject(project), 300);
    return () => clearTimeout(t);
  }, [project]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (typing) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (!selectedId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteElement(selectedId);
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateElement(selectedId);
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(selectedId, -step, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(selectedId, step, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nudge(selectedId, 0, -step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudge(selectedId, 0, step);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, undo, redo, nudge, deleteElement, duplicateElement]);

  return (
    <div className="app">
      <Toolbar />
      <LayersPanel />
      <Canvas />
      <PropertiesPanel />
    </div>
  );
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "view") {
    const raw = params.get("bp") as Breakpoint | null;
    const bp = raw && BREAKPOINTS.includes(raw) ? raw : "desktop";
    return <ViewMode bp={bp} />;
  }
  return <Editor />;
}
