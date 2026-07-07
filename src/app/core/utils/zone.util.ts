import { NgZone } from '@angular/core';

/**
 * L'SDK Firebase "puro" (non integrato con Angular tramite AngularFire) puo'
 * risolvere le proprie Promise fuori dalla zone di Angular: i dati si
 * aggiornano correttamente in memoria, ma la vista non viene ridisegnata
 * per mostrarli, dando l'impressione di un caricamento bloccato per sempre.
 *
 * Questo helper forza esplicitamente il rientro nella zone di Angular alla
 * risoluzione (o al rifiuto) della Promise, cosi' il change detection
 * riparte sempre correttamente.
 */
export function inZone<T>(zone: NgZone, promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    promise.then(
      value => zone.run(() => resolve(value)),
      error => zone.run(() => reject(error))
    );
  });
}
