import { Component, OnInit, inject } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class StartComponent  implements OnInit {
  private router = inject(Router);

  constructor() { }

  ngOnInit() {
    setTimeout(() => {
      const token = localStorage.getItem('fw_token');
      const profile = localStorage.getItem('fw_profile');
      const hasSavedLoginAndUser = !!token && !!profile;
      const hasSeenInterests = localStorage.getItem('fw_interests_seen') === 'true';

      if (hasSavedLoginAndUser) {
        this.router.navigate(['/home']);
        return;
      }

      this.router.navigate([hasSeenInterests ? '/guest' : '/interest-start']);
    }, 3000);
  }
}
