import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { environment } from '../../../environments/environment';

interface ProjectDetailsResponse {
  id: string;
  title: string;
  time: string;
  amount: string;
  deadline: string;
  briefFileName?: string;
  briefFileData?: string;
}

interface StoredProfile {
  id?: string;
  fullName?: string;
  email?: string;
  role?: 'freelancer' | 'client';
}

@Component({
  selector: 'app-submit-proposal',
  templateUrl: './submit-proposal.component.html',
  styleUrls: ['./submit-proposal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonicModule]
})
export class SubmitProposalComponent implements OnInit {
  projectId = '';
  projectTitle = 'UX/UI Designer for Modern FinTech Dashboard';
  postedAt = '2h ago';
  budgetRange = '$1,200 - $2,500';
  deadline = '14 Days';
  briefFileName = '';
  briefFileData = '';
  proposalFileName = '';
  proposalFileData = '';
  isReadingProposalFile = false;
  showFilePreview = false;
  safePreviewUrl: SafeResourceUrl | null = null;
  isPreviewPdf = false;
  isPreviewImage = false;
  previewTitle = '';

  pitch = '';
  bid: number | null = null;
  duration = '1 to 2 weeks';
  milestonesEnabled = false;
  successMessage = '';
  briefError = '';
  proposalError = '';
  isSubmitting = false;

  readonly durations = ['1-3 Days', 'Less than 1 week', '1 to 2 weeks', '1 month +'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly location: Location,
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.projectId = query.get('id') || '';
    this.projectTitle = query.get('title') || this.projectTitle;
    this.postedAt = query.get('time') || this.postedAt;
    this.budgetRange = query.get('budget') || this.budgetRange;
    this.deadline = query.get('deadline') || this.deadline;
    this.briefFileName = query.get('briefFileName') || '';

    if (this.projectId) {
      this.loadProjectDetails(this.projectId);
    }
  }

  goBack(): void {
    this.location.back();
  }

  submitProposal(): void {
    this.successMessage = '';
    this.proposalError = '';

    const profile = this.getStoredProfile();
    if (!profile?.id || !profile?.role) {
      this.proposalError = 'Please log in again before submitting a proposal.';
      return;
    }

    if (!this.projectId) {
      this.proposalError = 'This project cannot accept proposals right now.';
      return;
    }

    if (!this.pitch.trim()) {
      this.proposalError = 'Please add your pitch before submitting.';
      return;
    }

    if (this.bid === null || this.bid <= 0) {
      this.proposalError = 'Please enter a valid bid greater than 0.';
      return;
    }

    if (this.isReadingProposalFile) {
      this.proposalError = 'Please wait for the proposal attachment to finish loading.';
      return;
    }

    this.isSubmitting = true;
    this.http.post<{ message: string }>(`${environment.apiUrl}/proposals`, {
      projectId: this.projectId,
      pitch: this.pitch.trim(),
      bid: this.bid,
      duration: this.duration,
      milestonesEnabled: this.milestonesEnabled,
      attachmentFileName: this.proposalFileName,
      attachmentFileData: this.proposalFileData,
      submittedBy: {
        id: profile.id,
        role: profile.role,
        fullName: profile.fullName || '',
        email: profile.email || ''
      }
    }).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = response.message || 'Proposal submitted successfully';
        this.resetProposalForm();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.proposalError = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to submit proposal right now.';
      }
    });
  }

  openBrief(): void {
    if (!this.briefFileData) {
      this.briefError = 'This attached file is not available for preview. Please re-upload the project brief.';
      return;
    }

    this.briefError = '';
    this.openFilePreview(this.briefFileName, this.briefFileData);
  }

  onProposalFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.proposalFileName = '';
      this.proposalFileData = '';
      this.isReadingProposalFile = false;
      return;
    }

    this.proposalError = '';
    this.proposalFileName = file.name;
    this.proposalFileData = '';
    this.isReadingProposalFile = true;

    const reader = new FileReader();
    reader.onload = () => {
      this.proposalFileData = typeof reader.result === 'string' ? reader.result : '';
      this.isReadingProposalFile = false;
    };
    reader.onerror = () => {
      this.proposalFileData = '';
      this.isReadingProposalFile = false;
      this.proposalError = 'Unable to read the proposal attachment. Please try again.';
    };
    reader.readAsDataURL(file);
  }

  openProposalAttachment(): void {
    if (!this.proposalFileData) {
      this.proposalError = 'Please attach a readable proposal file first.';
      return;
    }

    this.proposalError = '';
    this.openFilePreview(this.proposalFileName, this.proposalFileData);
  }

  closePreview(): void {
    this.showFilePreview = false;
    this.safePreviewUrl = null;
    this.previewTitle = '';
  }

  private loadProjectDetails(projectId: string): void {
    this.http.get<ProjectDetailsResponse>(`${environment.apiUrl}/projects/${projectId}`).subscribe({
      next: (project) => {
        this.projectTitle = project.title || this.projectTitle;
        this.postedAt = project.time || this.postedAt;
        this.budgetRange = project.amount || this.budgetRange;
        this.deadline = project.deadline || this.deadline;
        this.briefFileName = project.briefFileName || this.briefFileName;
        this.briefFileData = project.briefFileData || '';
        this.briefError = '';
      },
      error: (error) => {
        console.error('Failed to load project details', error);
      }
    });
  }

  private openFilePreview(fileName: string, fileData: string): void {
    this.previewTitle = fileName;
    this.isPreviewPdf = fileData.startsWith('data:application/pdf');
    this.isPreviewImage = fileData.startsWith('data:image/');
    this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileData);
    this.showFilePreview = true;
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

  private resetProposalForm(): void {
    this.pitch = '';
    this.bid = null;
    this.duration = '1 to 2 weeks';
    this.milestonesEnabled = false;
    this.proposalFileName = '';
    this.proposalFileData = '';
    this.isReadingProposalFile = false;
  }
}
