import { Component, OnInit, OnDestroy } from '@angular/core';
import { HistoryService, HistoryItem, HistoryStats } from '../../services/history.service';

export interface HistoryFilter {
  searchText: string;
  routingDecision: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  model: string;
  dataset: string;
}

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  
  Math = Math;
  historyData: HistoryItem[] = [];
  displayedData: HistoryItem[] = [];
  filters: HistoryFilter = {
    searchText: '',
    routingDecision: 'all',
    dateFrom: null,
    dateTo: null,
    model: 'all',
    dataset: 'all'
  };
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalPages: number = 1;
  totalItems: number = 0;
  stats: HistoryStats = {
    total: 0,
    routing: { TRUST: 0, DATA: 0, REVIEW: 0, ABSTAIN: 0 },
    avg_confidence: 0
  };
  routingDecisions: string[] = ['all', 'TRUST', 'DATA', 'REVIEW', 'ABSTAIN'];
  models: string[] = [];
  datasets: string[] = [];
  isLoading: boolean = false;
  showDetails: { [key: number]: boolean } = {};
  sortField: string = 'created_at';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedItems: Set<number> = new Set();
  selectAll: boolean = false;

  constructor(private historyService: HistoryService) {}

  ngOnInit() {
    this.loadStats();
    this.loadData();
    this.loadFilterOptions();
  }

  loadFilterOptions() {
    this.historyService.getHistory({ limit: 1000 }).subscribe({
      next: (response) => {
        const data = response.data;
        this.models = [...new Set(data.map(item => item.model).filter(Boolean))].sort() as string[];
        this.datasets = [...new Set(data.map(item => item.dataset).filter(Boolean))].sort() as string[];
      },
      error: () => {
        this.models = [];
        this.datasets = [];
      }
    });
  }

  loadStats() {
    this.historyService.getHistoryStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (err) => {
        console.error(' Erreur chargement statistiques:', err);
      }
    });
  }

  loadData() {
    this.isLoading = true;
    
    const params: any = {
      limit: this.itemsPerPage,
      offset: (this.currentPage - 1) * this.itemsPerPage
    };
    
    if (this.filters.searchText.trim()) {
      params.search = this.filters.searchText.trim();
    }
    if (this.filters.routingDecision !== 'all') {
      params.routing = this.filters.routingDecision;
    }
    if (this.filters.model !== 'all') {
      params.model = this.filters.model;
    }
    if (this.filters.dataset !== 'all') {
      params.dataset = this.filters.dataset;
    }
    if (this.filters.dateFrom) {
      params.date_from = this.filters.dateFrom.toISOString();
    }
    if (this.filters.dateTo) {
      params.date_to = this.filters.dateTo.toISOString();
    }
    
    this.historyService.getHistory(params).subscribe({
      next: (response) => {
        this.historyData = response.data;
        this.totalItems = response.total;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.updateDisplayedData();
        this.isLoading = false;
        this.loadFilterOptions();
      },
      error: (err) => {
        console.error(' Erreur chargement historique:', err);
        this.historyData = [];
        this.totalItems = 0;
        this.isLoading = false;
      }
    });
  }
  applyFilters() {
    this.currentPage = 1;
    this.loadData();
    this.loadStats();
  }

  updateDisplayedData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedData = this.historyData.slice(start, end);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadData();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  changePageSize(size: number) {
    this.itemsPerPage = size;
    this.currentPage = 1;
    this.loadData();
  }

  toggleSort(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  resetFilters() {
    this.filters = {
      searchText: '',
      routingDecision: 'all',
      dateFrom: null,
      dateTo: null,
      model: 'all',
      dataset: 'all'
    };
    this.applyFilters();
  }
  
  getRoutingColor(decision: string): string {
    const colors = {
      'TRUST': '#10b981',
      'DATA': '#3b82f6',
      'REVIEW': '#f59e0b',
      'ABSTAIN': '#ef4444'
    };
    return colors[decision as keyof typeof colors] || '#6b7280';
  }

  getRoutingBgColor(decision: string): string {
    const colors = {
      'TRUST': 'rgba(16, 185, 129, 0.1)',
      'DATA': 'rgba(59, 130, 246, 0.1)',
      'REVIEW': 'rgba(245, 158, 11, 0.1)',
      'ABSTAIN': 'rgba(239, 68, 68, 0.1)'
    };
    return colors[decision as keyof typeof colors] || 'rgba(0,0,0,0.03)';
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  }

  toggleDetails(id: number) {
    this.showDetails[id] = !this.showDetails[id];
  }

  toggleSelect(id: number) {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.displayedData.forEach(item => this.selectedItems.add(item.analyse_id));
    } else {
      this.selectedItems.clear();
    }
  }

  getRoutingIcon(decision: string): string {
    const icons = {
      'TRUST': '✅',
      'DATA': '📊',
      'REVIEW': '👁️',
      'ABSTAIN': '⚠️'
    };
    return icons[decision as keyof typeof icons] || '❓';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  exportData() {
    const dataToExport = this.selectedItems.size > 0 
      ? this.historyData.filter(item => this.selectedItems.has(item.analyse_id))
      : this.historyData;
    
    if (dataToExport.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }
    
    const csvContent = this.convertToCSV(dataToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: HistoryItem[]): string {
    const headers = ['ID', 'Texte', 'Prédiction', 'Confiance', 'EU', 'AU', 'Routage', 'Modèle', 'Dataset', 'Heads', 'Date'];
    const rows = data.map(item => [
      item.analyse_id,
      `"${item.input_text.replace(/"/g, '""')}"`,
      item.prediction?.label || '',
      item.prediction?.confidence?.toFixed(3) || '',
      item.prediction?.epistemic?.toFixed(6) || '',
      item.prediction?.aleatoric?.toFixed(4) || '',
      item.routing_decision,
      item.model || '',
      item.dataset || '',
      item.n_heads || '',
      this.formatDate(item.created_at)
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

}