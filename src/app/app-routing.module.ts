import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'market',
    loadComponent: () => import('./pages/market/market.component').then( m => m.MarketComponent)
  },
  {
    path: 'message',
    loadComponent: () => import('./pages/message/message.component').then( m => m.MessageComponent)
  },
  {
    path: 'myjob',
    loadComponent: () => import('./pages/myjob/myjob.component').then( m => m.MyjobComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then( m => m.SettingsComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then( m => m.ProfileComponent)
  },
  {
    path: 'accounte-securite',
    loadComponent: () => import('./pages/settings/accounte-securite/accounte-securite.component').then( m => m.AccounteSecuriteComponent)
  },
  {
    path: 'start',
    loadComponent: () => import('./pages/start/start.component').then(m => m.StartComponent)
  },
  {
    path: 'interest-start',
    loadComponent: () => import('./pages/interest_start/interest_start.page').then(m => m.InterestStartPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'sign',
    loadComponent: () => import('./pages/sign/sign.component').then(m => m.SignComponent)
  },
  {
    path: 'accountecreated',
    loadComponent: () => import('./pages/accountecreated/accountecreated.component').then(m => m.AccountecreatedComponent)
  },
  {
    path: '',
    redirectTo: 'start',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }

