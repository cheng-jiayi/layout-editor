import { useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";
import {
  downloadProjectJson,
  readProjectFile,
  triggerDownload,
  slug,
} from "../lib/persistence";
import { exportProject } from "../lib/exportSite";
import { fileToLoadedImage, isImageFile } from "../lib/image";
import type { ElementType } from "../types";
import { BREAKPOINTS, BREAKPOINT_SPECS } from "../types";

// "image" is handled separately via file upload.
const ADD_BUTTONS: { type: ElementType; label: string }[] = [
  { type: "text", label: "+ Text" },
  { type: "button", label: "+ Button" },
  { type: "shape", label: "+ Shape" },
];

export function Toolbar() {
  const project = useEditorStore((s) => s.project);
  const addElement = useEditorStore((s) => s.addElement);
  const addImageElement = useEditorStore((s) => s.addImageElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const loadProjectData = useEditorStore((s) => s.loadProjectData);
  const previewBreakpoint = useEditorStore((s) => s.previewBreakpoint);
  const setPreview = useEditorStore((s) => s.setPreview);

  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }
    try {
      const { src, width, height } = await fileToLoadedImage(file);
      addImageElement(src, width, height, file.name.replace(/\.[^.]+$/, ""));
    } catch {
      alert("Could not load that image.");
    }
    e.target.value = "";
  }

  function handlePublish() {
    const html = exportProject(project);
    const blob = new Blob([html], { type: "text/html" });
    triggerDownload(blob, `${slug(project.name)}.html`);
  }

  function handlePreview() {
    const html = exportProject(project);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const p = await readProjectFile(file);
      loadProjectData(p);
    } catch {
      alert("Could not read that file as a project JSON.");
    }
    e.target.value = "";
  }

  return (
    <div className="toolbar">
      <span className="title">{project.name}</span>

      {ADD_BUTTONS.map((b) => (
        <button key={b.type} className="btn" onClick={() => addElement(b.type)}>
          {b.label}
        </button>
      ))}
      <button className="btn" onClick={() => imageInput.current?.click()}>
        + Image
      </button>

      <span style={{ width: 8 }} />

      <div
        className="bp-switch"
        title="Preview how the layout auto-adapts. Editing happens on Desktop."
      >
        {BREAKPOINTS.map((bp) => (
          <button
            key={bp}
            className={previewBreakpoint === bp ? "active" : ""}
            onClick={() => setPreview(bp)}
          >
            {BREAKPOINT_SPECS[bp].label}
          </button>
        ))}
      </div>

      <span style={{ width: 8 }} />

      <button className="btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button className="btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        Redo
      </button>

      <span className="spacer" />

      <button className="btn" onClick={() => downloadProjectJson(project)}>
        Save JSON
      </button>
      <button className="btn" onClick={() => fileInput.current?.click()}>
        Load JSON
      </button>
      <button className="btn" onClick={handlePreview}>
        Preview
      </button>
      <button className="btn primary" onClick={handlePublish}>
        Publish HTML
      </button>

      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImport}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />
    </div>
  );
}
