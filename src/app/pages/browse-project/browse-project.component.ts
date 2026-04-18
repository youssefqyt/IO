import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BrowseProjectCard, ProjectCardComponent } from '../../components/project-card/project-card.component';
import { environment } from '../../../environments/environment';

interface BrowseProjectApiResponse extends BrowseProjectCard {
  id?: string;
  category?: string;
  projectType?: string;
}

@Component({
  selector: 'app-browse-project',
  templateUrl: './browse-project.component.html',
  styleUrls: ['./browse-project.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, ProjectCardComponent]
})
export class BrowseProjectComponent implements OnInit {
  readonly categories = ['All Jobs', 'Development', 'Design', 'Marketing'];
  projects: BrowseProjectCard[] = [];

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  ionViewWillEnter(): void {
    this.loadProjects();
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
        }));
      },
      error: (error) => {
        console.error('Failed to load projects', error);
        this.projects = [];
      }
    });
  }
}
