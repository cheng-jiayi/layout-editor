import { useState } from "react";
import { useEditorStore } from "../store/useEditorStore";

const TYPE_ICON: Record<string, string> = {
  image: "IMG",
  text: "TXT",
  button: "BTN",
  shape: "SHP",
};

export function LayersPanel() {
  const page = useEditorStore((s) => s.currentPage());
  const selectedId = useEditorStore((s) => s.selectedId);
  const editable = useEditorStore((s) => s.isEditable());
  const select = useEditorStore((s) => s.select);
  const updateElement = useEditorStore((s) => s.updateElement);
  const reorderLayer = useEditorStore((s) => s.reorderLayer);
  const bringForward = useEditorStore((s) => s.bringForward);
  const sendBackward = useEditorStore((s) => s.sendBackward);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Displayed top-to-bottom = highest zIndex first.
  const ordered = [...page.elements].sort((a, b) => b.zIndex - a.zIndex);
  const n = ordered.length;

  // Displayed index (top=0) -> bottom-to-top stack index used by the store.
  const toStackIndex = (displayIndex: number) => n - 1 - displayIndex;

  function onDrop(targetDisplayIndex: number) {
    if (!dragId) return;
    reorderLayer(dragId, toStackIndex(targetDisplayIndex));
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="panel layers">
      <h3>Layers</h3>
      {n === 0 && (
        <div className="empty-hint">No elements yet. Add one from the toolbar.</div>
      )}
      {!editable && n > 0 && (
        <div className="empty-hint">
          Switch to Desktop to rearrange layers.
        </div>
      )}
      {ordered.map((el, i) => (
        <div
          key={el.id}
          className={`layer-row ${el.id === selectedId ? "selected" : ""} ${
            overId === el.id ? "drop-target" : ""
          }`}
          draggable={editable}
          onClick={() => select(el.id)}
          onDragStart={() => editable && setDragId(el.id)}
          onDragOver={(e) => {
            if (!editable || !dragId) return;
            e.preventDefault();
            if (overId !== el.id) setOverId(el.id);
          }}
          onDragLeave={() => {
            if (overId === el.id) setOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(i);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
        >
          {editable && <span className="drag-handle" title="Drag to reorder">::</span>}
          <span style={{ color: "var(--text-dim)", fontSize: 10, width: 26 }}>
            {TYPE_ICON[el.type]}
          </span>
          <span className="name">{el.name}</span>

          {editable && (
            <>
              <button
                className="icon-btn"
                title="Bring forward"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  bringForward(el.id);
                }}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                title="Send backward"
                disabled={i === n - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  sendBackward(el.id);
                }}
              >
                ↓
              </button>
            </>
          )}
          <button
            className="icon-btn"
            title={el.visible ? "Hide" : "Show"}
            onClick={(e) => {
              e.stopPropagation();
              updateElement(el.id, { visible: !el.visible });
            }}
          >
            {el.visible ? "o" : "-"}
          </button>
          <button
            className="icon-btn"
            title={el.locked ? "Unlock" : "Lock"}
            onClick={(e) => {
              e.stopPropagation();
              updateElement(el.id, { locked: !el.locked });
            }}
          >
            {el.locked ? "L" : "u"}
          </button>
        </div>
      ))}
    </div>
  );
}
