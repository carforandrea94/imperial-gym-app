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
    // Lucide nasce con il tratto a 2; il registro dell'app e' 1,9, lo stesso
    // delle icone dei gruppi muscolari. Impostarlo qui evita di ripeterlo su
    // cinquantasette elementi.
    { provide: LucideIconConfig, useValue: Object.assign(new LucideIconConfig(), { strokeWidth: 1.9 }) },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
