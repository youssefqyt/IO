import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  readonly recentProjects = [
    {
      title: 'Brand Identity Design',
      price: '$1,200',
      description: 'Create a modern brand identity including logo, palette, and typography for a startup.',
      tags: ['Branding', 'Logo']
    },
    {
      title: 'iOS Fitness Tracker',
      price: '$3,500',
      description: 'Full UI/UX design and prototyping for a high-end wellness and fitness tracking app.',
      tags: ['Mobile', 'UI/UX']
    },
    {
      title: 'Shopify Headless CMS',
      price: '$2,800',
      description: 'Implementation of a headless Shopify storefront using React and Tailwind CSS.',
      tags: ['Web', 'Development']
    }
  ];

  readonly activeGigs = [
    {
      title: 'Mobile UI Design System',
      company: 'TechNova Solutions',
      due: 'Due in 2d',
      progress: 85,
      colorClass: 'secondary'
    },
    {
      title: 'E-commerce Backend API',
      company: 'LuxeRetail Co.',
      due: 'Due in 5d',
      progress: 40,
      colorClass: 'primary'
    }
  ];

  constructor() {}
}
