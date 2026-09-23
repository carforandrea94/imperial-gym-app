import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { LucideAngularModule, LucideIconConfig } from 'lucide-angular';

import { routes } from './app.routes';
import { APP_ICONS } from './core/icons';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Le icone si registrano una volta sola qui: i componenti importano il
    // modulo per avere il selettore, non l'elenco.
    importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
    // Il tratto delle icone, in un posto solo invece che su cinquantasette
    // elementi. Vale 2, che e' anche il default di Lucide: lo fissiamo lo
    // stesso perche' le icone disegnate a mano (i gruppi muscolari, in
    // workout-data.service.ts) devono restare su questo valore, e un cambio
    // di default a monte le lascerebbe indietro in silenzio.
    { provide: LucideIconConfig, useValue: Object.assign(new LucideIconConfig(), { strokeWidth: 2 }) },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
