import type { Project } from "../types";

const STORAGE_KEY = "layout-editor:project";

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (err) {
    // Storage can fail (quota, private mode). Non-fatal for the editor.
    console.warn("Failed to save project:", err);
  }
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    if (!parsed.pages || parsed.pages.length === 0) return null;
    return parsed;
  } catch (err) {
    console.warn("Failed to load project:", err);
    return null;
  }
}

export function clearProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Download the project as a .json file.
export function downloadProjectJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${slug(project.name)}.json`);
}

// Read a user-picked .json file back into a Project.
export function readProjectFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as Project);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
}
