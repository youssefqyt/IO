import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

import { Interest } from '../../models/interest.model';
import { environment } from '../../../environments/environment';

interface InterestApiResponse {
  interests?: Interest[];
}

@Component({
  selector: 'app-interest-start',
  templateUrl: './interest_start.page.html',
  styleUrls: ['./interest_start.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class InterestStartPage implements OnInit {
  interests: Interest[] = [];

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadInterests();
  }

  toggleInterest(item: Interest): void {
    item.selected = !item.selected;
  }

  get progressPercent(): number {
    const selectedCount = this.interests.filter((item) => item.selected).length;
    return Math.min(selectedCount, 5) / 5 * 100;
  }

  continue(): void {
    const selectedInterests = this.interests
      .filter((item) => item.selected)
      .map((item) => item.name);

    localStorage.setItem('fw_interests_seen', 'true');
    localStorage.setItem('fw_selected_interests', JSON.stringify(selectedInterests));
    this.router.navigateByUrl('/guest');
  }

  private loadInterests(): void {
    this.http.get<InterestApiResponse>(`${environment.apiUrl}/interest`).subscribe({
      next: (response) => {
        const apiInterests = Array.isArray(response?.interests) ? response.interests : [];
        this.interests = apiInterests.length > 0 ? apiInterests : this.getFallbackInterests();
      },
      error: (error) => {
        console.error('Failed to load interests', error);
        this.interests = this.getFallbackInterests();
      }
    });
  }

  private getFallbackInterests(): Interest[] {
    return [
      { name: 'Graphic Design', icon: 'brush', selected: true },
      { name: 'Web Dev', icon: 'code', selected: false },
      { name: 'AI Models', icon: 'psychology', selected: true },
      { name: 'Marketing', icon: 'trending_up', selected: false },
      { name: 'Video Editor', icon: 'videocam', selected: false },
      { name: 'Illustration', icon: 'draw', selected: false },
      { name: 'Copywriting', icon: 'translate', selected: false },
      { name: 'Photography', icon: 'photo_camera', selected: false },
      { name: 'Mobile Dev', icon: 'phone_iphone', selected: false },
      { name: 'UI/UX', icon: 'design_services', selected: false },
      { name: 'Data Entry', icon: 'table_rows', selected: false },
      { name: 'SEO', icon: 'query_stats', selected: false },
      { name: 'Project Mgmt', icon: 'fact_check', selected: false },
      { name: 'Translation', icon: 'g_translate', selected: false },
      { name: '3D Design', icon: 'view_in_ar', selected: false },
      { name: 'Music Prod', icon: 'library_music', selected: false }
    ];
  }
}
