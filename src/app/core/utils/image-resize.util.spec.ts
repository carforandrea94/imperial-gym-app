import { describe, it, expect } from 'vitest';
import { computeScaledDimensions } from './image-resize.util';

describe('computeScaledDimensions', () => {
  it('non ridimensiona se già entro il limite', () => {
    expect(computeScaledDimensions(800, 600, 1080)).toEqual({ width: 800, height: 600 });
  });

  it('ridimensiona un\'immagine landscape più larga del limite', () => {
    expect(computeScaledDimensions(2000, 1500, 1080)).toEqual({ width: 1080, height: 810 });
  });

  it('ridimensiona un\'immagine portrait più alta del limite', () => {
    expect(computeScaledDimensions(1500, 2000, 1080)).toEqual({ width: 810, height: 1080 });
  });

  it('non ridimensiona se esattamente al limite', () => {
    expect(computeScaledDimensions(1080, 1080, 1080)).toEqual({ width: 1080, height: 1080 });
  });

  it('non ingrandisce immagini più piccole del limite', () => {
    expect(computeScaledDimensions(200, 150, 1080)).toEqual({ width: 200, height: 150 });
  });
});
