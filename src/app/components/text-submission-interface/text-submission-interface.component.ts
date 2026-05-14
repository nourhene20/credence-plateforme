import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import {
  CredenceService,
  PredictionResult,
} from '../../services/credence.service';
/*import { AuthService, User } from '../shared/auth.service';*/
import {
  ConfigService,
  ModelInfo,
  DatasetInfo,
  TaskInfo,
} from '../../services/config.service';

Chart.register(...registerables);

interface ScatterPoint {
  x: number;
  y: number;
  routing: 'TRUST' | 'DATA' | 'REVIEW' | 'ABSTAIN';
  pred: string;
  text: string;
}

@Component({
  selector: 'app-text-submission-interface',
  templateUrl: './text-submission-interface.component.html',
  styleUrls: ['./text-submission-interface.component.scss'],
})
export class TextSubmissionInterfaceComponent
  implements OnInit, OnDestroy, AfterViewInit
{
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
  /*currentUser: User | null = null;*/
  modelType: 'encoder' | 'llm' = 'encoder';
  private conceptHistogram: Chart | null = null;
  private euAccuracyChart: Chart | null = null;
  encoderModels: { key: string; info: ModelInfo }[] = [];
  llmModels: { key: string; info: ModelInfo }[] = [];
  filteredModels: { key: string; info: ModelInfo }[] = [];
  datasets: { key: string; info: DatasetInfo }[] = [];
  datasetGroups: {
    label: string;
    datasets: { key: string; info: DatasetInfo }[];
  }[] = [];
  filteredDatasets: { key: string; info: DatasetInfo }[] = [];
  tasksList: { key: string; info: TaskInfo }[] = [];
  selectedTask: string = 'all';
  selectedModel: string = 'distilbert-base-uncased';
  selectedDataset: string = 'cebab';
  currentModelInfo: ModelInfo | null = null;
  currentDatasetInfo: DatasetInfo | null = null;
  showModelDetails: boolean = false;
  showDatasetDetails: boolean = false;
  scatterPoints: ScatterPoint[] = [];
  routingCounts = { TRUST: 0, DATA: 0, REVIEW: 0, ABSTAIN: 0 };
  private scatterChart: Chart | null = null;
  private headsPerConceptChart: Chart | null = null;
  private readonly ROUTING_COLORS: Record<string, string> = {
    TRUST: '#1D9E75',
    DATA: '#378ADD',
    REVIEW: '#BA7517',
    ABSTAIN: '#E24B4A',
  };

  constructor(
    private credenceService: CredenceService,
    /*private authService: AuthService,*/
    private router: Router,
    private configService: ConfigService,
  ) {}

  /*Initializes component, loads configuration */

  ngOnInit() {
    /*this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
    }*/
    this.loadConfig();
  }

  /** Initializes charts after view is rendered */

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.scatterPoints.length > 0) {
        this.renderScatterChart();
      }
    }, 500);
  }

  /** Cleans up chart instances to prevent memory leaks */

  ngOnDestroy() {
    if (this.scatterChart) {
      this.scatterChart.destroy();
      this.scatterChart = null;
    }
    if (this.conceptHistogram) {
      this.conceptHistogram.destroy();
      this.conceptHistogram = null;
    }
    if (this.euAccuracyChart) {
      this.euAccuracyChart.destroy();
      this.euAccuracyChart = null;
    }
    if (this.headsPerConceptChart) {
      this.headsPerConceptChart.destroy();
      this.headsPerConceptChart = null;
    }
  }

  /* Loads models, datasets and tasks from config service */
  async loadConfig() {
    try {
      await this.configService.loadConfig();
      const allModels = this.configService.getModelList();
      this.encoderModels = allModels.filter((m) => m.info.type === 'encoder');
      this.llmModels = allModels.filter((m) => m.info.type === 'llm');
      this.filteredModels = [...this.encoderModels];
      this.selectedModel = this.filteredModels[0]?.key || '';
      this.datasets = this.configService.getDatasetList();
      this.filteredDatasets = [...this.datasets];
      this.selectedDataset = this.datasets[0]?.key || '';
      this.tasksList = this.configService.getTaskList();
      this.buildDatasetGroups();
      this.updateCurrentModelInfo();
      this.updateCurrentDatasetInfo();
      console.log('Configuration chargée:', {
        encoderModels: this.encoderModels.length,
        llmModels: this.llmModels.length,
        datasets: this.datasets.length,
      });
    } catch (error) {
      console.error('Erreur chargement configuration:', error);
      this.encoderModels = [];
      this.llmModels = [];
      this.datasets = [];
      this.tasksList = [];
    }
  }

  /* Switches between Encoder and LLM model types */

  setModelType(type: 'encoder' | 'llm') {
    this.modelType = type;
    this.filteredModels =
      type === 'encoder' ? [...this.encoderModels] : [...this.llmModels];
    this.selectedModel = this.filteredModels[0]?.key || '';
    this.updateCurrentModelInfo();
  }

  /* Updates current model info when selection changes */
  onModelChange() {
    this.updateCurrentModelInfo();
    console.log('Modèle sélectionné:', this.selectedModel);
  }

  /* Updates displayed model information */

  updateCurrentModelInfo() {
    this.currentModelInfo = this.configService.getModel(this.selectedModel);
  }

  /* Returns emoji icon for selected model */

  getModelIcon(modelKey: string): string {
    const icons: Record<string, string> = {
      'distilbert-base-uncased': '🐻',
      'bert-base-uncased': '📘',
      'roberta-base': '🦊',
      'answerdotai/ModernBERT-base': '⚡',
      'meta-llama/Llama-3.2-3B': '🦙',
      'Qwen/Qwen2.5-3B': '🐉',
      'google/gemma-2-2b': '💎',
      'microsoft/Phi-3.5-mini-instruct': '📱',
    };
    return icons[modelKey] || (this.modelType === 'encoder' ? '📦' : '🤖');
  }

  /* Toggles detailed model information panel */

  toggleModelDetails() {
    this.showModelDetails = !this.showModelDetails;
  }

  /* Builds grouped dataset options by task */

  buildDatasetGroups() {
    const groups: Map<string, { key: string; info: DatasetInfo }[]> = new Map();

    const datasetsToGroup =
      this.filteredDatasets.length > 0 ? this.filteredDatasets : this.datasets;

    for (const dataset of datasetsToGroup) {
      const task = dataset.info.task;
      if (!groups.has(task)) {
        groups.set(task, []);
      }
      groups.get(task)!.push(dataset);
    }

    const taskLabels: Record<string, string> = {
      sentiment: '📊 Sentiment Analysis',
      toxicity: '⚠️ Toxicity Detection',
      emotion: '😊 Emotion Detection',
      nli: '🔍 Natural Language Inference',
    };

    this.datasetGroups = Array.from(groups.entries()).map(
      ([task, datasets]) => ({
        label: taskLabels[task] || task,
        datasets,
      }),
    );
  }

  /* Handles dataset selection change */

  onDatasetChange() {
    this.updateCurrentDatasetInfo();
    console.log('Dataset sélectionné:', this.selectedDataset);
  }

  /* Updates current dataset information */

  updateCurrentDatasetInfo() {
    this.currentDatasetInfo = this.configService.getDataset(
      this.selectedDataset,
    );
  }

  /* Filters datasets by selected task */

  filterDatasetsByTask(taskKey: string) {
    this.selectedTask = taskKey;
    if (taskKey === 'all') {
      this.filteredDatasets = [...this.datasets];
    } else {
      this.filteredDatasets = this.datasets.filter(
        (d) => d.info.task === taskKey,
      );
    }
    this.buildDatasetGroups();
    if (!this.filteredDatasets.find((d) => d.key === this.selectedDataset)) {
      this.selectedDataset = this.filteredDatasets[0]?.key || '';
      this.updateCurrentDatasetInfo();
    }
  }

  /* Resets the dataset filter to show all */

  resetFilter() {
    this.selectedTask = 'all';
    this.filteredDatasets = [...this.datasets];
    this.buildDatasetGroups();
  }

  /* Toggles detailed dataset information panel */

  toggleDatasetDetails() {
    this.showDatasetDetails = !this.showDatasetDetails;
  }

  /* Returns color for task filter buttons */

  getTaskColor(task: string): string {
    const colors: Record<string, string> = {
      sentiment: '#10b981',
      toxicity: '#ef4444',
      emotion: '#f59e0b',
      nli: '#3b82f6',
    };
    return colors[task] || '#6b7280';
  }

  /* logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }*/

  /* Switches between single and batch analysis mode */

  setMode(m: 'single' | 'batch') {
    this.mode = m;
    this.errorMessage = '';
    this.selectedFile = null;
    this.result = null;
  }

  /* Updates character count for single text input */

  onInput() {
    this.charCount = this.inputText.length;
  }

  /* Resets thresholds to default values */

  resetThresholds() {
    this.thresholdEpi = 0.001481;
    this.thresholdAle = 0.5522;
    if (this.scatterPoints.length > 0) {
      this.refreshScatterRouting();
    }
  }

  /* Handles real-time threshold changes */
  onThresholdChange() {
    if (this.scatterPoints.length > 0) {
      this.refreshScatterRouting();
    }
  }

  /* Returns the routing decision based on current thresholds */

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
    switch (this.routingDecision) {
      case 'TRUST':
        return '#10b981';
      case 'DATA':
        return '#3b82f6';
      case 'REVIEW':
        return '#f59e0b';
      case 'ABSTAIN':
        return '#ef4444';
      default:
        return '#6366f1';
    }
  }

  getRoutingBgColor(): string {
    switch (this.routingDecision) {
      case 'TRUST':
        return 'rgba(16, 185, 129, 0.1)';
      case 'DATA':
        return 'rgba(59, 130, 246, 0.1)';
      case 'REVIEW':
        return 'rgba(245, 158, 11, 0.1)';
      case 'ABSTAIN':
        return 'rgba(239, 68, 68, 0.1)';
      default:
        return 'rgba(0,0,0,0.03)';
    }
  }

  getEpiColor(): string {
    if (!this.result) return '#94a3b8';
    return this.result.epistemic >= this.thresholdEpi ? '#ef4444' : '#10b981';
  }

  getAleColor(): string {
    if (!this.result) return '#94a3b8';
    return (this.result.aleatoric || 0) >= this.thresholdAle
      ? '#ef4444'
      : '#10b981';
  }

  /* Handles drag and drop  event for file upload */

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

  /* Checks if analysis can be submitted */

  canSubmit(): boolean {
    if (this.isLoading) return false;
    if (this.mode === 'single') return this.inputText.trim().length > 3;
    return this.selectedFile !== null;
  }

  /* Main method to trigger analysis */

  onSubmit() {
    if (!this.canSubmit()) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.result = null;
    const requestPayload: any = {
      text: this.inputText,
      model: this.selectedModel,
      dataset: this.selectedDataset,
      model_type: this.modelType,
    };

    this.credenceService.predict(this.inputText).subscribe({
      next: (response) => {
        this.result = response;
        this.isLoading = false;
        console.log('Résultat reçu:', response);
        setTimeout(() => this.addPointAndRender(response), 50);
        setTimeout(() => this.renderConceptHistogram(), 100);
        setTimeout(() => this.renderEUCurve(), 150);
        setTimeout(() => this.renderHeadsPerConceptChart(), 150);
      },
      error: (err) => {
        console.error('Erreur API:', err);
        this.errorMessage = 'Error: ' + err.message;
        this.isLoading = false;
      },
    });
  }

  /* getter methods */

  getUncertainty(conceptKey: string): number {
    if (!this.result) return 0;
    const val = this.result.concept_uncertainties[conceptKey];
    return val ? val : 0;
  }

  getAleatoricByConcept(conceptKey: string): number {
    if (!this.result?.aleatoric_by_concept) return 0;
    const value =
      this.result.aleatoric_by_concept[
        conceptKey as keyof typeof this.result.aleatoric_by_concept
      ];
    return value ? value : 0;
  }

  getAleatoricColor(conceptKey: string): string {
    const au = this.getAleatoricByConcept(conceptKey);
    if (au < 0.3) return '#fbcfe8';
    if (au < 0.6) return '#f9a8d4';
    return '#f472b6';
  }

  /* Computes routing decision for given epistemic and aleatoric values */

  private computeRouting(
    eu: number,
    au: number,
  ): 'TRUST' | 'DATA' | 'REVIEW' | 'ABSTAIN' {
    const eH = eu >= this.thresholdEpi;
    const aH = au >= this.thresholdAle;
    if (!eH && !aH) return 'TRUST';
    if (eH && !aH) return 'DATA';
    if (!eH && aH) return 'REVIEW';
    return 'ABSTAIN';
  }

  /* Adds a new point to the scatter plot and re-renders it */

  addPointAndRender(response: PredictionResult) {
    this.scatterPoints.push({
      x: response.epistemic,
      y: response.aleatoric ?? 0,
      routing: this.computeRouting(response.epistemic, response.aleatoric ?? 0),
      pred: response.prediction,
      text: this.inputText.slice(0, 40),
    });
    this.updateRoutingCounts();
    this.renderScatterChart();
  }

  /* Renders the concept histogram */

  renderConceptHistogram() {
    if (!this.result || !this.result.concepts) return;

    const canvas = document.getElementById(
      'conceptHistogram',
    ) as HTMLCanvasElement;
    if (!canvas) return;
    if (this.conceptHistogram) {
      this.conceptHistogram.destroy();
      this.conceptHistogram = null;
    }

    const concepts = Object.keys(this.result.concepts);
    const euValues: number[] = [];
    const auValues: number[] = [];

    concepts.forEach((concept) => {
      euValues.push(this.getUncertainty(concept));
      auValues.push(this.getAleatoricByConcept(concept));
    });

    this.conceptHistogram = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: concepts,
        datasets: [
          {
            label: 'Epistemic Uncertainty (EU)',
            data: euValues,
            backgroundColor: '#f59e0b',
            borderColor: '#d97706',
            borderWidth: 1,
          },
          {
            label: 'Aleatoric Uncertainty (AU)',
            data: auValues,
            backgroundColor: '#db2777',
            borderColor: '#be185d',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            ticks: {
              stepSize: 0.1,
              precision: 4,
            },
            title: {
              display: true,
              text: 'Uncertainty Value',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Concepts',
            },
          },
        },
      },
    });
  }

  /* Recomputes routing for all points in the scatter plot based on current thresholds and updates the chart */

  refreshScatterRouting() {
    this.scatterPoints = this.scatterPoints.map((p) => ({
      ...p,
      routing: this.computeRouting(p.x, p.y),
    }));
    this.updateRoutingCounts();
    this.renderScatterChart();
  }

  /* Updates the counts of points in each routing category based on the current scatter points */

  updateRoutingCounts() {
    this.routingCounts = { TRUST: 0, DATA: 0, REVIEW: 0, ABSTAIN: 0 };
    this.scatterPoints.forEach((p) => this.routingCounts[p.routing]++);
  }

  /* Returns the percentage of points in the scatter plot that fall into a given routing category */

  getRoutingPercentage(decision: string): number {
    if (this.scatterPoints.length === 0) return 0;
    const count =
      this.routingCounts[decision as keyof typeof this.routingCounts];
    return Math.round((count / this.scatterPoints.length) * 100);
  }

  /* Resets the scatter plot by clearing all points, resetting routing counts, and destroying the chart instance */

  resetScatter() {
    this.scatterPoints = [];
    this.routingCounts = { TRUST: 0, DATA: 0, REVIEW: 0, ABSTAIN: 0 };
    if (this.scatterChart) {
      this.scatterChart.destroy();
      this.scatterChart = null;
    }
  }

  /* Renders the scatter plot using Chart.js with the current scatter points, including threshold lines and tooltips */
  renderScatterChart() {
    const canvas = document.getElementById('scatterChart') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas scatterChart non trouvé');
      return;
    }
    if (this.scatterChart) {
      this.scatterChart.destroy();
      this.scatterChart = null;
    }

    const groups: Record<string, { x: number; y: number }[]> = {
      TRUST: [],
      DATA: [],
      REVIEW: [],
      ABSTAIN: [],
    };
    this.scatterPoints.forEach((p) =>
      groups[p.routing].push({ x: p.x, y: p.y }),
    );
    const datasets: any[] = Object.entries(groups)
      .filter(([, pts]) => pts.length > 0)
      .map(([key, pts]) => ({
        label: key,
        data: pts,
        backgroundColor: this.ROUTING_COLORS[key] + 'BB',
        borderColor: this.ROUTING_COLORS[key],
        borderWidth: 1,
        pointRadius: 7,
        pointHoverRadius: 10,
      }));
    datasets.push({
      label: '_epi',
      data: [
        { x: this.thresholdEpi, y: -0.05 },
        { x: this.thresholdEpi, y: 1.05 },
      ],
      type: 'line',
      borderColor: '#88888877',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
    });

    datasets.push({
      label: '_ale',
      data: [
        { x: -0.0002, y: this.thresholdAle },
        { x: 0.012, y: this.thresholdAle },
      ],
      type: 'line',
      borderColor: '#88888877',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
    });
    this.scatterChart = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => !item.dataset.label?.startsWith('_'),
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw as { x: number; y: number };
                const pt = this.scatterPoints.find(
                  (s) => s.x === p.x && s.y === p.y,
                );
                return [
                  `Routing : ${ctx.dataset.label}`,
                  `EU : ${p.x.toFixed(6)}`,
                  `AU : ${p.y.toFixed(4)}`,
                  pt ? `"${pt.text}${pt.text.length === 40 ? '…' : ''}"` : '',
                ].filter(Boolean);
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Epistemic Uncertainty (EU)',
              color: '#888',
            },
            min: -0.0002,
            max: 0.012,
            ticks: {
              callback: (v: any) => Number(v).toFixed(4),
              maxTicksLimit: 6,
            },
          },
          y: {
            title: {
              display: true,
              text: 'Aleatoric Uncertainty (AU)',
              color: '#888',
            },
            min: -0.05,
            max: 1.05,
          },
        },
      },
    });

    console.log(
      'Scatter chart rendu avec',
      this.scatterPoints.length,
      'points',
    );
  }

  /* Renders the EU vs Accuracy curve, plotting both the theoretical inverse relationship and the current concepts' values */

  renderEUCurve() {
  if (!this.result || !this.result.concepts) return;

  const canvas = document.getElementById('euAccuracyChart') as HTMLCanvasElement;
  if (!canvas) return;

  if (this.euAccuracyChart) {
    this.euAccuracyChart.destroy();
    this.euAccuracyChart = null;
  }

  const concepts = Object.keys(this.result.concepts);
  const euValues: number[] = [];
  const accuracyValues: number[] = [];

  concepts.forEach((concept) => {
    euValues.push(this.getUncertainty(concept));
    accuracyValues.push(this.result!.concepts[concept as keyof typeof this.result.concepts]);
  });

  // Préparer les points pour le scatter plot
  const points = euValues.map((eu, idx) => ({
    x: eu,
    y: accuracyValues[idx]
  }));

  this.euAccuracyChart = new Chart(canvas, {
    type: 'scatter',  // ← Changé de 'line' à 'scatter'
    data: {
      datasets: [
        {
          label: 'Current Concepts',
          data: points,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          pointRadius: 7,
          pointHoverRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const idx = ctx.dataIndex;
              const conceptName = concepts[idx] || '';
              const acc = ctx.raw.y;
              const eu = ctx.raw.x;
              return [
                `${conceptName}`,
                `Accuracy: ${acc.toFixed(3)}`,
                `EU: ${eu.toFixed(5)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Epistemic Uncertainty (EU)' },
          type: 'linear',
          min: 0,
        },
        y: {
          title: { display: true, text: 'Accuracy / Concept Confidence' },
          min: 0,
          max: 1.05,
        },
      },
    },
  });
}
  /* Renders a line chart showing the per-head predictions for each concept, with one line per concept */

  renderHeadsPerConceptChart() {
    if (!this.result?.heads_predictions) {
      console.warn('heads_predictions non disponible dans le résultat');
      return;
    }

    const canvas = document.getElementById(
      'headsPerConceptChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.headsPerConceptChart) {
      this.headsPerConceptChart.destroy();
      this.headsPerConceptChart = null;
    }

    const conceptNames = Object.keys(this.result.heads_predictions);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    const datasets: any[] = [];

    conceptNames.forEach((concept, idx) => {
      const headValues = this.result!.heads_predictions![concept];
      const headNumbers: number[] = Object.values(headValues);

      datasets.push({
        label: concept.charAt(0).toUpperCase() + concept.slice(1),
        data: headNumbers,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '33',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 9,
        pointBackgroundColor: '#ffffff',
        pointBorderWidth: 2,
      });
    });

    this.headsPerConceptChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['Head 0', 'Head 1', 'Head 2', 'Head 3', 'Head 4'],
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 13 },
              padding: 20,
              usePointStyle: true,
            },
          },
          title: {
            display: true,
            text: 'Per-Head Predictions per Concept',
            font: { size: 16, weight: 'bold' },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx) => {
                return `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(4)}`;
              },
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 1,
            title: {
              display: true,
              text: 'Predicted Probability',
            },
            ticks: {
              stepSize: 0.1,
            },
          },
          x: {
            title: {
              display: true,
              text: 'Heads',
            },
          },
        },
      },
    });
  }
}
