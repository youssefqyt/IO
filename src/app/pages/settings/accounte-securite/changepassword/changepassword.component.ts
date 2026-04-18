import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-changepassword',
  templateUrl: './changepassword.component.html',
  styleUrls: ['./changepassword.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class ChangepasswordComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isLoading = false;
  successMessage = '';
  formErrors: { currentPassword: string; newPassword: string; confirmPassword: string; general: string } = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    general: ''
  };

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  goBack(): void {
    this.router.navigateByUrl('/accounte-securite');
  }

  onSubmit(): void {
    this.formErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      general: ''
    };
    this.successMessage = '';

    if (!this.currentPassword) {
      this.formErrors.currentPassword = 'Current password is required';
    }
    if (!this.newPassword) {
      this.formErrors.newPassword = 'New password is required';
    } else if (this.newPassword.length < 8) {
      this.formErrors.newPassword = 'New password must be at least 8 characters';
    }
    if (!this.confirmPassword) {
      this.formErrors.confirmPassword = 'Please confirm your new password';
    } else if (this.confirmPassword !== this.newPassword) {
      this.formErrors.confirmPassword = 'New password and confirm password do not match';
    }

    if (this.formErrors.currentPassword || this.formErrors.newPassword || this.formErrors.confirmPassword) {
      return;
    }

    const token = localStorage.getItem('fw_token');
    if (!token) {
      this.formErrors.general = 'You are not logged in. Please login again.';
      return;
    }

    this.isLoading = true;
    this.http.post<{ message: string }>(
      'http://localhost:5000/api/change-password',
      {
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
        confirmPassword: this.confirmPassword
      },
      {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      }
    ).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res?.message || 'Password updated successfully';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.isLoading = false;
        if ((err.status === 400 || err.status === 401 || err.status === 404) && err.error?.errors) {
          this.formErrors = { ...this.formErrors, ...err.error.errors };
          return;
        }

        this.formErrors.general = 'Unable to change password right now.';
      }
    });
  }

}
