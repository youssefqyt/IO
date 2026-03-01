import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-market',
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class MarketComponent {
  readonly categories = ['All Asset', 'Templates', 'Icons', '3D'];

  readonly featuredAssets = [
    {
      title: 'SaaS UI Kit v2.0',
      studio: 'MINIMAL STUDIO',
      price: '$49.00',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDtU4_vmAtP94ImtXyt3prK4Qm8lpWzvhRDU0_PS7ZW_-bmUtbdxuLWRmFSzbFUd_VCWS1RPpDKQ7tcFNmTPC4_PW3jnixN_ahV3R_gtZVcIxh5l0xjP0x0Bn3G5VHRbgF9bq8IiHCkKuw7_YrpBC7moFqjFzeDc7rFjSTExUdjCDZP5LBeL27kNvPqrBgEKjNDWEy3HUGmgt44B3YbHYY2SN2HVQ8NmJC5BzxsNhcozjpXF0ZhELA-CkqWbS-AU_SrmJM-4kiupYu7',
      alt: 'SaaS UI kit cover'
    },
    {
      title: 'React Dashboard',
      studio: 'DEVFLOW',
      price: '$24.00',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCudje5pxu4v3buLiUtmbNzcIlzdy6oX0aRus1Q_6gZdB4-LllsJipB1pKzNIAWCh-1U2TbrnRBmLggI3-5p1maOt0fuuxYfNOgQHoVY0krsZIAIx2prK3_dX1uJhGhRW_wdjfUdGxkglnOPaGqLeBhw2fgwYcztXFkm2ouAC2tiBkEbV8wLVbHK1PaKxr-NaIRuQVBlOD1qpZOlAk2EEcRvSv1bgIClqOEqQZaHxt52gJxffgcHvfo0fciPj1URm22sJDKSbKXXTxl',
      alt: 'React dashboard cover'
    },
    {
      title: '3D Clay Icons',
      studio: 'SHAPELABS',
      price: '$19.00',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDFCSZx1My_ZaCeWfy17loFO0z1TFa3-4uUqQdxQv50r-wNbeqvMsWcXewD1iSuOdRu5orZ_aM5xXnojf0phhyEo6h8nRcB1vmO3MplubnPea1ZL8yfeJGMC8vUwyjgMbN5WI6CGVL2IGOUCDRdDMTCsnwn19yfpPn-9PGa-6Mta__cMli-D_cpOMuyicfufwXg2CKiZJLEvwv-MmBK56oJhniLaz6bzu-A1VvFoaPScEb95TcV093DDKwSMbwNWv_6JEFRxcqg546O',
      alt: '3D clay icons cover'
    },
    {
      title: 'iOS Style Guide',
      studio: 'APPLEDEV',
      price: '$35.00',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBW8GyON_mDk_aZeMUbynLm70Nchn-ob8Q0BpQFP8Bm0z226wWjddO_fjKReHftF94vYIZO7PCYAImjthG825seDhkvY5lp0uWoTMzWsa1hCI7ljFLZztUkJILI72D7qGCL6x9OWm7LH8mahCoMQ732JsIJd_F6cPZtfCRDr6nc4VZ3Vom3V9QiiFieT9W2hL4v2VtvMOc8t5whwc4t-ZX0ZY3PgOQEsypoKjUIt1zF5xtSEqFHfSPCMXrQ_wWdbdM3zF_AUtYdVZBR',
      alt: 'iOS style guide cover'
    }
  ];

  readonly activeOffers = [
    {
      type: 'UX/UI DESIGN',
      mode: 'REMOTE',
      budget: '$2,400',
      title: 'Modern SaaS Landing Page',
      desc: 'Looking for a designer to create a clean, minimalist landing page for a fintech startup.'
    },
    {
      type: 'DEVELOPMENT',
      mode: 'CONTRACT',
      budget: '$4,500',
      title: 'E-commerce Mobile App',
      desc: 'Full-stack developer needed for a React Native fashion marketplace application.'
    }
  ];
}
