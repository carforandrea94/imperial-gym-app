import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'scheda', pathMatch: 'full' },
  {
    path: 'scheda',
    loadComponent: () => import('./pages/scheda-list/scheda-list.component').then(m => m.SchedaListComponent)
  },
  {
    path: 'scheda/day/:n',
    loadComponent: () => import('./pages/scheda-detail/scheda-detail.component').then(m => m.SchedaDetailComponent)
  },
  {
    path: 'scheda/storico',
    loadComponent: () => import('./pages/history-list/history-list.component').then(m => m.HistoryListComponent)
  },
  {
    path: 'scheda/storico/:key',
    loadComponent: () => import('./pages/history-detail/history-detail.component').then(m => m.HistoryDetailComponent)
  },
  {
    path: 'scheda/info',
    loadComponent: () => import('./pages/scheda-info/scheda-info.component').then(m => m.SchedaInfoComponent)
  },
  {
    path: 'dieta',
    loadComponent: () => import('./pages/dieta/dieta.component').then(m => m.DietaComponent)
  },
  { path: '**', redirectTo: 'scheda' }
];
