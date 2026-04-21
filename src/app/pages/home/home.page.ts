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
  totalEarned: number;
  currentMonthEarned: number;
  projectCount: number;
  monthlyGoal: number;
  progressPercent: number;
}

interface BrowseProjectSummary {
  id: string;
  type: string;
  time: string;
  title: string;
  description: string;
  amount: string;
  deadline: string;
  category?: string;
  postedBy?: {
    id?: string;
    role?: 'freelancer' | 'client';
    name?: string;
    email?: string;
  };
}

interface RecentProjectCard {
  title: string;
  price: string;
  description: string;
  tags: string[];
}

interface ActiveMyjobSummary {
  proposalId: string;
  projectTitle: string;
  workflowStatus: string;
  acceptedAtLabel?: string;
  lastCommunicationAtLabel?: string;
  client?: {
    name?: string;
  };
  freelancer?: {
    name?: string;
  };
}

interface ActiveGigCard {
  title: string;
  company: string;
  due: string;
  progress: number;
  colorClass: 'primary' | 'secondary';
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

  recentProjects: RecentProjectCard[] = [];
  isLoadingRecentProjects = false;
  recentProjectsError = '';

  activeGigs: ActiveGigCard[] = [];
  isLoadingActiveGigs = false;
  activeGigsError = '';

  constructor(private readonly http: HttpClient) {
    this.loadProfile();
  }

  ngOnInit(): void {
    this.loadEarnings();
    this.loadRecentProjects();
    this.loadActiveProjects();
  }

  ionViewWillEnter(): void {
    this.loadProfile();
    this.loadEarnings();
    this.loadRecentProjects();
    this.loadActiveProjects();
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
      currency: 'USD'
    }).format(this.earnings.totalEarned || 0);
  }

  get earningsProgressPercent(): number {
    if (!this.earnings) return 0;
    return this.earnings.progressPercent || 0;
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

  private loadRecentProjects(): void {
    if (!this.profile.id) {
      this.recentProjects = [];
      return;
    }

    this.isLoadingRecentProjects = true;
    this.recentProjectsError = '';

    this.http.get<BrowseProjectSummary[]>(`${environment.apiUrl}/projects`).subscribe({
      next: (projects) => {
        this.isLoadingRecentProjects = false;

        const projectList = Array.isArray(projects) ? projects : [];
        const visibleProjects = this.profile.role === 'client'
          ? projectList.filter((project) =>
              project.postedBy?.id === this.profile.id && project.postedBy?.role === 'client'
            )
          : projectList;

        this.recentProjects = visibleProjects.slice(0, 6).map((project) => ({
          title: project.title || 'Untitled Project',
          price: project.amount || '$0',
          description: project.description || 'No description provided.',
          tags: [project.category || 'General', project.type || 'Project'].filter(Boolean)
        }));
      },
      error: (error) => {
        this.isLoadingRecentProjects = false;
        this.recentProjects = [];
        this.recentProjectsError = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to load recent projects right now.';
      }
    });
  }

  private loadActiveProjects(): void {
    if (!this.profile.id || !this.profile.role) {
      this.activeGigs = [];
      return;
    }

    this.isLoadingActiveGigs = true;
    this.activeGigsError = '';

    this.http.get<ActiveMyjobSummary[]>(`${environment.apiUrl}/myjobs/active`, {
      params: { userId: this.profile.id, role: this.profile.role }
    }).subscribe({
      next: (projects) => {
        this.isLoadingActiveGigs = false;
        this.activeGigs = (Array.isArray(projects) ? projects : []).slice(0, 6).map((project) => ({
          title: project.projectTitle || 'Untitled Project',
          company: this.profile.role === 'client'
            ? (project.freelancer?.name || 'Freelancer Project')
            : (project.client?.name || 'Client Project'),
          due: this.mapActiveProjectBadge(project),
          progress: this.mapWorkflowProgress(project.workflowStatus),
          colorClass: project.workflowStatus === 'completed' ? 'secondary' : 'primary'
        }));
      },
      error: (error) => {
        this.isLoadingActiveGigs = false;
        this.activeGigs = [];
        this.activeGigsError = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to load active projects right now.';
      }
    });
  }

  private mapWorkflowProgress(status: string): number {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return 100;
      case 'in-review':
        return 85;
      case 'in-progress':
      default:
        return 45;
    }
  }

  private mapActiveProjectBadge(project: ActiveMyjobSummary): string {
    const workflowStatus = (project.workflowStatus || '').toLowerCase();
    if (workflowStatus === 'completed') {
      return 'Completed';
    }
    if (workflowStatus === 'in-review') {
      return 'In Review';
    }
    return project.lastCommunicationAtLabel || project.acceptedAtLabel || 'Active';
  }
}
