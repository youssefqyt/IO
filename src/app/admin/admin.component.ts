import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';

type ModerationKind = 'account' | 'gig' | 'product';
type ModerationStatus = 'pending' | 'approved' | 'rejected';
type AdminView = 'dashboard' | 'review' | 'stats' | 'config';

interface ModerationItem {
  id: number;
  kind: ModerationKind;
  title: string;
  author: string;
  submittedAt: string;
  icon: string;
  accentClass: string;
  badgeClass: string;
  status: ModerationStatus;
  note: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  selectedView: AdminView = 'dashboard';
  activityMessage = 'Everything looks stable. 24 items are waiting for a decision.';

  readonly moderationItems: ModerationItem[] = [
    {
      id: 1,
      kind: 'account',
      title: 'Freelancer account verification for Alex Vector',
      author: '@alex_vector',
      submittedAt: '2 mins ago',
      icon: 'verified_user',
      accentClass: 'emerald',
      badgeClass: 'account',
      status: 'pending',
      note: 'Portfolio, identity, and contact details are ready for admin review.'
    },
    {
      id: 2,
      kind: 'gig',
      title: 'Professional Logo Design for SaaS Startups',
      author: '@alex_vector',
      submittedAt: '8 mins ago',
      icon: 'design_services',
      accentClass: 'blue',
      badgeClass: 'gig',
      status: 'pending',
      note: 'New freelancer gig creation submitted with branding samples and pricing.'
    },
    {
      id: 3,
      kind: 'product',
      title: 'Tailwind UI Kit - Pro Edition',
      author: '@dev_tools_inc',
      submittedAt: '15 mins ago',
      icon: 'inventory_2',
      accentClass: 'orange',
      badgeClass: 'product',
      status: 'pending',
      note: 'Marketplace product package includes Figma source, React components, and docs.'
    },
    {
      id: 4,
      kind: 'gig',
      title: 'Custom Smart Contract Development',
      author: '@eth_master',
      submittedAt: '42 mins ago',
      icon: 'code',
      accentClass: 'blue',
      badgeClass: 'gig',
      status: 'pending',
      note: 'Freelancer submitted a new blockchain development gig for moderation.'
    },
    {
      id: 5,
      kind: 'account',
      title: 'Freelancer account verification for Maya Studio',
      author: '@maya_studio',
      submittedAt: '1 hour ago',
      icon: 'badge',
      accentClass: 'emerald',
      badgeClass: 'account',
      status: 'pending',
      note: 'New design freelancer wants access to publish gigs and receive proposals.'
    },
    {
      id: 6,
      kind: 'product',
      title: 'Mobile Finance Icon Pack',
      author: '@pixel_supply',
      submittedAt: '2 hours ago',
      icon: 'widgets',
      accentClass: 'orange',
      badgeClass: 'product',
      status: 'pending',
      note: 'A new product creation for the marketplace with 120 premium app icons.'
    }
  ];

  readonly quickStats = [
    {
      label: 'Health',
      value: '98.4%',
      meta: '+0.2% vs LW',
      icon: 'trending_up',
      tone: 'success'
    },
    {
      label: 'Users',
      value: '12.4k',
      meta: '142 today',
      icon: 'group',
      tone: 'primary'
    }
  ];

  readonly views: Array<{ id: AdminView; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dash', icon: 'dashboard' },
    { id: 'review', label: 'Review', icon: 'rule' },
    { id: 'stats', label: 'Stats', icon: 'analytics' },
    { id: 'config', label: 'Config', icon: 'settings' }
  ];

  get pendingItems(): ModerationItem[] {
    return this.moderationItems.filter((item) => item.status === 'pending');
  }

  get approvedCount(): number {
    return this.moderationItems.filter((item) => item.status === 'approved').length;
  }

  get rejectedCount(): number {
    return this.moderationItems.filter((item) => item.status === 'rejected').length;
  }

  get pendingAccountsCount(): number {
    return this.pendingItems.filter((item) => item.kind === 'account').length;
  }

  get pendingGigsCount(): number {
    return this.pendingItems.filter((item) => item.kind === 'gig').length;
  }

  get pendingProductsCount(): number {
    return this.pendingItems.filter((item) => item.kind === 'product').length;
  }

  setView(view: AdminView): void {
    this.selectedView = view;
  }

  moderate(item: ModerationItem, status: Extract<ModerationStatus, 'approved' | 'rejected'>): void {
    item.status = status;
    const action = status === 'approved' ? 'approved' : 'rejected';
    this.activityMessage = `${this.formatKind(item.kind)} "${item.title}" was ${action}.`;
  }

  trackById(_: number, item: ModerationItem): number {
    return item.id;
  }

  private formatKind(kind: ModerationKind): string {
    switch (kind) {
      case 'account':
        return 'Freelancer account';
      case 'gig':
        return 'Gig';
      case 'product':
        return 'Product';
    }
  }
}
