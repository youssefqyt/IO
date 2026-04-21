import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { categoriesData, Category } from '../../categories';

interface StoredProfile {
  id?: string;
  fullName?: string;
  role?: 'freelancer' | 'client';
}

@Component({
  selector: 'app-add-product',
  templateUrl: './add-product.component.html',
  styleUrls: ['./add-product.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class AddProductComponent {
  readonly productCategories = categoriesData.map((category: Category) => category.name);

  productTitle = '';
  productCategory = this.productCategories[0] || '';
  productPrice: number | null = null;
  productDescription = '';
  productIncludes = '';
  productImage = '';
  productImageName = '';
  isSavingProduct = false;
  productSuccessMessage = '';
  productErrorMessage = '';

  constructor(
    private readonly location: Location,
    private readonly http: HttpClient
  ) {}

  goBack(): void {
    this.location.back();
  }

  onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.productImage = '';
      this.productImageName = '';
      return;
    }

    this.productErrorMessage = '';
    this.productImageName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.productImage = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => {
      this.productImage = '';
      this.productImageName = '';
      this.productErrorMessage = 'Unable to read the selected image.';
    };
    reader.readAsDataURL(file);
  }

  submitProduct(): void {
    const profile = this.getStoredProfile();
    this.productSuccessMessage = '';
    this.productErrorMessage = '';

    if (!profile?.id || profile.role !== 'freelancer') {
      this.productErrorMessage = 'Please log in as a freelancer to add a product.';
      return;
    }

    this.isSavingProduct = true;
    this.http.post<{ message: string }>(`${environment.apiUrl}/marketplace`, {
      title: this.productTitle.trim(),
      category: this.productCategory,
      price: this.productPrice,
      description: this.productDescription.trim(),
      includes: this.productIncludes,
      image: this.productImage,
      studio: (profile.fullName || 'MARKETPLACE').trim(),
      submittedBy: {
        id: profile.id
      }
    }).subscribe({
      next: (response) => {
        this.isSavingProduct = false;
        this.productSuccessMessage = response.message || 'Product added successfully';
        this.resetProductForm();
      },
      error: (error) => {
        this.isSavingProduct = false;
        this.productErrorMessage = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to add this product right now.';
      }
    });
  }

  private getStoredProfile(): StoredProfile | null {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredProfile;
    } catch {
      return null;
    }
  }

  private resetProductForm(): void {
    this.productTitle = '';
    this.productCategory = this.productCategories[0] || '';
    this.productPrice = null;
    this.productDescription = '';
    this.productIncludes = '';
    this.productImage = '';
    this.productImageName = '';
  }
}
