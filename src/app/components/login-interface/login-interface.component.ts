// src/app/login/login-interface.component.ts

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login-interface.component.html',
  styleUrls: ['./login-interface.component.scss']
})
export class LoginInterfaceComponent {
  
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  selectedRole = 'researcher';

  roles = [
    { id: 'researcher', name: 'Researcher', icon: '🔬', description: 'Full access to analysis and data' },
    { id: 'expert', name: 'Expert / Reviewer', icon: '👁️', description: 'Human validation and review' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['researcher', Validators.required],
      rememberMe: [false]
    });
  }

  selectRole(roleId: string) {
    this.selectedRole = roleId;
    this.loginForm.patchValue({ role: roleId });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password, role, rememberMe } = this.loginForm.value;
    
    this.authService.login(email, password, role, rememberMe).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          // ✅ CONNEXION RÉUSSIE - Redirection vers dashboard
          this.router.navigate(['/text-submission']);
        } else {
          this.errorMessage = response.message || 'Invalid email or password';
        }
      },
      error: (err) => {
        this.errorMessage = 'Invalid email or password';
        this.isLoading = false;
      }
    });
  }

  loginWithGoogle() {
    this.isLoading = true;
    this.authService.loginWithGoogle().subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.router.navigate(['/text-submission']);
        }
      },
      error: () => {
        this.errorMessage = 'Google login failed';
        this.isLoading = false;
      }
    });
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);
    if (control?.hasError('required')) return 'This field is required';
    if (control?.hasError('email')) return 'Invalid email address';
    if (control?.hasError('minlength')) return 'Minimum 6 characters';
    return '';
  }
}