import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
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
  isLoading = false;

  fullName: string = '';
  email: string = '';
  password: string = '';

  formErrors: any = {
    fullName: '',
    email: '',
    password: '',
    role: '',
    general: ''
  };

  successMessage: string = '';

  constructor(private http: HttpClient, private router: Router) {}

  setRole(role: 'freelancer' | 'client') {
    this.selectedRole = role;
  }

  signup() {

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

          this.successMessage = res?.message || "Compte created";

          const createdProfile = {
            id: res?.user?.id || '',
            fullName: this.fullName.trim(),
            email: this.email.trim(),
            role: this.selectedRole,
            skills: this.selectedRole === 'freelancer'
              ? ['UI/UX Design', 'Branding', 'Figma', 'Interaction', 'Motion']
              : ['Project Management', 'Communication', 'Hiring', 'Product Strategy']
          };
          localStorage.setItem('fw_profile', JSON.stringify(createdProfile));

          this.fullName = '';
          this.email = '';
          this.password = '';
          this.selectedRole = 'freelancer';
          this.router.navigateByUrl('/accountecreated');
          
        },

        error: (err) => {
          this.isLoading = false;

          console.log("Full error response:", err);

          if (err.status === 400 && err.error?.errors) {
            this.formErrors = { ...this.formErrors, ...err.error.errors };
          } else {
            this.formErrors.general = "Something went wrong. Please try again later.";
          }
        }

      });
  }
}
