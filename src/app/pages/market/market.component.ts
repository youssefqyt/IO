import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketProduct, MarketProductCardComponent } from '../../components/market-product-card/market-product-card.component';
import { MarketProductInfoComponent } from '../../components/market-product-info/market-product-info.component';
import { environment } from '../../../environments/environment';
import { categoriesData, Category } from '../../categories';

interface MarketProductApiResponse {
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

interface StoredProfile {
  id?: string;
  fullName?: string;
  role?: 'freelancer' | 'client';
}

interface MarketplaceProjectOffer {
  id?: string;
  type: string;
  mode: string;
  budget: string;
  deadline: string;
  postedAt: string;
  title: string;
  desc: string;
}

interface BrowseProjectApiResponse {
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

@Component({
  selector: 'app-market',
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule, MarketProductCardComponent, MarketProductInfoComponent]
})
export class MarketComponent implements OnInit {
  paymentMessage = '';
  isProductInfoOpen = false;
  selectedProduct: MarketProduct | null = null;
  searchTerm = '';
  selectedCategory = 'All Assets';
  readonly categories = this.buildMarketplaceCategories();
  featuredAssets: MarketProduct[] = [];

  activeOffers: MarketplaceProjectOffer[] = [];

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadProjectOffers();
  }

  get filteredAssets(): MarketProduct[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.featuredAssets.filter((asset) => {
      const matchesCategory =
        this.selectedCategory === 'All Assets' ||
        asset.category?.toLowerCase() === this.selectedCategory.toLowerCase();

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        asset.title,
        asset.studio,
        asset.category,
        asset.description,
        ...(asset.includes ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }

  get hasNoResults(): boolean {
    return this.filteredAssets.length === 0;
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.selectedCategory = 'All Assets';
  }

  private loadProducts(): void {
    this.http.get<MarketProductApiResponse[]>(`${environment.apiUrl}/marketplace`).subscribe({
      next: (products) => {
        this.featuredAssets = products.map((product) => ({
          title: product.title || 'Untitled product',
          studio: product.studio || 'MARKETPLACE',
          price: product.price || '',
          image: product.image || '',
          alt: product.alt || `${product.title || 'Marketplace'} preview`,
          category: product.category || 'Digital Asset',
          description: product.description || '',
          includes: Array.isArray(product.includes) ? product.includes : [],
        }));
      },
      error: (error) => {
        console.error('Failed to load marketplace products', error);
        this.featuredAssets = [];
      }
    });
  }

  private loadProjectOffers(): void {
    this.http.get<BrowseProjectApiResponse[]>(`${environment.apiUrl}/projects`).subscribe({
      next: (projects) => {
        this.activeOffers = projects.map((project) => ({
          id: project.id,
          type: project.type || project.category || 'PROJECT',
          mode: project.projectType === 'hourly' ? 'HOURLY' : 'FIXED PRICE',
          budget: project.amount || 'Budget not specified',
          deadline: project.deadline || 'Deadline flexible',
          postedAt: project.time || 'Recently posted',
          title: project.title || 'Untitled project',
          desc: project.description || 'No project description provided.'
        }));
      },
      error: (error) => {
        console.error('Failed to load marketplace project offers', error);
        this.activeOffers = [];
      }
    });
  }

  onPayProduct(product: MarketProduct): void {
    this.paymentMessage = '';
    this.isProductInfoOpen = false;
    void this.router.navigate(['/pay'], {
      queryParams: {
        title: product.title,
        price: product.price,
        image: product.image,
        alt: product.alt,
        license: 'Single License'
      }
    });
  }

  openProductInfo(product: MarketProduct): void {
    this.selectedProduct = product;
    this.isProductInfoOpen = true;
  }

  closeProductInfo(): void {
    this.isProductInfoOpen = false;
    this.selectedProduct = null;
  }

  private buildMarketplaceCategories(): string[] {
    const sharedCategories = categoriesData.map((category: Category) => category.name);
    const marketplaceCategories = ['Templates', 'Icons', '3D'];
    return ['All Assets', ...new Set([...marketplaceCategories, ...sharedCategories])];
  }
}
