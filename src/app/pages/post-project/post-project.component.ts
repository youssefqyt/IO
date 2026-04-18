import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface StoredProfile {
  id?: string;
  fullName?: string;
  email?: string;
  role?: 'freelancer' | 'client';
}

@Component({
  selector: 'app-post-project',
  templateUrl: './post-project.component.html',
  styleUrls: ['./post-project.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonicModule],
})
export class PostProjectComponent {
  readonly selectPopoverOptions = {
    cssClass: 'post-project-select-popover',
    side: 'bottom',
    alignment: 'start',
  };

  projectTitle = '';
  projectType: 'project' | 'hourly' | 'fixed-price' = 'project';
  category = '';
  description = '';
  budget: number | null = null;
  deadline: number | null = null;
  briefFileName = '';
  briefFileData = '';
  isReadingBrief = false;
  successMessage = '';
  submitError = '';
  isSubmitting = false;

  readonly categories = [
    { value: 'design', label: 'Graphic Design' },
    { value: 'dev', label: 'Web Development' },
    { value: 'writing', label: 'Content Writing' },
    { value: 'marketing', label: 'Digital Marketing' },
  ];

  readonly projectTypes = [
    { value: 'project', label: 'Project' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'fixed-price', label: 'Fixed Price' },
  ] as const;

  constructor(
    private readonly location: Location,
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  goBack(): void {
    this.location.back();
  }

  onBriefSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.briefFileName = '';
      this.briefFileData = '';
      this.isReadingBrief = false;
      return;
    }

    this.briefFileName = file.name;
    this.briefFileData = '';
    this.isReadingBrief = true;
    const reader = new FileReader();
    reader.onload = () => {
      this.briefFileData = typeof reader.result === 'string' ? reader.result : '';
      this.isReadingBrief = false;
    };
    reader.onerror = () => {
      this.briefFileData = '';
      this.isReadingBrief = false;
      this.submitError = 'Unable to read the attached file. Please try selecting it again.';
    };
    reader.readAsDataURL(file);
  }

  postProject(): void {
    this.successMessage = '';
    this.submitError = '';

    const profile = this.getStoredProfile();
    if (!profile?.id || !profile?.role) {
      this.submitError = 'Please log in again before posting a project.';
      return;
    }

    if (this.isReadingBrief) {
      this.submitError = 'Please wait for the attached file to finish loading.';
      return;
    }

    if (this.budget === null || this.budget <= 0 || this.deadline === null || this.deadline <= 0) {
      this.submitError = 'Budget and deadline must be valid numbers greater than 0.';
      return;
    }

    this.isSubmitting = true;

    this.http.post<{ message: string }>(`${environment.apiUrl}/projects`, {
      title: this.projectTitle.trim(),
      projectType: this.projectType,
      category: this.category,
      description: this.description.trim(),
      budget: this.budget,
      deadline: this.deadline,
      briefFileName: this.briefFileName,
      briefFileData: this.briefFileData,
      postedBy: {
        id: profile.id,
        role: profile.role,
        fullName: profile.fullName || '',
        email: profile.email || ''
      }
    }).subscribe({
      next: async (response) => {
        this.isSubmitting = false;
        this.successMessage = response.message || 'Project posted successfully';
        this.resetForm();
        await this.router.navigateByUrl('/browse-project', { replaceUrl: true });
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitError = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to post project right now.';
      }
    });
  }

  goTo(route: string): void {
    void this.router.navigateByUrl(route);
  }

  private getStoredProfile(): StoredProfile | null {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredProfile;
    } catch {
      return null;
    }
  }

  private resetForm(): void {
    this.projectTitle = '';
    this.projectType = 'project';
    this.category = '';
    this.description = '';
    this.budget = null;
    this.deadline = null;
    this.briefFileName = '';
    this.briefFileData = '';
    this.isReadingBrief = false;
  }
}
