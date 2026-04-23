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
  category?: string;
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
  interests?: Array<{ name?: string; selected?: boolean }>;
  projects?: InterestProjectApiResponse[];
  products?: InterestProductApiResponse[];
  selectedCategory?: string;
  selectedCategories?: string[];
  fallbackCategories?: string[];
}

@Component({
  selector: 'app-guest',
  templateUrl: './guest.component.html',
  styleUrls: ['./guest.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, MarketProductCardComponent, MarketProductInfoComponent],
})
export class GuestComponent implements OnInit {
  private static readonly ALL_OFFERS_FILTER = 'All Offers';
  private static readonly CATEGORY_ALIASES: Record<string, string> = {
    'web development': 'web dev',
    'mobile development': 'mobile dev',
    'project management': 'project mgmt',
    'music production': 'music prod',
    '3d': '3d design',
  };
  private static readonly CATEGORY_DISPLAY_LABELS: Record<string, string> = {
    'graphic design': 'Graphic Design',
    'web dev': 'Web Dev',
    'ai models': 'AI Models',
    'marketing': 'Marketing',
    'video editor': 'Video Editor',
    'illustration': 'Illustration',
    'copywriting': 'Copywriting',
    'photography': 'Photography',
    'mobile dev': 'Mobile Dev',
    'ui ux': 'UI/UX',
    'data entry': 'Data Entry',
    'seo': 'SEO',
    'project mgmt': 'Project Mgmt',
    'translation': 'Translation',
    '3d design': '3D Design',
    'music prod': 'Music Prod',
  };

  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  isDarkMode = document.documentElement.classList.contains('dark');
  isProductInfoOpen = false;
  selectedProduct: MarketProduct | null = null;
  supportMessage = '';
  filters = [GuestComponent.ALL_OFFERS_FILTER];
  selectedFilter = GuestComponent.ALL_OFFERS_FILTER;
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

  get filteredTrendingOffers(): GuestOffer[] {
    if (this.isAllOffersSelected()) {
      return this.trendingOffers;
    }

    return this.trendingOffers.filter((offer) => this.matchesSelectedCategory(offer.category, offer.tags));
  }

  get filteredFeaturedAssets(): MarketProduct[] {
    if (this.isAllOffersSelected()) {
      return this.featuredAssets;
    }

    return this.featuredAssets.filter((product) => this.matchesSelectedCategory(product.category));
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

  selectFilter(filter: string): void {
    this.selectedFilter = filter;
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
          category: this.normalizeCategoryLabel(project.category),
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
        this.filters = this.buildFilters(response, this.trendingOffers, this.featuredAssets);
        this.ensureSelectedFilter();
      },
      error: (error) => {
        console.error('Failed to load guest trending feed', error);
        this.filters = [GuestComponent.ALL_OFFERS_FILTER];
        this.selectedFilter = GuestComponent.ALL_OFFERS_FILTER;
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

  private buildFilters(
    response: InterestFeedApiResponse,
    offers: GuestOffer[],
    products: MarketProduct[]
  ): string[] {
    const explicitSelections = Array.isArray(response?.selectedCategories)
      ? response.selectedCategories
      : [];
    const selectedInterestItems = Array.isArray(response?.interests)
      ? response.interests
          .filter((item) => item?.selected)
          .map((item) => item?.name || '')
      : [];
    const discoveredCategories = [
      ...offers.map((offer) => offer.category || ''),
      ...products.map((product) => product.category || ''),
    ];

    const values = [...explicitSelections, ...selectedInterestItems, ...discoveredCategories];
    const uniqueLabels: string[] = [];
    const seen = new Set<string>();

    values.forEach((value) => {
      const label = this.normalizeCategoryLabel(value);
      const key = this.normalizeCategoryKey(value);
      if (!label || !key || seen.has(key)) {
        return;
      }

      seen.add(key);
      uniqueLabels.push(label);
    });

    return [GuestComponent.ALL_OFFERS_FILTER, ...uniqueLabels];
  }

  private ensureSelectedFilter(): void {
    const hasSelectedFilter = this.filters.some(
      (filter) => this.normalizeCategoryKey(filter) === this.normalizeCategoryKey(this.selectedFilter)
    );

    if (!hasSelectedFilter) {
      this.selectedFilter = GuestComponent.ALL_OFFERS_FILTER;
    }
  }

  private matchesSelectedCategory(category?: string, tags: string[] = []): boolean {
    const selectedKey = this.normalizeCategoryKey(this.selectedFilter);
    if (!selectedKey || this.isAllOffersSelected()) {
      return true;
    }

    const valuesToSearch = [category, ...tags];
    return valuesToSearch.some((value) => this.normalizeCategoryKey(value) === selectedKey);
  }

  private isAllOffersSelected(): boolean {
    return this.normalizeCategoryKey(this.selectedFilter) === this.normalizeCategoryKey(GuestComponent.ALL_OFFERS_FILTER);
  }

  private normalizeCategoryLabel(value?: string): string {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return '';
    }

    const normalizedKey = this.normalizeCategoryKey(rawValue);
    const displayLabel = GuestComponent.CATEGORY_DISPLAY_LABELS[normalizedKey];
    if (displayLabel) {
      return displayLabel;
    }

    const words = normalizedKey.split(' ');
    if (words.length === 0) {
      return rawValue;
    }

    return words
      .map((word) => {
        if (word === 'ui') {
          return 'UI';
        }

        if (word === 'ux') {
          return 'UX';
        }

        if (word === '3d') {
          return '3D';
        }

        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  private normalizeCategoryKey(value?: string): string {
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (!normalizedValue) {
      return '';
    }

    const compactValue = normalizedValue
      .replace(/[-_/&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return GuestComponent.CATEGORY_ALIASES[compactValue] || compactValue;
  }
}
