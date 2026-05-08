import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup-interface.component.html',
  styleUrls: ['./signup-interface.component.scss']
})
export class SignupInterfaceComponent {
  
  signupForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;
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
    this.signupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      role: ['researcher', Validators.required],
      acceptTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: AbstractControl): ValidationErrors | null {
    const password = g.get('password')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  selectRole(roleId: string) {
    this.selectedRole = roleId;
    this.signupForm.patchValue({ role: roleId });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { name, email, password, role } = this.signupForm.value;
    
    this.authService.signup(name, email, password, role).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = response.message || 'Registration failed';
        }
      },
      error: () => {
        this.errorMessage = 'Registration failed';
        this.isLoading = false;
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  getErrorMessage(field: string): string {
    const control = this.signupForm.get(field);
    if (control?.hasError('required')) return 'This field is required';
    if (control?.hasError('email')) return 'Invalid email address';
    if (control?.hasError('minlength')) return field === 'password' ? 'Minimum 6 characters' : 'Minimum 2 characters';
    return '';
  }
}