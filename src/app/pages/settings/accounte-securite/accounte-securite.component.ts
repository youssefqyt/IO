import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-accounte-securite',
  templateUrl: './accounte-securite.component.html',
  styleUrls: ['./accounte-securite.component.scss'],
  standalone: true,
  imports: [IonicModule],
})
export class AccounteSecuriteComponent implements OnInit {
  constructor(private readonly router: Router) {}

  ngOnInit(): void {}

  goBack(): void {
    this.router.navigateByUrl('/settings');
  }

  onAccountInformation(): void {
    this.router.navigateByUrl('/profile');
  }

  onChangePassword(): void {
    // Route can be replaced with a dedicated change-password page when available.
    this.router.navigateByUrl('/settings');
  }
}
