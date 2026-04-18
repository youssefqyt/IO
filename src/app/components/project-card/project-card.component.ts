import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface BrowseProjectCard {
  id?: string;
  type: string;
  time: string;
  badgeClass: string;
  title: string;
  description: string;
  label: string;
  amount: string;
  deadline: string;
  briefFileName?: string;
}

@Component({
  selector: 'app-project-card',
  templateUrl: './project-card.component.html',
  styleUrls: ['./project-card.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: BrowseProjectCard;
}
