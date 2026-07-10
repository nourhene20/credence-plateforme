import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HistoryItem {
  analyse_id: number;
  input_text: string;
  routing_decision: string;
  created_at: string;
  prediction: {
    label: string;
    confidence: number;
    epistemic: number;
    aleatoric: number;
  } | null;
  model: string | null;
  dataset: string | null;
  n_heads: number | null;
}

export interface HistoryResponse {
  data: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryStats {
  total: number;
  routing: {
    TRUST: number;
    DATA: number;
    REVIEW: number;
    ABSTAIN: number;
  };
  avg_confidence: number;
}

export interface HistoryFilters {
  search?: string;
  routing?: string;
  model?: string;
  dataset?: string;
  date_from?: Date;
  date_to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHistory(filters: HistoryFilters = {}): Observable<HistoryResponse> {
    let params = new HttpParams();
    
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.offset) params = params.set('offset', filters.offset.toString());
    if (filters.search) params = params.set('search', filters.search);
    if (filters.routing) params = params.set('routing', filters.routing);
    if (filters.model) params = params.set('model', filters.model);
    if (filters.dataset) params = params.set('dataset', filters.dataset);
    if (filters.date_from) params = params.set('date_from', filters.date_from.toISOString());
    if (filters.date_to) params = params.set('date_to', filters.date_to.toISOString());
    
    return this.http.get<HistoryResponse>(`${this.apiUrl}/analyse/history`, { params });
  }

  getHistoryStats(): Observable<HistoryStats> {
    return this.http.get<HistoryStats>(`${this.apiUrl}/analyse/history/stats`);
  }

  getHistoryDetail(analyseId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/analyse/history/${analyseId}`);
  }
}