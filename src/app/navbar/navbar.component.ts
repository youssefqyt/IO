import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class NavbarComponent {
  private router = inject(Router);

  isActive(url: string): boolean {
    if (url === '/market') {
      return (
        this.router.url === '/market' ||
        this.router.url.startsWith('/browse-project') ||
        this.router.url.startsWith('/post-project') ||
        this.router.url.startsWith('/submit-proposal') ||
        this.router.url.startsWith('/pay')
      );
    }
    return this.router.url === url;
  }
}
