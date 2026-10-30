import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Breakpoint,
  ElementType,
  LayoutElement,
  Page,
  Project,
} from "../types";
import { BREAKPOINT_SPECS, defaultContent, migrateProject } from "../types";
import { sampleProject } from "../sampleProject";
import { loadProject } from "../lib/persistence";

const HISTORY_LIMIT = 100;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

interface EditorState {
  project: Project;
  currentPageId: string;
  selectedId: string | null;

  // Preview-only. Desktop = editable; tablet/mobile = read-only auto-reflow.
  previewBreakpoint: Breakpoint;

  past: Project[];
  future: Project[];

  currentPage: () => Page;
  selectedElement: () => LayoutElement | null;

  setPreview: (bp: Breakpoint) => void;
  isEditable: () => boolean; // true only on desktop preview

  select: (id: string | null) => void;

  addElement: (type: ElementType) => void;
  addImageElement: (
    src: string,
    naturalW: number,
    naturalH: number,
    name?: string
  ) => void;
  updateElement: (id: string, patch: Partial<LayoutElement>) => void;
  updateContent: (id: string, patch: Partial<LayoutElement["content"]>) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;

  liveUpdate: (id: string, patch: Partial<LayoutElement>) => void;

  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  moveToFront: (id: string) => void;
  moveToBack: (id: string) => void;
  // Reorder by stacking position. `toIndex` is an index into the stack sorted
  // bottom-to-top (0 = backmost). Reassigns sequential zIndex values.
  reorderLayer: (id: string, toIndex: number) => void;
  nudge: (id: string, dx: number, dy: number) => void;

  updatePageHeight: (height: number) => void;
  setBackground: (color: string) => void;

  undo: () => void;
  redo: () => void;
  loadProjectData: (p: Project) => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  const loaded = loadProject();
  const initial = loaded ? migrateProject(loaded) : sampleProject;

  function withElements(
    project: Project,
    pageId: string,
    fn: (els: LayoutElement[]) => LayoutElement[]
  ): Project {
    return {
      ...project,
      pages: project.pages.map((p) =>
        p.id === pageId ? { ...p, elements: fn(p.elements) } : p
      ),
    };
  }

  function mapEl(id: string, fn: (el: LayoutElement) => LayoutElement) {
    set((s) => ({
      project: withElements(s.project, s.currentPageId, (els) =>
        els.map((e) => (e.id === id ? fn(e) : e))
      ),
    }));
  }

  function pushHistory() {
    const { project, past } = get();
    const next = [...past, clone(project)];
    if (next.length > HISTORY_LIMIT) next.shift();
    set({ past: next, future: [] });
  }

  // Rebuild the stack from a bottom-to-top order and reassign sequential
  // zIndex values (1..n), so stacking is always unambiguous (no ties).
  function applyOrder(order: LayoutElement[]) {
    set((s) => ({
      project: withElements(s.project, s.currentPageId, (els) => {
        const zById = new Map<string, number>();
        order.forEach((e, i) => zById.set(e.id, i + 1));
        return els.map((e) => ({ ...e, zIndex: zById.get(e.id) ?? e.zIndex }));
      }),
    }));
  }

  // Move `id` to an absolute index in the bottom-to-top stack (clamped).
  function reorderTo(id: string, toIndex: number) {
    const els = [...get().currentPage().elements].sort(
      (a, b) => a.zIndex - b.zIndex
    );
    const from = els.findIndex((e) => e.id === id);
    if (from === -1) return;
    const [moved] = els.splice(from, 1);
    const clamped = Math.max(0, Math.min(els.length, toIndex));
    els.splice(clamped, 0, moved);
    applyOrder(els);
  }

  // Shift `id` by a delta in the bottom-to-top stack (+1 forward, -1 back).
  function reorderBy(id: string, delta: number) {
    const els = [...get().currentPage().elements].sort(
      (a, b) => a.zIndex - b.zIndex
    );
    const from = els.findIndex((e) => e.id === id);
    if (from === -1) return;
    reorderTo(id, from + delta);
  }

  return {
    project: initial,
    currentPageId: initial.pages[0].id,
    selectedId: null,
    previewBreakpoint: "desktop",
    past: [],
    future: [],

    currentPage() {
      const { project, currentPageId } = get();
      return (
        project.pages.find((p) => p.id === currentPageId) ?? project.pages[0]
      );
    },

    selectedElement() {
      const { selectedId } = get();
      if (!selectedId) return null;
      return (
        get().currentPage().elements.find((e) => e.id === selectedId) ?? null
      );
    },

    setPreview(bp) {
      // Leaving desktop clears selection so stale handles don't show.
      set({ previewBreakpoint: bp, selectedId: bp === "desktop" ? get().selectedId : null });
    },

    isEditable() {
      return get().previewBreakpoint === "desktop";
    },

    select(id) {
      if (!get().isEditable()) return;
      set({ selectedId: id });
    },

    addElement(type) {
      pushHistory();
      const page = get().currentPage();
      const w = BREAKPOINT_SPECS.desktop.width;
      const maxZ = page.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const el: LayoutElement = {
        id: nanoid(8),
        type,
        name: `${type[0].toUpperCase()}${type.slice(1)}`,
        x: Math.round(w / 2 - 100),
        y: Math.round(page.height / 2 - 60),
        width: type === "text" ? 240 : 200,
        height: type === "text" ? 60 : type === "button" ? 48 : 150,
        rotation: 0,
        zIndex: maxZ + 1,
        locked: false,
        visible: true,
        content: defaultContent(type),
      };
      set((s) => ({
        project: withElements(s.project, s.currentPageId, (els) => [...els, el]),
        selectedId: el.id,
      }));
    },

    addImageElement(src, naturalW, naturalH, name) {
      pushHistory();
      const page = get().currentPage();
      const pageW = BREAKPOINT_SPECS.desktop.width;
      const maxZ = page.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);

      const cap = Math.max(200, Math.round(Math.max(pageW, page.height) / 2));
      let w = naturalW;
      let h = naturalH;
      if (w > cap || h > cap) {
        const ratio = w > h ? cap / w : cap / h;
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const el: LayoutElement = {
        id: nanoid(8),
        type: "image",
        name: name ?? "Image",
        x: Math.round(pageW / 2 - w / 2),
        y: Math.round(page.height / 2 - h / 2),
        width: w,
        height: h,
        rotation: 0,
        zIndex: maxZ + 1,
        locked: false,
        visible: true,
        content: { src },
      };
      set((s) => ({
        project: withElements(s.project, s.currentPageId, (els) => [...els, el]),
        selectedId: el.id,
      }));
    },

    updateElement(id, patch) {
      pushHistory();
      mapEl(id, (e) => ({ ...e, ...patch }));
    },

    updateContent(id, patch) {
      pushHistory();
      mapEl(id, (e) => ({ ...e, content: { ...e.content, ...patch } }));
    },

    deleteElement(id) {
      pushHistory();
      set((s) => ({
        project: withElements(s.project, s.currentPageId, (els) =>
          els.filter((e) => e.id !== id)
        ),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }));
    },

    duplicateElement(id) {
      const src = get()
        .currentPage()
        .elements.find((e) => e.id === id);
      if (!src) return;
      pushHistory();
      const copy: LayoutElement = {
        ...clone(src),
        id: nanoid(8),
        name: `${src.name} copy`,
        x: src.x + 20,
        y: src.y + 20,
        zIndex: src.zIndex + 1,
      };
      set((s) => ({
        project: withElements(s.project, s.currentPageId, (els) => [...els, copy]),
        selectedId: copy.id,
      }));
    },

    liveUpdate(id, patch) {
      mapEl(id, (e) => ({ ...e, ...patch }));
    },

    bringForward(id) {
      pushHistory();
      reorderBy(id, +1);
    },

    sendBackward(id) {
      pushHistory();
      reorderBy(id, -1);
    },

    moveToFront(id) {
      pushHistory();
      reorderTo(id, Number.POSITIVE_INFINITY);
    },

    moveToBack(id) {
      pushHistory();
      reorderTo(id, 0);
    },

    reorderLayer(id, toIndex) {
      pushHistory();
      reorderTo(id, toIndex);
    },

    nudge(id, dx, dy) {
      pushHistory();
      mapEl(id, (e) => ({ ...e, x: e.x + dx, y: e.y + dy }));
    },

    updatePageHeight(height) {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          pages: s.project.pages.map((p) =>
            p.id === s.currentPageId ? { ...p, height } : p
          ),
        },
      }));
    },

    setBackground(color) {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          pages: s.project.pages.map((p) =>
            p.id === s.currentPageId ? { ...p, background: color } : p
          ),
        },
      }));
    },

    undo() {
      const { past, project, future } = get();
      if (past.length === 0) return;
      set({
        past: past.slice(0, -1),
        project: past[past.length - 1],
        future: [clone(project), ...future],
      });
    },

    redo() {
      const { future, project, past } = get();
      if (future.length === 0) return;
      set({
        future: future.slice(1),
        project: future[0],
        past: [...past, clone(project)],
      });
    },

    loadProjectData(p) {
      const migrated = migrateProject(p);
      set({
        project: migrated,
        currentPageId: migrated.pages[0].id,
        selectedId: null,
        past: [],
        future: [],
      });
    },
  };
});

export function beginTransform() {
  const s = useEditorStore.getState();
  const snapshot = clone(s.project);
  useEditorStore.setState({
    past: [...s.past, snapshot].slice(-HISTORY_LIMIT),
    future: [],
  });
}
