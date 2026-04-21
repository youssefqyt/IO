import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { MarketProduct, MarketProductCardComponent } from '../components/market-product-card/market-product-card.component';
import { MarketProductInfoComponent } from '../components/market-product-info/market-product-info.component';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';

interface GuestOffer {
  title: string;
  budget: string;
  duration: string;
  tags?: string[];
  avatar?: string;
  extraPeople?: string;
  image?: string;
  alt?: string;
  kind: 'service' | 'product';
}

interface SettingsItem {
  icon: string;
  label: string;
  action: 'login' | 'support';
  hint?: string;
}

interface InterestProjectApiResponse {
  id?: string;
  type?: string;
  time?: string;
  badgeClass?: string;
  title?: string;
  description?: string;
  label?: string;
  amount?: string;
  deadline?: string;
  briefFileName?: string;
  category?: string;
  projectType?: string;
}

interface InterestProductApiResponse {
  id?: string;
  title?: string;
  studio?: string;
  price?: string;
  image?: string;
  alt?: string;
  category?: string;
  description?: string;
  includes?: string[];
}

interface InterestFeedApiResponse {
  projects?: InterestProjectApiResponse[];
  products?: InterestProductApiResponse[];
}

@Component({
  selector: 'app-guest',
  templateUrl: './guest.component.html',
  styleUrls: ['./guest.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, MarketProductCardComponent, MarketProductInfoComponent],
})
export class GuestComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  isDarkMode = document.documentElement.classList.contains('dark');
  isProductInfoOpen = false;
  selectedProduct: MarketProduct | null = null;
  supportMessage = '';
  readonly filters = ['All Offers', 'Design', 'Development', 'Marketing'];
  readonly settingsItems: SettingsItem[] = [
    { icon: 'person', label: 'Profile', action: 'login', hint: 'Login required' },
    { icon: 'shield_person', label: 'Account Security', action: 'login', hint: 'Login required' },
    { icon: 'payments', label: 'Payment Methods', action: 'login', hint: 'Login required' },
    { icon: 'notifications', label: 'Notification Preferences', action: 'login', hint: 'Login required' },
    { icon: 'language', label: 'Language', action: 'login', hint: 'Login required' },
    { icon: 'contact_support', label: 'Help & Support', action: 'support', hint: 'Available for guests' },
    { icon: 'info', label: 'About Free Work', action: 'login', hint: 'Login required' },
  ];

  trendingOffers: GuestOffer[] = [];
  featuredAssets: MarketProduct[] = [];

  ngOnInit(): void {
    this.loadTrendingFeed();
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/login');
  }

  handleLockedAction(): void {
    this.supportMessage = '';
    this.goToLogin();
  }

  openProductInfo(product: MarketProduct): void {
    this.supportMessage = '';
    this.selectedProduct = product;
    this.isProductInfoOpen = true;
  }

  closeProductInfo(): void {
    this.isProductInfoOpen = false;
    this.selectedProduct = null;
  }

  onPayProduct(): void {
    this.closeProductInfo();
    this.goToLogin();
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    document.body.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('fw_theme', this.isDarkMode ? 'dark' : 'light');
  }

  openSupport(): void {
    this.supportMessage = 'Guest support is available at support@freework.app.';
  }

  onSettingsAction(item: SettingsItem): void {
    if (item.action === 'support') {
      this.openSupport();
      return;
    }

    this.handleLockedAction();
  }

  scrollTo(sectionId: string): void {
    this.supportMessage = '';
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private loadTrendingFeed(): void {
    this.http.get<InterestFeedApiResponse>(`${environment.apiUrl}/interest`).subscribe({
      next: (response) => {
        const projects = Array.isArray(response?.projects) ? response.projects : [];
        const products = Array.isArray(response?.products) ? response.products : [];

        const serviceOffers: GuestOffer[] = projects.slice(0, 3).map((project) => ({
          title: project.title || 'Untitled project',
          budget: project.amount || 'Budget not specified',
          duration: project.deadline || 'Deadline flexible',
          tags: this.buildProjectTags(project),
          kind: 'service',
        }));

        this.trendingOffers = serviceOffers;
        this.featuredAssets = products.slice(0, 2).map((product) => ({
          title: product.title || 'Untitled product',
          studio: product.studio || 'MARKETPLACE',
          price: product.price || '',
          image: product.image || '',
          alt: product.alt || `${product.title || 'Marketplace'} preview`,
          category: product.category || 'Digital Product',
          description: product.description || '',
          includes: Array.isArray(product.includes) ? product.includes : [],
        }));
      },
      error: (error) => {
        console.error('Failed to load guest trending feed', error);
        this.trendingOffers = [];
        this.featuredAssets = [];
      }
    });
  }

  private buildProjectTags(project: InterestProjectApiResponse): string[] {
    return [project.category, project.type]
      .map((value) => String(value || '').trim())
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
      .slice(0, 2);
  }
}
