export interface ProgressiRecord {
  date: string; // ISO yyyy-mm-dd, anche ID documento
  fronteUrl: string;
  retroUrl: string;
  lateraleUrl: string;
}

export type ProgressiPhotoType = 'fronte' | 'retro' | 'laterale';

export const PROGRESSI_PHOTO_LABELS: Record<ProgressiPhotoType, string> = {
  fronte: 'Fronte',
  retro: 'Retro',
  laterale: 'Laterale'
};

// L'ordine qui e' l'ordine in cui vengono mostrati i riquadri di upload e i
// tab di confronto. Task successive (ProgressiUploadComponent) si aspettano
// che questo array abbia esattamente questi 3 elementi in questo ordine.
export const PROGRESSI_PHOTO_TYPES: ProgressiPhotoType[] = ['fronte', 'retro', 'laterale'];
