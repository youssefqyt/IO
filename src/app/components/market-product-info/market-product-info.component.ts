import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketProduct } from '../market-product-card/market-product-card.component';

@Component({
  selector: 'app-market-product-info',
  templateUrl: './market-product-info.component.html',
  styleUrls: ['./market-product-info.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class MarketProductInfoComponent {
  @Input({ required: true }) product!: MarketProduct;
  @Output() close = new EventEmitter<void>();
  @Output() pay = new EventEmitter<MarketProduct>();

  onClose(): void {
    this.close.emit();
  }

  onPay(): void {
    this.pay.emit(this.product);
  }
}

