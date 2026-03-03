import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class SettingsComponent {
  constructor(private readonly router: Router) { }

  goToProfile(): void {
    this.router.navigateByUrl('/profile');
  }

  onLogout(): void {
    localStorage.removeItem('fw_token');
    localStorage.removeItem('fw_profile');
    this.router.navigateByUrl('/login');
  }
  goToAccountSecurity(): void {
    this.router.navigateByUrl('/accounte-securite');
  }
}

