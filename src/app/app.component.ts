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
  constructor() {
    this.applyThemeOnStart();
  }

  private applyThemeOnStart(): void {
    const savedTheme = localStorage.getItem('fw_theme');
    const isDarkMode = savedTheme
      ? savedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;

    this.applyThemeClass(isDarkMode);
  }

  private applyThemeClass(isDarkMode: boolean): void {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('dark', isDarkMode);
  }

  showNavbar(): boolean {
    const hiddenRoutes = ['/', '/start', '/login', '/sign', '/accountecreated', '/interest-start', '/guest'];
    return !hiddenRoutes.includes(this.router.url)
      && !this.router.url.startsWith('/admin')
      && !this.router.url.startsWith('/edit-profile')
      && !this.router.url.startsWith('/message/chat')
      && !this.router.url.startsWith('/add-product')
      && !this.router.url.startsWith('/post-project');
  }
}
