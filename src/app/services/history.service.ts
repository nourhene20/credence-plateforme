import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HistoryItem,HistoryResponse,HistoryStats,HistoryFilters } from '../shared/models_interfaces';



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
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    
    return this.http.get<HistoryResponse>(`${this.apiUrl}/analyse/history`, { params });
  }

  getHistoryStats(): Observable<HistoryStats> {
    return this.http.get<HistoryStats>(`${this.apiUrl}/analyse/history/stats`);
  }

  getHistoryDetail(analyseId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/analyse/history/${analyseId}`);
  }
}