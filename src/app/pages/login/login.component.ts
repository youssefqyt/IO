import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

interface LoginResponse {
  ok: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule]
})
export class LoginComponent {
  showPassword = false;
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onLogin(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter email and password.';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiBaseUrl}/api/login`, {
          email: this.email.trim(),
          password: this.password
        })
      );

      if (response.ok) {
        await this.router.navigateByUrl('/market');
        return;
      }

      this.errorMessage = response.message || 'Login failed.';
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      this.errorMessage = httpError.error?.message || 'Unable to login right now.';
    } finally {
      this.isLoading = false;
    }
  }
}
