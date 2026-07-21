import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PredictionResult } from '../shared/models_interfaces';


@Injectable({ providedIn: 'root' })
export class CredenceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  predict(text: string,encoder: string, dataset: string , n_heads: number = 5): Observable<PredictionResult> {
  return this.http.post<PredictionResult>(`${this.apiUrl}/predict`, { text, encoder, dataset, n_heads });
  }
}