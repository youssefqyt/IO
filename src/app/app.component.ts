import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public router = inject(Router);
  constructor() {}

  showNavbar(): boolean {
    const hiddenRoutes = ['/', '/start', '/login', '/sign'];
    return !hiddenRoutes.includes(this.router.url);
  }
}
