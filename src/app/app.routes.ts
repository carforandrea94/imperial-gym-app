import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { clientGuard } from './core/guards/client.guard';
import { coachGuard } from './core/guards/coach.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'scheda', pathMatch: 'full' },

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'registrati',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'coach/registrati',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/coach-register/coach-register.component').then(m => m.CoachRegisterComponent)
  },

  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent)
  },

  {
    path: 'coach/bacheca',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-bacheca/coach-bacheca.component').then(m => m.CoachBachecaComponent)
  },
  {
    path: 'coach/clienti',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-clienti/coach-clienti.component').then(m => m.CoachClientiComponent)
  },
  {
    path: 'coach/clienti/:clientId',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-client-detail/coach-client-detail.component').then(m => m.CoachClientDetailComponent)
  },
  {
    path: 'coach/clienti/:clientId/nuovo',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-new/coach-protocol-new.component').then(m => m.CoachProtocolNewComponent)
  },
  {
    path: 'coach/clienti/:clientId/importa-pdf',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-import/coach-protocol-import.component').then(m => m.CoachProtocolImportComponent)
  },
  {
    path: 'coach/clienti/:clientId/builder/:protocolId',
    canActivate: [authGuard, coachGuard],
    loadComponent: () => import('./pages/coach-protocol-builder/coach-protocol-builder.component').then(m => m.CoachProtocolBuilderComponent)
  },

  {
    path: 'scheda',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/scheda-list/scheda-list.component').then(m => m.SchedaListComponent)
  },
  {
    path: 'scheda/day/:n',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/scheda-detail/scheda-detail.component').then(m => m.SchedaDetailComponent)
  },
  {
    path: 'scheda/storico',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/history-list/history-list.component').then(m => m.HistoryListComponent)
  },
  {
    path: 'scheda/storico/:key',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/history-detail/history-detail.component').then(m => m.HistoryDetailComponent)
  },
  {
    path: 'scheda/info',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/scheda-info/scheda-info.component').then(m => m.SchedaInfoComponent)
  },
  {
    path: 'dieta',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/dieta/dieta.component').then(m => m.DietaComponent)
  },
  {
    path: 'dieta/lista-spesa',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/lista-spesa/lista-spesa.component').then(m => m.ListaSpesaComponent)
  },
  {
    path: 'dieta/:mode',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/dieta-detail/dieta-detail.component').then(m => m.DietaDetailComponent)
  },
  {
    path: 'misure',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misure/misure.component').then(m => m.MisureComponent)
  },
  {
    path: 'misure/storico',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misure-storico/misure-storico.component').then(m => m.MisureStoricoComponent)
  },
  {
    path: 'misure/analytics',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misure-analytics/misure-analytics.component').then(m => m.MisureAnalyticsComponent)
  },
  {
    path: 'misure/:categoria',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misura-categoria/misura-categoria.component').then(m => m.MisuraCategoriaComponent)
  },
  {
    path: 'misure/storico/:key',
    canActivate: [authGuard, clientGuard],
    loadComponent: () => import('./pages/misure-storico-detail/misure-storico-detail.component').then(m => m.MisureStoricoDetailComponent)
  },
  { path: '**', redirectTo: 'scheda' }
];
