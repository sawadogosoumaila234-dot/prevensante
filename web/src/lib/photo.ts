/**
 * Compression des photos cote client (section 11.4).
 *
 * Redimensionnement a 1600 px de cote maximal, qualite 70 %, encodage `webp`
 * puis repli `jpeg`.
 */

export interface CompressedPhoto {
  id: string;
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  name: string;
  size: number;
}

const MAX_EDGE = 1600;
const QUALITY = 0.7;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be read.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Compresse une image ; renvoie null si le format n'est pas supporte. */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The image could not be processed.');
  ctx.drawImage(img, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 'image/webp', QUALITY);
  let type = 'image/webp';
  if (!blob || blob.size === 0) {
    blob = await canvasToBlob(canvas, 'image/jpeg', QUALITY);
    type = 'image/jpeg';
  }
  if (!blob) throw new Error('The image could not be compressed.');

  const dataUrl = canvas.toDataURL(type, QUALITY);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    blob,
    dataUrl,
    width,
    height,
    name: file.name,
    size: blob.size,
  };
}
