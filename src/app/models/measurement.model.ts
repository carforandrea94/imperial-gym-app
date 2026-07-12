export interface MeasurementEntry {
  date: string; // ISO yyyy-mm-dd
  peso: string | null;
  plicaPetto: string | null;
  plicaAddome: string | null;
  plicaVita: string | null;
  plicaGambaSx: string | null;
  plicaGambaDx: string | null;
  cmPetto: string | null;
  cmAddome: string | null;
  cmVita: string | null;
  cmGambaSx: string | null;
  cmGambaDx: string | null;
  cmBicipiteSx: string | null;
  cmBicipiteDx: string | null;
  cmPolpaccioSx: string | null;
  cmPolpaccioDx: string | null;
  cmCavigliaSx: string | null;
  cmCavigliaDx: string | null;
}

export type MeasurementKey = Exclude<keyof MeasurementEntry, 'date'>;

export interface MeasureField {
  key: MeasurementKey;
  label: string;
  unit: string;
}

export type MeasureCategory = 'peso' | 'centimetri' | 'pliche';

export const PESO_FIELDS: MeasureField[] = [
  { key: 'peso', label: 'Peso', unit: 'kg' }
];

export const PLICHE_FIELDS: MeasureField[] = [
  { key: 'plicaPetto', label: 'Plica petto', unit: 'mm' },
  { key: 'plicaAddome', label: 'Plica addome', unit: 'mm' },
  { key: 'plicaVita', label: 'Plica vita', unit: 'mm' },
  { key: 'plicaGambaSx', label: 'Plica gamba Sx', unit: 'mm' },
  { key: 'plicaGambaDx', label: 'Plica gamba Dx', unit: 'mm' }
];

export const CENTIMETRI_FIELDS: MeasureField[] = [
  { key: 'cmPetto', label: 'Petto', unit: 'cm' },
  { key: 'cmAddome', label: 'Addome', unit: 'cm' },
  { key: 'cmVita', label: 'Vita', unit: 'cm' },
  { key: 'cmGambaSx', label: 'Gamba Sx', unit: 'cm' },
  { key: 'cmGambaDx', label: 'Gamba Dx', unit: 'cm' },
  { key: 'cmBicipiteSx', label: 'Bicipite Sx', unit: 'cm' },
  { key: 'cmBicipiteDx', label: 'Bicipite Dx', unit: 'cm' },
  { key: 'cmPolpaccioSx', label: 'Polpaccio Sx', unit: 'cm' },
  { key: 'cmPolpaccioDx', label: 'Polpaccio Dx', unit: 'cm' },
  { key: 'cmCavigliaSx', label: 'Caviglia Sx', unit: 'cm' },
  { key: 'cmCavigliaDx', label: 'Caviglia Dx', unit: 'cm' }
];

export const CATEGORY_FIELDS: Record<MeasureCategory, MeasureField[]> = {
  peso: PESO_FIELDS,
  centimetri: CENTIMETRI_FIELDS,
  pliche: PLICHE_FIELDS
};

export const CATEGORY_LABELS: Record<MeasureCategory, string> = {
  peso: 'Peso',
  centimetri: 'Centimetri',
  pliche: 'Pliche'
};

export const CATEGORY_UNIT_BADGE: Record<MeasureCategory, string> = {
  peso: 'kg',
  centimetri: 'cm',
  pliche: 'mm'
};

export const ALL_MEASURE_FIELDS: MeasureField[] = [
  ...PESO_FIELDS, ...PLICHE_FIELDS, ...CENTIMETRI_FIELDS
];

export function emptyMeasurementEntry(date: string): MeasurementEntry {
  const entry = { date } as MeasurementEntry;
  ALL_MEASURE_FIELDS.forEach(f => { (entry as any)[f.key] = null; });
  return entry;
}
