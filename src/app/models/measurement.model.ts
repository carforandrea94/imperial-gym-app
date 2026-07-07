export interface MeasurementEntry {
  date: string; // ISO yyyy-mm-dd
  peso: string | null;
  altezza: string | null;
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

export const MEASURE_CARD_1: MeasureField[] = [
  { key: 'peso', label: 'Peso', unit: 'kg' },
  { key: 'altezza', label: 'Altezza', unit: 'cm' }
];

export const MEASURE_CARD_2: MeasureField[] = [
  { key: 'plicaPetto', label: 'Plica petto', unit: 'mm' },
  { key: 'plicaAddome', label: 'Plica addome', unit: 'mm' },
  { key: 'plicaVita', label: 'Plica vita', unit: 'mm' },
  { key: 'plicaGambaSx', label: 'Plica gamba Sx', unit: 'mm' },
  { key: 'plicaGambaDx', label: 'Plica gamba Dx', unit: 'mm' }
];

export const MEASURE_CARD_3: MeasureField[] = [
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

export const ALL_MEASURE_FIELDS: MeasureField[] = [
  ...MEASURE_CARD_1, ...MEASURE_CARD_2, ...MEASURE_CARD_3
];

export function emptyMeasurementEntry(date: string): MeasurementEntry {
  const entry = { date } as MeasurementEntry;
  ALL_MEASURE_FIELDS.forEach(f => { (entry as any)[f.key] = null; });
  return entry;
}
