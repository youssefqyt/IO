import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface HomeProfile {
  fullName: string;
  role: 'freelancer' | 'client';
  title?: string;
  id?: string;
}

interface EarningsSummary {
  totalEarnings: number;
  paymentCount: number;
  projectCount: number;
  currency: string;
  recentPayments: Array<{
    projectId: string;
    projectTitle: string;
    amount: number;
    paidAtLabel: string;
  }>;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  profile: HomeProfile = {
    fullName: 'Alex Sterling',
    role: 'freelancer',
    title: 'Senior Brand Designer'
  };

  earnings: EarningsSummary | null = null;
  isLoadingEarnings = false;
  earningsError = '';

  readonly recentProjects = [
    {
      title: 'Brand Identity Design',
      price: '$1,200',
      description: 'Create a modern brand identity including logo, palette, and typography for a startup.',
      tags: ['Branding', 'Logo']
    },
    {
      title: 'iOS Fitness Tracker',
      price: '$3,500',
      description: 'Full UI/UX design and prototyping for a high-end wellness and fitness tracking app.',
      tags: ['Mobile', 'UI/UX']
    },
    {
      title: 'Shopify Headless CMS',
      price: '$2,800',
      description: 'Implementation of a headless Shopify storefront using React and Tailwind CSS.',
      tags: ['Web', 'Development']
    }
  ];

  readonly activeGigs = [
    {
      title: 'Mobile UI Design System',
      company: 'TechNova Solutions',
      due: 'Due in 2d',
      progress: 85,
      colorClass: 'secondary'
    },
    {
      title: 'E-commerce Backend API',
      company: 'LuxeRetail Co.',
      due: 'Due in 5d',
      progress: 40,
      colorClass: 'primary'
    }
  ];

  constructor(private readonly http: HttpClient) {
    this.loadProfile();
  }

  ngOnInit(): void {
    this.loadEarnings();
  }

  ionViewWillEnter(): void {
    this.loadProfile();
    this.loadEarnings();
  }

  get firstName(): string {
    const trimmed = this.profile.fullName.trim();
    return trimmed ? trimmed.split(' ')[0] : 'there';
  }

  get modeLabel(): string {
    return this.profile.role === 'client' ? 'Client Mode' : 'Freelancer Mode';
  }

  get isClientMode(): boolean {
    return this.profile.role === 'client';
  }

  get totalEarnings(): string {
    if (!this.earnings) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.earnings.currency || 'USD'
    }).format(this.earnings.totalEarnings);
  }

  get earningsProgressPercent(): number {
    if (!this.earnings) return 0;
    const monthlyGoal = 7000; // This could be configurable
    return Math.min((this.earnings.totalEarnings / monthlyGoal) * 100, 100);
  }

  private loadProfile(): void {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<HomeProfile>;
      this.profile = {
        fullName: parsed.fullName || this.profile.fullName,
        role: parsed.role === 'client' ? 'client' : 'freelancer',
        title: parsed.title || this.profile.title,
        id: parsed.id
      };
    } catch {
    }
  }

  private loadEarnings(): void {
    if (!this.profile.id || this.profile.role !== 'freelancer') {
      this.earnings = null;
      return;
    }

    this.isLoadingEarnings = true;
    this.earningsError = '';

    this.http.get<EarningsSummary>(`${environment.apiUrl}/myjobs/earnings-summary`, {
      params: { userId: this.profile.id, role: this.profile.role }
    }).subscribe({
      next: (summary) => {
        this.isLoadingEarnings = false;
        this.earnings = summary;
      },
      error: (error) => {
        this.isLoadingEarnings = false;
        this.earnings = null;
        this.earningsError = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to load earnings right now.';
      }
    });
  }
}