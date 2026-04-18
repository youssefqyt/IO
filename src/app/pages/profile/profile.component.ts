import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface ProfileData {
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
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class ProfileComponent implements OnInit {
  showCvPreview = false;
  safeCvUrl: SafeResourceUrl | null = null;
  profile: ProfileData = {
    fullName: 'Alex Sterling',
    email: 'alex.sterling@design.co',
    role: 'freelancer',
    skills: ['UI/UX Design', 'Branding', 'Figma', 'Interaction', 'Motion'],
    title: 'Senior Brand Designer',
    bio: 'Passionate designer with 8+ years of experience in creating cohesive brand identities and intuitive digital experiences.',
    cvFileName: '',
    cvFileData: ''
  };

  constructor(
    private readonly location: Location,
    private readonly sanitizer: DomSanitizer
  ) {}

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
          : this.profile.skills,
        title: parsed.title || this.profile.title,
        bio: parsed.bio || this.profile.bio,
        cvFileName: parsed.cvFileName || '',
        cvFileData: parsed.cvFileData || ''
      };
    } catch {
    }
  }

  openCvPreview(): void {
    if (!this.profile.cvFileData) {
      return;
    }

    this.safeCvUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.profile.cvFileData);
    this.showCvPreview = true;
  }

  closeCvPreview(): void {
    this.showCvPreview = false;
    this.safeCvUrl = null;
  }

  goBack(): void {
    this.location.back();
  }
}
