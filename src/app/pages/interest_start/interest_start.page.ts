import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Interest } from '../../models/interest.model';

@Component({
  selector: 'app-interest-start',
  templateUrl: './interest_start.page.html',
  styleUrls: ['./interest_start.page.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class InterestStartPage {
  interests: Interest[] = [
    { name: 'Graphic Design', icon: 'brush', selected: true },
    { name: 'Web Dev', icon: 'code', selected: false },
    { name: 'AI Models', icon: 'psychology', selected: true },
    { name: 'Marketing', icon: 'trending_up', selected: false },
    { name: 'Video Editor', icon: 'videocam', selected: false },
    { name: 'Illustration', icon: 'draw', selected: false },
    { name: 'Copywriting', icon: 'translate', selected: false },
    { name: 'Photography', icon: 'photo_camera', selected: false },
  ];

  constructor() {}

  toggleInterest(interest: Interest) {
    interest.selected = !interest.selected;
  }

  continue() {
    // TODO: navigate to next page
  }
}