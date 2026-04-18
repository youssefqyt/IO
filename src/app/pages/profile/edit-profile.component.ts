import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

interface ProfileData {
  id?: string;
  fullName: string;
  email: string;
  role: 'freelancer' | 'client';
  skills: string[];
  title?: string;
  bio?: string;
  cvFileName?: string;
  cvFileData?: string;
}

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class EditProfileComponent {
  fullName = '';
  title = '';
  bio = '';
  cvFileName = '';
  cvFileData = '';
  skills: string[] = [];
  skillInput = '';
  saveMessage = '';

  constructor(private readonly location: Location) {
    this.loadProfile();
  }

  goBack(): void {
    this.location.back();
  }

  onCvSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.cvFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.cvFileData = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  confirmProfile(): void {
    const raw = localStorage.getItem('fw_profile');
    let current: ProfileData = {
      fullName: '',
      email: '',
      role: 'freelancer',
      skills: []
    };

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ProfileData>;
        current = {
          id: parsed.id || '',
          fullName: parsed.fullName || '',
          email: parsed.email || '',
          role: parsed.role === 'client' ? 'client' : 'freelancer',
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          title: parsed.title || '',
          bio: parsed.bio || '',
          cvFileName: parsed.cvFileName || '',
          cvFileData: parsed.cvFileData || ''
        };
      } catch {
      }
    }

    const updated: ProfileData = {
      ...current,
      fullName: this.fullName.trim() || current.fullName,
      title: this.title.trim(),
      bio: this.bio.trim(),
      skills: this.skills,
      cvFileName: this.cvFileName || current.cvFileName,
      cvFileData: this.cvFileData || current.cvFileData
    };

    localStorage.setItem('fw_profile', JSON.stringify(updated));
    this.saveMessage = 'Profile updated successfully';
  }

  private loadProfile(): void {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ProfileData>;
      this.fullName = parsed.fullName || '';
      this.title = parsed.title || '';
      this.bio = parsed.bio || '';
      this.skills = Array.isArray(parsed.skills) ? parsed.skills : [];
      this.cvFileName = parsed.cvFileName || '';
      this.cvFileData = parsed.cvFileData || '';
    } catch {
    }
  }

  addSkill(): void {
    const normalized = this.skillInput.trim();
    if (!normalized) {
      return;
    }

    const exists = this.skills.some((skill) => skill.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      this.skillInput = '';
      return;
    }

    if (this.skills.length >= 10) {
      return;
    }

    this.skills = [...this.skills, normalized];
    this.skillInput = '';
  }

  removeSkill(skillToRemove: string): void {
    this.skills = this.skills.filter((skill) => skill !== skillToRemove);
  }

  onSkillEnter(event: Event): void {
    event.preventDefault();
    this.addSkill();
  }
}
