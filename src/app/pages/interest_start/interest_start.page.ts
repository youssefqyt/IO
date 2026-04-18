import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-interest-start',
  templateUrl: './interest_start.page.html',
  styleUrls: ['./interest_start.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class InterestStartPage implements OnInit {
  interests: Array<{ name: string; icon: string; selected: boolean }> = [];

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.interests = [
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

  toggleInterest(item: { name: string; icon: string; selected: boolean }): void {
    item.selected = !item.selected;
  }

  get progressPercent(): number {
    const selectedCount = this.interests.filter((item) => item.selected).length;
    return Math.min(selectedCount, 5) / 5 * 100;
  }

  continue(): void {
    localStorage.setItem('fw_interests_seen', 'true');
    this.router.navigateByUrl('/guest');
  }
}
