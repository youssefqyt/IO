import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MarketProduct {
  title: string;
  studio: string;
  price: string;
  image: string;
  alt: string;
  category?: string;
  description?: string;
  includes?: string[];
}

@Component({
  selector: 'app-market-product-card',
  templateUrl: './market-product-card.component.html',
  styleUrls: ['./market-product-card.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class MarketProductCardComponent {
  @Input({ required: true }) product!: MarketProduct;
  @Output() pay = new EventEmitter<MarketProduct>();
  @Output() viewInfo = new EventEmitter<MarketProduct>();

  onCardClick(): void {
    this.viewInfo.emit(this.product);
  }

  onPayClick(event: Event): void {
    event.stopPropagation();
    this.pay.emit(this.product);
  }

  onViewInfoClick(event: Event): void {
    event.stopPropagation();
    this.viewInfo.emit(this.product);
  }
}
