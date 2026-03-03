import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

interface ProfileData {
  fullName: string;
  email: string;
  role: 'freelancer' | 'client';
  skills: string[];
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ProfileComponent implements OnInit {
  profile: ProfileData = {
    fullName: 'Alex Sterling',
    email: 'alex.sterling@design.co',
    role: 'freelancer',
    skills: ['UI/UX Design', 'Branding', 'Figma', 'Interaction', 'Motion']
  };

  ngOnInit(): void {
    this.loadProfile();
  }

  ionViewWillEnter(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<ProfileData>;
      this.profile = {
        fullName: parsed.fullName || this.profile.fullName,
        email: parsed.email || this.profile.email,
        role: parsed.role === 'client' ? 'client' : 'freelancer',
        skills: Array.isArray(parsed.skills) && parsed.skills.length > 0
          ? parsed.skills
          : this.profile.skills
      };
    } catch {
      // Ignore invalid local storage payload and keep defaults.
    }
  }
}
