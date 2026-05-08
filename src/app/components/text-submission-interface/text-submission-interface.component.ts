import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CredenceService, PredictionResult } from '../../services/credence.service';
import { AuthService, User } from '../shared/auth.service';

@Component({
  selector: 'app-text-submission-interface',
  templateUrl: './text-submission-interface.component.html',
  styleUrls: ['./text-submission-interface.component.scss']
})
export class TextSubmissionInterfaceComponent implements OnInit {
  mode: 'single' | 'batch' = 'single';
  inputText: string = '';
  charCount: number = 0;
  isLoading: boolean = false;
  isDragging: boolean = false;
  selectedFile: File | null = null;
  errorMessage: string = '';
  result: PredictionResult | null = null;
  thresholdEpi: number = 0.001481;
  thresholdAle: number = 0.5522;
  epiStatus: string = '';
  aleStatus: string = '';
  currentUser: User | null = null;

  constructor(
    private credenceService: CredenceService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Récupérer l'utilisateur connecté
    this.currentUser = this.authService.getCurrentUser();
    
    // Vérifier si l'utilisateur est connecté
    if (!this.currentUser) {
      this.router.navigate(['/login']);
    }
  }

  // Déconnexion
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  setMode(m: 'single' | 'batch') {
    this.mode = m;
    this.errorMessage = '';
    this.selectedFile = null;
    this.result = null;
  }


  onInput() {
    this.charCount = this.inputText.length;
  }

  resetThresholds() {
    this.thresholdEpi = 0.001481;
    this.thresholdAle = 0.5522;
  }


  get routingDecision(): string {
    if (!this.result) return 'WAITING';
    
    const epiHigh = this.result.epistemic >= this.thresholdEpi;
    const aleHigh = (this.result.aleatoric || 0) >= this.thresholdAle;
    
    this.epiStatus = epiHigh ? 'HIGH' : 'LOW';
    this.aleStatus = aleHigh ? 'HIGH' : 'LOW';
    
    if (!epiHigh && !aleHigh) return 'TRUST';
    if (epiHigh && !aleHigh) return 'DATA';
    if (!epiHigh && aleHigh) return 'REVIEW';
    return 'ABSTAIN';
  }

  getRoutingColor(): string {
    switch(this.routingDecision) {
      case 'TRUST': return '#10b981';
      case 'DATA': return '#3b82f6';
      case 'REVIEW': return '#f59e0b';
      case 'ABSTAIN': return '#ef4444';
      default: return '#6366f1';
    }
  }

  getRoutingBgColor(): string {
    switch(this.routingDecision) {
      case 'TRUST': return 'rgba(16, 185, 129, 0.1)';
      case 'DATA': return 'rgba(59, 130, 246, 0.1)';
      case 'REVIEW': return 'rgba(245, 158, 11, 0.1)';
      case 'ABSTAIN': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgba(0,0,0,0.03)';
    }
  }

  getEpiColor(): string {
    if (!this.result) return '#94a3b8';
    return this.result.epistemic >= this.thresholdEpi ? '#ef4444' : '#10b981';
  }

  getAleColor(): string {
    if (!this.result) return '#94a3b8';
    return (this.result.aleatoric || 0) >= this.thresholdAle ? '#ef4444' : '#10b981';
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    
    const file = e.dataTransfer?.files[0];
    if (file && file.name.endsWith('.txt')) {
      this.selectedFile = file;
      this.errorMessage = '';
    } else {
      this.errorMessage = 'Please upload a valid TXT file';
    }
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file && file.name.endsWith('.txt')) {
      this.selectedFile = file;
      this.errorMessage = '';
    } else {
      this.errorMessage = 'Please upload a valid TXT file';
    }
  }

  canSubmit(): boolean {
    if (this.isLoading) return false;
    if (this.mode === 'single') return this.inputText.trim().length > 3;
    return this.selectedFile !== null;
  }

  onSubmit() {
    if (!this.canSubmit()) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    this.result = null;
    
    this.credenceService.predict(this.inputText).subscribe({
      next: (response) => {
        this.result = response;
        this.isLoading = false;
        console.log('Résultat reçu:', response);
      },
      error: (err) => {
        console.error('Erreur API:', err);
        this.errorMessage = 'Error: ' + err.message;
        this.isLoading = false;
      }
    });
  }

  getUncertainty(conceptKey: string): number {
    if (!this.result) return 0;
    const val = this.result.concept_uncertainties[conceptKey];
    return val ? val  : 0;
  }
  getAleatoricByConcept(conceptKey: string): number {
  if (!this.result?.aleatoric_by_concept) return 0;
  const value = this.result.aleatoric_by_concept[conceptKey as keyof typeof this.result.aleatoric_by_concept];
  return value ? value : 0;
}


getAleatoricColor(conceptKey: string): string {
  const au = this.getAleatoricByConcept(conceptKey); 
  return '#f9a8d4';                  
}
}
