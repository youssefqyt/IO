import { Component } from '@angular/core';

interface HomeProfile {
  fullName: string;
  role: 'freelancer' | 'client';
  title?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  profile: HomeProfile = {
    fullName: 'Alex Sterling',
    role: 'freelancer',
    title: 'Senior Brand Designer'
  };

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

  constructor() {
    this.loadProfile();
  }

  ionViewWillEnter(): void {
    this.loadProfile();
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
        title: parsed.title || this.profile.title
      };
    } catch {
    }
  }
}
