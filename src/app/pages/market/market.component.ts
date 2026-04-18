import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketProduct, MarketProductCardComponent } from '../../components/market-product-card/market-product-card.component';
import { MarketProductInfoComponent } from '../../components/market-product-info/market-product-info.component';
import { environment } from '../../../environments/environment';

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
  readonly categories = ['All Assets', 'Templates', 'Icons', '3D'];
  featuredAssets: MarketProduct[] = [];

  readonly activeOffers = [
    {
      type: 'UX/UI DESIGN',
      mode: 'REMOTE',
      budget: '$2,400',
      deadline: '14 Days',
      postedAt: '2h ago',
      title: 'Modern SaaS Landing Page',
      desc: 'Looking for a designer to create a clean, minimalist landing page for a fintech startup.'
    },
    {
      type: 'DEVELOPMENT',
      mode: 'CONTRACT',
      budget: '$4,500',
      deadline: '21 Days',
      postedAt: '5h ago',
      title: 'E-commerce Mobile App',
      desc: 'Full-stack developer needed for a React Native fashion marketplace application.'
    }
  ];

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadProducts();
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
}
