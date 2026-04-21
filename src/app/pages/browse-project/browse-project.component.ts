import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BrowseProjectCard, ProjectCardComponent } from '../../components/project-card/project-card.component';
import { environment } from '../../../environments/environment';
import { categoriesData, Category } from '../../categories';

interface BrowseProjectApiResponse extends BrowseProjectCard {
  id?: string;
  category?: string;
  projectType?: string;
}

interface BrowseProjectView extends BrowseProjectCard {
  category?: string;
  projectType?: string;
}

@Component({
  selector: 'app-browse-project',
  templateUrl: './browse-project.component.html',
  styleUrls: ['./browse-project.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule, ProjectCardComponent]
})
export class BrowseProjectComponent implements OnInit {
  readonly categories = this.buildBrowseCategories();
  searchTerm = '';
  selectedCategory = 'All Jobs';
  projects: BrowseProjectView[] = [];

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  ionViewWillEnter(): void {
    this.loadProjects();
  }

  get filteredProjects(): BrowseProjectCard[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.projects.filter((project) => {
      const matchesCategory =
        this.selectedCategory === 'All Jobs' ||
        (project.category || '').toLowerCase() === this.selectedCategory.toLowerCase();

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        project.title,
        project.description,
        project.type,
        project.category,
        project.deadline,
        project.amount
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
  }

  private loadProjects(): void {
    this.http.get<BrowseProjectApiResponse[]>(`${environment.apiUrl}/projects`).subscribe({
      next: (projects) => {
        this.projects = projects.map((project) => ({
          id: project.id,
          type: project.type,
          time: project.time,
          badgeClass: project.badgeClass,
          title: project.title,
          description: project.description,
          label: project.label,
          amount: project.amount,
          deadline: project.deadline,
          briefFileName: project.briefFileName,
          category: project.category,
          projectType: project.projectType,
        }));
      },
      error: (error) => {
        console.error('Failed to load projects', error);
        this.projects = [];
      }
    });
  }

  private buildBrowseCategories(): string[] {
    const sharedCategories = categoriesData.map((category: Category) => category.name);
    return ['All Jobs', ...sharedCategories];
  }
}
