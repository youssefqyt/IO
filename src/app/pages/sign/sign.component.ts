import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // استيراد HttpClient لإرسال الطلبات
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

  fullName: string = '';
  email: string = '';
  password: string = '';

  constructor(private http: HttpClient) {}

  setRole(role: 'freelancer' | 'client') {
    this.selectedRole = role;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  signup() {
    // تجميع البيانات
    const payload = {
      role: this.selectedRole,
      fullName: this.fullName,
      email: this.email,
      password: this.password,
    };

    // POST request للـ Flask API
    this.http.post('http://localhost:5000/api/signup', payload)
      .subscribe({
        next: (res) => {
          console.log('Success:', res);
          // هنا ممكن تعمل redirect للـ login page
        },
        error: (err) => {
          console.error('Error:', err);
          // هنا ممكن تعرض رسالة خطأ للمستخدم
        }
      });
  }
}
