import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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

interface FreelancerReview {
  id: string;
  proposalId: string;
  projectId: string;
  projectTitle: string;
  clientId: string;
  freelancerId: string;
  professionalismRating: number;
  qualityOfCodeRating: number;
  overallRating: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ReviewsSummary {
  totalReviews: number;
  averageProfessionalism: number;
  averageQualityOfCode: number;
  averageOverallRating: number;
}

interface ReviewsResponse {
  summary: ReviewsSummary;
  reviews: FreelancerReview[];
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class ProfileComponent implements OnInit {
  readonly apiUrl = environment.apiUrl;

  showCvPreview = false;
  safeCvUrl: SafeResourceUrl | null = null;
  reviews: FreelancerReview[] = [];
  reviewsSummary: ReviewsSummary = {
    totalReviews: 0,
    averageProfessionalism: 0,
    averageQualityOfCode: 0,
    averageOverallRating: 0
  };
  isLoadingReviews = false;
  reviewsError = '';
  showAllReviews = false;
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
    private readonly sanitizer: DomSanitizer,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadReviews();
  }

  ionViewWillEnter(): void {
    this.loadProfile();
    this.loadReviews();
  }

  private loadProfile(): void {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<ProfileData>;
      this.profile = {
        id: parsed.id || this.profile.id,
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

  private loadReviews(): void {
    this.reviewsError = '';

    if (!this.profile?.id || this.profile.role !== 'freelancer') {
      this.reviews = [];
      this.reviewsSummary = {
        totalReviews: 0,
        averageProfessionalism: 0,
        averageQualityOfCode: 0,
        averageOverallRating: 0
      };
      return;
    }

    this.isLoadingReviews = true;
    this.http.get<ReviewsResponse>(`${this.apiUrl}/rates`, {
      params: {
        freelancerId: this.profile.id
      }
    }).subscribe({
      next: (response) => {
        this.isLoadingReviews = false;
        this.reviews = Array.isArray(response?.reviews) ? response.reviews : [];
        this.reviewsSummary = response?.summary || {
          totalReviews: 0,
          averageProfessionalism: 0,
          averageQualityOfCode: 0,
          averageOverallRating: 0
        };
      },
      error: () => {
        this.isLoadingReviews = false;
        this.reviews = [];
        this.reviewsSummary = {
          totalReviews: 0,
          averageProfessionalism: 0,
          averageQualityOfCode: 0,
          averageOverallRating: 0
        };
        this.reviewsError = 'Unable to load reviews right now.';
      }
    });
  }

  get displayedReviews(): FreelancerReview[] {
    return this.showAllReviews ? this.reviews : this.reviews.slice(0, 3);
  }

  toggleShowAllReviews(): void {
    this.showAllReviews = !this.showAllReviews;
  }

  getStars(value: number): number[] {
    const rounded = Math.round(value || 0);
    return [1, 2, 3, 4, 5].map((star) => (star <= rounded ? 1 : 0));
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
