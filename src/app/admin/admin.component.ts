import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { environment } from '../../environments/environment';

type ModerationKind = 'product';
type ModerationStatus = 'pending' | 'approved' | 'rejected';
type AdminView = 'dashboard' | 'config';

interface AdminProductRequest {
  id: string;
  title: string;
  category: string;
  studio: string;
  price: string | number;
  description: string;
  includes: string[];
  image: string;
  createdAt: string;
  submittedBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface ModerationItem {
  id: string;
  kind: ModerationKind;
  title: string;
  author: string;
  submittedAt: string;
  icon: string;
  accentClass: string;
  badgeClass: string;
  status: ModerationStatus;
  note: string;
  category: string;
  studio: string;
  price: string | number;
  description: string;
  includes: string[];
  image: string;
  submittedByEmail: string;
}

interface AdminDashboardStats {
  freelancerCount: number;
  clientCount: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  readonly apiUrl = environment.apiUrl;

  selectedView: AdminView = 'dashboard';
  activityMessage = 'Loading pending product requests...';
  isLoadingRequests = false;
  moderationItems: ModerationItem[] = [];

  quickStats = [
    {
      label: 'Client',
      value: '0',
      meta: 'Registered clients',
      icon: 'person',
      tone: 'primary'
    },
    {
      label: 'Freelancer',
      value: '0',
      meta: 'Registered freelancers',
      icon: 'badge',
      tone: 'primary'
    }
  ];

  readonly views: Array<{ id: AdminView; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dash', icon: 'dashboard' },
    { id: 'config', label: 'Config', icon: 'settings' }
  ];

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadDashboardStats();
    this.loadProductRequests();
  }

  private loadDashboardStats(): void {
    this.http.get<AdminDashboardStats>(`${this.apiUrl}/admin/dashboard-stats`).subscribe({
      next: (stats) => {
        this.quickStats = [
          {
            label: 'Client',
            value: String(stats?.clientCount ?? 0),
            meta: 'Registered clients',
            icon: 'person',
            tone: 'primary'
          },
          {
            label: 'Freelancer',
            value: String(stats?.freelancerCount ?? 0),
            meta: 'Registered freelancers',
            icon: 'badge',
            tone: 'primary'
          }
        ];
      },
      error: () => {
        this.activityMessage = 'Unable to load client and freelancer counts right now.';
      }
    });
  }

  private loadProductRequests(): void {
    this.isLoadingRequests = true;
    this.http.get<AdminProductRequest[]>(`${this.apiUrl}/admin/product-requests`).subscribe({
      next: (requests) => {
        this.moderationItems = (requests || []).map((request) => ({
          id: request.id,
          kind: 'product',
          title: request.title,
          author: request.submittedBy?.name || request.studio || 'Unknown user',
          submittedAt: request.createdAt,
          icon: 'inventory_2',
          accentClass: 'orange',
          badgeClass: 'product',
          status: 'pending',
          note: request.description || 'No description provided.',
          category: request.category || 'Uncategorized',
          studio: request.studio || 'Unknown studio',
          price: request.price || 0,
          description: request.description || '',
          includes: request.includes || [],
          image: request.image || '',
          submittedByEmail: request.submittedBy?.email || ''
        }));

        this.activityMessage = this.moderationItems.length
          ? `${this.moderationItems.length} product request(s) waiting for review.`
          : 'No pending product requests right now.';
        this.isLoadingRequests = false;
      },
      error: () => {
        this.moderationItems = [];
        this.activityMessage = 'Unable to load product requests right now.';
        this.isLoadingRequests = false;
      }
    });
  }

  get pendingItems(): ModerationItem[] {
    return this.moderationItems.filter((item) => item.status === 'pending');
  }

  get pendingProductsCount(): number {
    return this.pendingItems.length;
  }

  setView(view: AdminView): void {
    this.selectedView = view;
  }

  moderate(item: ModerationItem, status: Extract<ModerationStatus, 'approved' | 'rejected'>): void {
    const request$ =
      status === 'approved'
        ? this.http.post<{ message?: string }>(`${this.apiUrl}/admin/product-requests/${item.id}/approve`, {})
        : this.http.delete<{ message?: string }>(`${this.apiUrl}/admin/product-requests/${item.id}/reject`);

    request$.subscribe({
      next: (response) => {
        this.moderationItems = this.moderationItems.filter((request) => request.id !== item.id);
        this.activityMessage =
          response?.message ||
          `Product "${item.title}" was ${status === 'approved' ? 'approved and published' : 'rejected and removed'}.`;
      },
      error: () => {
        this.activityMessage = `Unable to ${status} product request "${item.title}" right now.`;
      }
    });
  }

  trackById(_: number, item: ModerationItem): string {
    return item.id;
  }
}
