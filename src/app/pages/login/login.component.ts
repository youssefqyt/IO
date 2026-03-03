import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface LoginResponse {
  message: string;
  token?: string;
  user?: { id: string; fullName: string; email: string; role: 'freelancer' | 'client' };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule]
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  formErrors: { email: string; password: string; general: string } = {
    email: '',
    password: '',
    general: ''
  };

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  onLogin(): void {
    this.formErrors = { email: '', password: '', general: '' };
    this.isLoading = true;

    this.http.post<LoginResponse>('http://localhost:5000/api/login', {
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: async (res) => {
        this.isLoading = false;

        if (res.token) {
          localStorage.setItem('fw_token', res.token);
        }
        if (res.user) {
          localStorage.setItem('fw_profile', JSON.stringify({
            fullName: res.user.fullName,
            email: res.user.email,
            role: res.user.role,
            skills: res.user.role === 'freelancer'
              ? ['UI/UX Design', 'Branding', 'Figma', 'Interaction', 'Motion']
              : ['Project Management', 'Communication', 'Hiring', 'Product Strategy']
          }));
        }

        await this.router.navigateByUrl('/home');
      },
      error: (err) => {
        this.isLoading = false;

        if (err.status === 400 || err.status === 401) {
          this.formErrors = { ...this.formErrors, ...(err.error?.errors || {}) };
        } else {
          this.formErrors.general = 'Unable to login right now.';
        }
      }
    });
  }
}
