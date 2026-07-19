/** Calcola le dimensioni scalate mantenendo l'aspect ratio, senza mai ingrandire. */
export function computeScaledDimensions(width: number, height: number, maxDim: number): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = maxDim / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Ridimensiona un file immagine via canvas prima dell'upload, per non
 * caricare foto da diversi MB direttamente dalla fotocamera. Richiede un
 * vero browser (Image/canvas) — non è unit-testato, verificato
 * manualmente nella task di integrazione (upload).
 */
export function resizeImageFile(file: File, maxDim = 1080, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const { width, height } = computeScaledDimensions(img.naturalWidth, img.naturalHeight, maxDim);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context non disponibile'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob); else reject(new Error('Impossibile generare il blob immagine'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile caricare l'immagine"));
    };
    img.src = url;
  });
}
