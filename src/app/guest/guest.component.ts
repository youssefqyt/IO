import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MarketProduct, MarketProductCardComponent } from '../components/market-product-card/market-product-card.component';
import { MarketProductInfoComponent } from '../components/market-product-info/market-product-info.component';
import { Router } from '@angular/router';

interface GuestOffer {
  title: string;
  budget: string;
  duration: string;
  tags?: string[];
  avatar?: string;
  extraPeople?: string;
  kind: 'service' | 'product';
}

interface SettingsItem {
  icon: string;
  label: string;
  action: 'login' | 'support';
  hint?: string;
}

@Component({
  selector: 'app-guest',
  templateUrl: './guest.component.html',
  styleUrls: ['./guest.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, MarketProductCardComponent, MarketProductInfoComponent],
})
export class GuestComponent {
  private readonly router = inject(Router);

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

  readonly trendingOffers: GuestOffer[] = [
    {
      title: 'Mobile App UI Redesign for FinTech Startup',
      budget: '$2,500 - $4,000',
      duration: '2 weeks',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD-2yQItolQsNZstw2hn_rT8iTxOZxFMULlZrESx2FBSjzGZ0M7Mm3WW0jj76_xVPasDetFA_pOxUUEgiWTxg9kroIFv5RDtuaPY4p-hxvoBzn8bK2wTkCek1uPSKGTYZe9_svcEaBCQQuPYLKr-8yUpTicLvxXHXyKqlbFjVKxJzy59Cm_nGW1eQjUG4hTHz4mC_CstEs-EHOCEQuthZnSX9ViUg-T6OvlJ2QJjJUQ3I1UJ87PNUA2iVhpDKTopBHJiGPWOm-jrkym',
      extraPeople: '+12',
      kind: 'service',
    },
    {
      title: 'SaaS Dashboard UI Kit (Premium)',
      budget: '$49.00',
      duration: 'Digital Product',
      kind: 'product',
    },
    {
      title: 'React Native Developer for E-commerce',
      budget: '$80 - $120/hr',
      duration: 'Contract',
      tags: ['React', 'Typescript'],
      kind: 'service',
    },
  ];

  readonly featuredAssets: MarketProduct[] = [
    {
      title: 'SaaS Dashboard UI Kit (Premium)',
      studio: 'PIXEL FORGE',
      price: '$49.00',
      category: 'Digital Product',
      description: 'A polished dashboard kit with analytics, CRM, auth, and billing screens.',
      includes: ['Figma source', '120+ screens', 'Design system'],
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCWjucgX1U8wZpeuO1l8KI9K1jhSxKabyVh0_7s2zWGKtJGFFiJakdLXynMUD0EifXpLOG-9Yd2gJvt4ptxUW53wNZomg5XWLv8EieVMhvqahOw4z6keY8EZOE1hpUpHW9Mzd4PM1uvya4F4VkdHP-TaZc8XKYNqIWf8K14vy13NTd8i6LJVAvz-wpjcF--aEzqvsZodJsLnxvZTqkJaX6R02_zuCxT5_eP6gkuOtsRy9Ew_k_cdrlQ5rpbiew9RGOJ7BDsVq3AIPqV',
      alt: 'SaaS dashboard UI kit preview',
    },
    {
      title: 'Growth Marketing Templates',
      studio: 'BRANDLAB',
      price: '$29.00',
      category: 'Templates',
      description: 'Campaign templates for ads, landing pages, and social growth experiments.',
      includes: ['Editable files', 'Ad concepts', 'Funnel checklist'],
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDtU4_vmAtP94ImtXyt3prK4Qm8lpWzvhRDU0_PS7ZW_-bmUtbdxuLWRmFSzbFUd_VCWS1RPpDKQ7tcFNmTPC4_PW3jnixN_ahV3R_gtZVcIxh5l0xjP0x0Bn3G5VHRbgF9bq8IiHCkKuw7_YrpBC7moFqjFzeDc7rFjSTExUdjCDZP5LBeL27kNvPqrBgEKjNDWEy3HUGmgt44B3YbHYY2SN2HVQ8NmJC5BzxsNhcozjpXF0ZhELA-CkqWbS-AU_SrmJM-4kiupYu7',
      alt: 'Marketing template preview',
    },
  ];

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
}
