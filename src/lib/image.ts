// Turn a user-picked image File into a compressed data URL.
//
// Why a data URL (not createObjectURL)? Data URLs are plain strings, so they
// persist in the saved project JSON and embed directly into the exported HTML.
// That keeps uploaded images working after a refresh and in the published site,
// with no server or asset hosting required.
//
// Why downscale? base64 is ~33% larger than the binary, and LocalStorage caps
// around 5MB. Scaling large photos down to a sane max keeps the saved project
// and the exported file small enough to live in LocalStorage and open quickly.

export interface LoadedImage {
  src: string; // data URL
  width: number; // natural (post-scale) width
  height: number; // natural (post-scale) height
}

export interface ProcessOptions {
  maxDimension?: number; // longest edge, in px
  quality?: number; // 0..1 for lossy formats
}

const DEFAULTS: Required<ProcessOptions> = {
  maxDimension: 1600,
  quality: 0.85,
};

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export async function fileToLoadedImage(
  file: File,
  opts: ProcessOptions = {}
): Promise<LoadedImage> {
  const { maxDimension, quality } = { ...DEFAULTS, ...opts };

  if (!isImageFile(file)) {
    throw new Error("Not an image file");
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadHtmlImage(rawDataUrl);

  const { width, height } = fitWithin(
    img.naturalWidth,
    img.naturalHeight,
    maxDimension
  );

  // If it already fits and isn't a huge PNG, skip re-encoding and keep original.
  const needsResize =
    width !== img.naturalWidth || height !== img.naturalHeight;

  if (!needsResize) {
    return { src: rawDataUrl, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Canvas unavailable — fall back to the original data URL.
    return { src: rawDataUrl, width: img.naturalWidth, height: img.naturalHeight };
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Preserve PNG transparency; otherwise use JPEG for smaller size.
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const src =
    mime === "image/png"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", quality);

  return { src, width, height };
}

function fitWithin(
  w: number,
  h: number,
  max: number
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}
