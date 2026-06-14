// credence.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PredictionResult {
  prediction: string;
  confidence: number;
  epistemic: number;
  aleatoric: number;
  
  
  aleatoric_by_concept?: { food: number; service: number; ambiance: number; noise: number; };
  concepts?: Record<string, number>;
  concept_uncertainties?: Record<string, number>;
  heads_predictions?: Record<string, Record<string, number>>;
  
  
  probabilities?: {
    entailment: number;
    neutral: number;
    contradiction: number;
  };
}

@Injectable({ providedIn: 'root' })
export class CredenceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  predict(text: string, dataset: string = 'cebab'): Observable<PredictionResult> {
  return this.http.post<PredictionResult>(`${this.apiUrl}/predict`, { text, dataset });
  }
}