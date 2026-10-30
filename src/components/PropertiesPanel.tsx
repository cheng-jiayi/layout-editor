import { useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";
import { fileToLoadedImage, isImageFile } from "../lib/image";
import type { LayoutElement } from "../types";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function PropertiesPanel() {
  const selected = useEditorStore((s) => s.selectedElement());
  const editable = useEditorStore((s) => s.isEditable());
  const previewBp = useEditorStore((s) => s.previewBreakpoint);
  const updateElement = useEditorStore((s) => s.updateElement);
  const updateContent = useEditorStore((s) => s.updateContent);
  const page = useEditorStore((s) => s.currentPage());
  const updatePageHeight = useEditorStore((s) => s.updatePageHeight);
  const setBackground = useEditorStore((s) => s.setBackground);
  const replaceInput = useRef<HTMLInputElement>(null);

  // In tablet/mobile preview there's nothing to edit — it's auto-generated.
  if (!editable) {
    return (
      <div className="panel props">
        <h3>Preview</h3>
        <div className="empty-hint">
          You're previewing the <b>{previewBp}</b> layout. It's generated
          automatically from your desktop design.
          <br />
          <br />
          Switch back to <b>Desktop</b> in the toolbar to make changes.
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="panel props">
        <h3>Page</h3>
        <div className="field">
          <label>Height</label>
          <input
            type="number"
            value={page.height}
            onChange={(e) => updatePageHeight(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Background</label>
          <input
            type="color"
            value={page.background}
            onChange={(e) => setBackground(e.target.value)}
          />
        </div>
        <div className="empty-hint">
          Select an element to edit it. Tablet and mobile layouts adapt
          automatically — preview them from the toolbar.
        </div>
      </div>
    );
  }

  const el = selected;
  const set = (patch: Partial<LayoutElement>) => updateElement(el.id, patch);
  const setContent = (patch: Partial<LayoutElement["content"]>) =>
    updateContent(el.id, patch);
  const isImage = el.type === "image";

  async function handleReplaceImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }
    try {
      const { src } = await fileToLoadedImage(file);
      setContent({ src });
    } catch {
      alert("Could not load that image.");
    }
    e.target.value = "";
  }

  return (
    <div className="panel props">
      <h3>{el.name}</h3>

      <div className="field">
        <label>Name</label>
        <input
          type="text"
          value={el.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <h3>Position &amp; Size</h3>
      <NumberField label="X" value={el.x} onChange={(v) => set({ x: v })} />
      <NumberField label="Y" value={el.y} onChange={(v) => set({ y: v })} />
      <NumberField
        label="Width"
        value={el.width}
        onChange={(v) => {
          if (isImage && el.width > 0) {
            // Keep aspect ratio: derive height from the new width.
            set({ width: v, height: Math.round(v * (el.height / el.width)) });
          } else {
            set({ width: v });
          }
        }}
      />
      <NumberField
        label="Height"
        value={el.height}
        onChange={(v) => {
          if (isImage && el.height > 0) {
            set({ height: v, width: Math.round(v * (el.width / el.height)) });
          } else {
            set({ height: v });
          }
        }}
      />
      <NumberField label="Rotation" value={el.rotation} onChange={(v) => set({ rotation: v })} />
      {isImage && (
        <div className="bp-hint">Width and height are locked to the image ratio.</div>
      )}

      <h3>Content</h3>

      {el.type === "image" && (
        <>
          <div className="field">
            <label>Source</label>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={() => replaceInput.current?.click()}
            >
              Upload from computer
            </button>
          </div>
          <div className="field">
            <label>or URL</label>
            <input
              type="text"
              value={(el.content.src ?? "").startsWith("data:") ? "" : el.content.src ?? ""}
              placeholder={
                (el.content.src ?? "").startsWith("data:")
                  ? "(uploaded image)"
                  : "https://..."
              }
              onChange={(e) => setContent({ src: e.target.value })}
            />
          </div>
          <input
            ref={replaceInput}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleReplaceImage}
          />
        </>
      )}

      {(el.type === "text" || el.type === "button") && (
        <>
          <div className="field">
            <label>Text</label>
            <textarea
              rows={2}
              value={el.content.text ?? ""}
              onChange={(e) => setContent({ text: e.target.value })}
            />
          </div>
          <NumberField
            label="Font size"
            value={el.content.fontSize ?? 16}
            onChange={(v) => setContent({ fontSize: v })}
          />
          <NumberField
            label="Weight"
            value={el.content.fontWeight ?? 400}
            onChange={(v) => setContent({ fontWeight: v })}
          />
          <div className="field">
            <label>Text color</label>
            <input
              type="color"
              value={el.content.color ?? "#000000"}
              onChange={(e) => setContent({ color: e.target.value })}
            />
          </div>
        </>
      )}

      {el.type === "button" && (
        <div className="field">
          <label>Link</label>
          <input
            type="text"
            value={el.content.href ?? ""}
            onChange={(e) => setContent({ href: e.target.value })}
          />
        </div>
      )}

      {(el.type === "shape" || el.type === "button") && (
        <>
          <div className="field">
            <label>Fill</label>
            <input
              type="color"
              value={el.content.backgroundColor ?? "#000000"}
              onChange={(e) => setContent({ backgroundColor: e.target.value })}
            />
          </div>
          <NumberField
            label="Radius"
            value={el.content.borderRadius ?? 0}
            onChange={(v) => setContent({ borderRadius: v })}
          />
        </>
      )}
    </div>
  );
}
