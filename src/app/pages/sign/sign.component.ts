import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sign',
  templateUrl: './sign.component.html',
  styleUrls: ['./sign.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, RouterModule]
})
export class SignComponent {

  selectedRole: 'freelancer' | 'client' = 'freelancer';
  showPassword = false;
  isLoading = false;

  fullName: string = '';
  email: string = '';
  password: string = '';

  // Structured errors
  formErrors: any = {
    fullName: '',
    email: '',
    password: '',
    role: '',
    general: ''
  };

  // Success message
  successMessage: string = '';

  constructor(private http: HttpClient) {}

  setRole(role: 'freelancer' | 'client') {
    this.selectedRole = role;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  signup() {

    // Reset errors and success
    this.formErrors = { fullName: '', email: '', password: '', role: '', general: '' };
    this.successMessage = '';
    this.isLoading = true;

    const payload = {
      role: this.selectedRole,
      fullName: this.fullName,
      email: this.email,
      password: this.password,
    };

    this.http.post('http://localhost:5000/api/signup', payload)
      .subscribe({

        next: (res: any) => {
          this.isLoading = false;

          // إذا الكل صحيح
          this.successMessage = res?.message || "Compte created";

          // Reset form
          this.fullName = '';
          this.email = '';
          this.password = '';
          this.selectedRole = 'freelancer';
        },

        error: (err) => {
          this.isLoading = false;

          console.log("Full error response:", err);

          if (err.status === 400 && err.error?.errors) {
            // Map errors from API
            this.formErrors = { ...this.formErrors, ...err.error.errors };
          } else {
            // Unexpected errors
            this.formErrors.general = "Something went wrong. Please try again later.";
          }
        }

      });
  }
}