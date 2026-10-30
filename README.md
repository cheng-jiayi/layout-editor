# Layout Editor

A drag-and-drop visual layout editor built with React + TypeScript (Vite).
Position images, text, buttons, and shapes freely on a canvas, then publish that
exact layout as a real website.

The design and the published site read from the same `layout.json`, so moving an
asset in the editor is moving it on the live site. One shared renderer drives
both edit mode and published mode, so they can never drift.

---

## Prerequisites

- **Node.js 18 or newer** (includes `npm`). Download the LTS build from
  https://nodejs.org if you don't have it.

Check your versions:

```bash
node --version
npm --version
```

---

## Getting started

From this folder (`layout-editor`):

```bash
npm install     # first time only — downloads dependencies
npm run dev      # start the local dev server
```

Then open the URL it prints (default: **http://localhost:5173/**).

Stop the server with `Ctrl+C`.

---

## Using the editor

- **Add elements** from the top toolbar: Text, Image, Button, Shape.
- **Upload an image** with the **+ Image** button (pick a file from your
  computer). You can also select an existing image and use **Upload from
  computer** in the right panel to replace it, or paste a URL instead.
- **Move**: drag an element on the canvas.
- **Resize**: drag the square handles around a selected element.
- **Rotate**: drag the round handle above a selected element (hold `Shift` to
  snap to 15° steps).
- **Edit properties** of the selected element in the right panel (position,
  size, color, text, font, link, corner radius). With nothing selected, the
  panel edits the page itself (size + background).
- **Layers panel** (left): reorder stacking, show/hide, and lock elements.

### Responsive design (automatic)

You design **once, on desktop**. Tablet and mobile layouts are generated
automatically — you don't position anything twice.

- Use the **Desktop / Tablet / Mobile** toggle in the toolbar to preview how the
  layout adapts. Desktop is the editable view; Tablet and Mobile are read-only
  previews shown inside a **portrait device frame** (tablet 820×1180, mobile
  390×844) that scrolls internally like a real device.
- **How the auto-reflow works:**
  - **Tablet** scales the whole design down proportionally and keeps the
    side-by-side composition, with font sizes clamped to stay readable.
  - **Mobile** stacks content vertically into a single column: full-bleed bands
    (like a hero background) stay edge to edge, images keep their aspect ratio,
    and everything else gets side gutters.

On publish, the generated HTML uses **real responsive CSS**:
  - **Desktop** is the authored absolute-positioned layout.
  - **Tablet** is a `@media (max-width: 1024px)` block that scales the
    composition.
  - **Mobile** is a `@media (max-width: 640px)` block where the page becomes a
    genuine **flexbox column** (`display:flex; flex-direction:column`) with
    `order` and fluid widths — so it reflows smoothly on any narrow screen
    rather than snapping at one fixed width.

What you preview is what ships: the preview and the exported CSS come from the
same reflow logic.

Because reflow uses layout heuristics (absolute coordinates don't record
intent), unusual compositions may need a tweak to the desktop layout to reflow
cleanly. Typical page layouts — hero, headings, images, buttons — adapt well.

### Keyboard shortcuts

| Action            | Shortcut                     |
|-------------------|------------------------------|
| Undo / Redo       | `Ctrl+Z` / `Ctrl+Shift+Z`    |
| Delete selected   | `Delete` or `Backspace`      |
| Duplicate         | `Ctrl+D`                     |
| Nudge 1px         | Arrow keys                   |
| Nudge 10px        | `Shift` + Arrow keys         |

Your work **autosaves** to the browser's LocalStorage, so a refresh won't lose
it. Use **Save JSON** / **Load JSON** in the toolbar to move a project between
browsers or back it up.

---

## Publishing to a website

Two ways to get a shippable site out of the editor:

1. **Preview** — opens your layout as a standalone page in a new tab.
2. **Publish HTML** — downloads a self-contained `.html` file. Open it directly
   in any browser, or upload it to any static host (Netlify, Vercel, GitHub
   Pages, S3). No server required.

The published HTML is **responsive**: it adapts to Desktop, Tablet, and Mobile
using CSS media queries generated from your per-breakpoint edits.

There is also a read-only **view mode** at `?mode=view`
(e.g. http://localhost:5173/?mode=view) that renders the same data as the live
site would, without the editing chrome. Add `&bp=mobile` or `&bp=tablet` to
preview a specific breakpoint's layout (defaults to desktop).

---

## Building the editor app itself (optional)

To produce an optimized bundle of the editor application:

```bash
npm run build     # outputs to dist/
npm run preview   # serves the built app locally to verify it
```

---

## Project structure

```
layout-editor/
  index.html                 # Vite entry HTML
  package.json               # scripts & dependencies
  vite.config.ts             # Vite + React plugin
  tsconfig.json              # TypeScript config (strict)
  src/
    main.tsx                 # React entry point
    App.tsx                  # Editor shell + read-only view mode + shortcuts
    index.css                # App styling (dark UI theme)
    types.ts                 # Data model: Project / Page / LayoutElement
    sampleProject.ts         # Starter layout shown on first launch
    store/
      useEditorStore.ts      # Zustand store: state, CRUD, undo/redo history
    components/
      Toolbar.tsx            # Add elements, breakpoint preview, save/publish
      Canvas.tsx             # Desktop editing surface + tablet/mobile preview
      SelectionOverlay.tsx   # Resize & rotate handles (native pointer events)
      ElementView.tsx        # SHARED renderer (desktop + reflowed previews)
      LayersPanel.tsx        # Layer list, z-order, visibility, lock
      PropertiesPanel.tsx    # Edit selected element / page properties
    lib/
      persistence.ts         # LocalStorage autosave + JSON import/export
      reflow.ts              # Auto-reflow engine: desktop -> tablet/mobile
      exportSite.ts          # Serialize layout -> responsive static HTML
      image.ts               # Image upload -> downscaled data URL
```

The key design idea: **the layout is just data**. The editor writes
`layout.json`; `ElementView` renders it in edit mode; `exportSite.ts` serializes
the same data to a static site. Build the data model first, keep one shared
renderer, and the "design to website" pipeline follows.

---

## Common snags

- **`npm` not recognized** — Node isn't installed, or the terminal was opened
  before installing it. Install Node, then open a fresh terminal.
- **Port 5173 in use** — another Vite app is running; stop it, or let Vite pick
  the next free port automatically.
- **Blank page after moving the folder** — run `npm install` again in the new
  location so `node_modules` is present.

---

## Tech stack

- **React 18** + **TypeScript**
- **Vite** (dev server + build)
- **Zustand** (state management)
- **nanoid** (element IDs)
- Drag / resize / rotate implemented with native pointer events (no external
  drag library).

---

## Current limitations (MVP scope)

- Single page; the publisher exports that one page.
- Tablet and mobile layouts are auto-generated by a heuristic reflow engine
  (scale for tablet, stack for mobile). You can't hand-tune a single breakpoint
  independently — you adjust the desktop design and the others follow. Custom
  breakpoints aren't configurable yet.
- Fixed 1:1 canvas zoom.
- Uploaded images are embedded directly in the project as data URLs (downscaled
  to a 1600px longest edge to stay within the browser's ~5MB LocalStorage
  limit). They survive refresh and embed into the exported HTML, so the
  published site is self-contained. Many large images can still exceed storage;
  for heavy image use, host them and reference by URL instead.

See `../BUILD_LAYOUT_EDITOR.md` for the full blueprint, including how to add
multi-page support, responsiveness, and cloud asset storage.
