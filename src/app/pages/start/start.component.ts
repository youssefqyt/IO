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
      this.router.navigate(['/interest-start']);
    }, 3000);
  }
}
