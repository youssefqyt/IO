import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

interface SettingsProfile {
  fullName: string;
  title?: string;
  role?: 'freelancer' | 'client';
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class SettingsComponent {
  isDarkMode = false;
  profile: SettingsProfile = {
    fullName: 'Alex Sterling',
    title: 'Senior Brand Designer',
    role: 'freelancer'
  };

  constructor(private readonly router: Router) { }
  ionViewWillEnter(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');
    this.loadProfile();
  }

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

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    document.body.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('fw_theme', this.isDarkMode ? 'dark' : 'light');
  }

  private loadProfile(): void {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SettingsProfile>;
      this.profile = {
        fullName: parsed.fullName || this.profile.fullName,
        title: parsed.title || (parsed.role === 'client' ? 'Client Account' : this.profile.title),
        role: parsed.role === 'client' ? 'client' : 'freelancer'
      };
    } catch {
    }
  }
}

