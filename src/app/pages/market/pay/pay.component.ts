import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { environment } from 'src/environments/environment';

interface DeliveredAsset {
  fileName: string;
  url: string;
}

const DELIVERED_ASSETS: Record<string, DeliveredAsset> = {
  'SaaS UI Kit v2.0': {
    fileName: 'saas-ui-kit-v2.txt',
    url: 'assets/downloads/saas-ui-kit-v2.txt'
  },
  'React Dashboard': {
    fileName: 'react-dashboard.txt',
    url: 'assets/downloads/react-dashboard.txt'
  },
  '3D Clay Icons': {
    fileName: '3d-clay-icons.txt',
    url: 'assets/downloads/3d-clay-icons.txt'
  },
  'iOS Style Guide': {
    fileName: 'ios-style-guide.txt',
    url: 'assets/downloads/ios-style-guide.txt'
  }
};

@Component({
  selector: 'app-pay',
  templateUrl: './pay.component.html',
  styleUrls: ['./pay.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonicModule]
})
export class PayComponent {
  viewState: 'checkout' | 'success' | 'failed' = 'checkout';
  productTitle = 'SaaS UI Kit v2.0';
  productImage =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDtU4_vmAtP94ImtXyt3prK4Qm8lpWzvhRDU0_PS7ZW_-bmUtbdxuLWRmFSzbFUd_VCWS1RPpDKQ7tcFNmTPC4_PW3jnixN_ahV3R_gtZVcIxh5l0xjP0x0Bn3G5VHRbgF9bq8IiHCkKuw7_YrpBC7moFqjFzeDc7rFjSTExUdjCDZP5LBeL27kNvPqrBgEKjNDWEy3HUGmgt44B3YbHYY2SN2HVQ8NmJC5BzxsNhcozjpXF0ZhELA-CkqWbS-AU_SrmJM-4kiupYu7';
  productAlt = 'Product image';
  license = 'Single License';
  subtotal = 49;
  serviceFeePercent = 12;
  statusMessage = '';

  cardNumber = '';
  expiryDate = '';
  cvv = '';
  isSubmitting = false;
  paymentError = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly location: Location,
    private readonly router: Router,
    private readonly http: HttpClient
  ) {
    const query = this.route.snapshot.queryParamMap;
    this.productTitle = query.get('title') || this.productTitle;
    this.productImage = query.get('image') || this.productImage;
    this.productAlt = query.get('alt') || this.productAlt;
    this.license = query.get('license') || this.license;

    const priceQuery = query.get('price');
    if (priceQuery) {
      const parsed = this.parsePrice(priceQuery);
      if (!Number.isNaN(parsed) && parsed > 0) {
        this.subtotal = parsed;
      }
    }
  }

  get serviceFee(): number {
    return this.round2((this.subtotal * this.serviceFeePercent) / 100);
  }

  get totalAmount(): number {
    return this.round2(this.subtotal + this.serviceFee);
  }

  goBack(): void {
    this.location.back();
  }

  payAndDownload(): void {
    if (this.isSubmitting) {
      return;
    }

    const normalizedCard = this.cardNumber.replace(/\s+/g, '');
    const isCardValid = /^[0-9]{16}$/.test(normalizedCard);
    const isExpiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(this.expiryDate);
    const isCvvValid = /^[0-9]{3,4}$/.test(this.cvv);

    if (!isCardValid || !isExpiryValid || !isCvvValid || normalizedCard.endsWith('0000')) {
      this.viewState = 'failed';
      this.statusMessage = '';
      this.paymentError = 'Please check your card number, expiry date, and CVV.';
      return;
    }

    this.isSubmitting = true;
    this.statusMessage = '';
    this.paymentError = '';

    this.http.post<PayResponse>(`${environment.apiUrl}/pay`, {
      cardNumber: normalizedCard,
      expiryDate: this.expiryDate,
      cvv: this.cvv,
      amount: this.totalAmount,
      productTitle: this.productTitle,
    }).subscribe({
      next: (response) => {
        this.viewState = 'success';
        this.statusMessage = `Payment accepted on card ending in ${response.payment.last4}. Remaining bucks: ${this.formatMoney(response.payment.remainingBucks)}.`;
        this.isSubmitting = false;
      },
      error: (errorResponse) => {
        const apiErrors = errorResponse?.error?.errors || {};
        this.paymentError =
          apiErrors.amount ||
          apiErrors.cardNumber ||
          errorResponse?.error?.message ||
          'We were unable to process your payment.';
        this.viewState = 'failed';
        this.statusMessage = '';
        this.isSubmitting = false;
      }
    });
  }

  tryAgain(): void {
    this.viewState = 'checkout';
    this.paymentError = '';
  }

  contactSupport(): void {
    this.statusMessage = 'Support request sent. We will contact you soon.';
  }

  downloadAsset(): void {
    const deliveredAsset = DELIVERED_ASSETS[this.productTitle.trim()];

    if (deliveredAsset) {
      this.triggerDownload(deliveredAsset.url, deliveredAsset.fileName);
      this.statusMessage = `${deliveredAsset.fileName} downloaded successfully.`;
      return;
    }

    const fallbackAsset = this.createFallbackAssetDelivery();
    this.triggerDownload(fallbackAsset.url, fallbackAsset.fileName);
    window.setTimeout(() => URL.revokeObjectURL(fallbackAsset.url), 1000);
    this.statusMessage = `${fallbackAsset.fileName} downloaded successfully.`;
  }

  backToMarket(): void {
    void this.router.navigateByUrl('/market');
  }

  private parsePrice(value: string): number {
    return Number(value.replace(/[^0-9.]/g, ''));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private createFallbackAssetDelivery(): DeliveredAsset {
    const fileName = `${this.slugify(this.productTitle || 'free-work-asset')}.txt`;
    const contents = [
      'Free Work Asset Delivery',
      `Product: ${this.productTitle}`,
      `License: ${this.license}`,
      `Amount Paid: ${this.formatMoney(this.totalAmount)}`,
      '',
      'This is a generated delivery file because no packaged marketplace asset was mapped for this product yet.',
      'Replace this generated file with the final client-ready asset bundle when it becomes available.'
    ].join('\n');

    return {
      fileName,
      url: URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }))
    };
  }

  private triggerDownload(url: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'free-work-asset';
  }

  formatMoney(value: number): string {
    return `$${value.toFixed(2)}`;
  }

}

interface PayResponse {
  message: string;
  payment: {
    amount: number;
    currency: string;
    cardHolder: string;
    last4: string;
    remainingBucks: number;
  };
}
