import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import {
  CredenceService
} from '../../services/credence.service';
import {  ModelInfo,
  DatasetInfo,
  TaskInfo,PredictionResult} from '../../shared/models_interfaces';
import { environment } from 'environments/environment';
import { AdminService } from 'src/app/services/admin.service';

Chart.register(...registerables);

interface ScatterPoint {
  x: number;
  y: number;
  routing: 'TRUST' | 'DATA' | 'REVIEW' | 'ABSTAIN';
  pred: string;
  text: string;
}

interface AvailableCombination {
  encoder: string;
  dataset: string;
  n_heads: number;
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
  private snliProbChart: Chart | null = null;
  private snliHeadsChart: Chart | null = null;
  // availableCombinations: AvailableCombination[] = [];
  availableHeads: number[] = [];
  selectedNHeads: number = 5;
  noCheckpointAvailable: boolean = false;
  private readonly ROUTING_COLORS: Record<string, string> = {
    TRUST: '#1D9E75',
    DATA: '#378ADD',
    REVIEW: '#BA7517',
    ABSTAIN: '#E24B4A',
  };

  constructor(
    private credenceService: CredenceService,
    private router: Router,
   private adminService:AdminService,
    private http: HttpClient,
  ) {}


  ngOnInit() {
    this.loadConfig();
  }
  ngAfterViewInit() {
    setTimeout(() => {
      if (this.scatterPoints.length > 0) {
        this.renderScatterChart();
      }
    }, 500);
  }

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
    if (this.snliProbChart) {
      this.snliProbChart.destroy();
      this.snliProbChart = null;
    }
    if (this.snliHeadsChart) {
      this.snliHeadsChart.destroy();
      this.snliHeadsChart = null;
    }
  }

  async loadConfig() {
  try {
    await this.adminService.loadConfig();
    
    const allModels = this.adminService.getModelList();
    this.encoderModels = allModels.filter((m) => m.info.type === 'encoder');
    this.llmModels = allModels.filter((m) => m.info.type === 'llm');
    this.filteredModels = [...this.encoderModels];
    this.selectedModel = this.filteredModels[0]?.key || '';
    
    this.datasets = this.adminService.getDatasetList();
    this.filteredDatasets = [...this.datasets];
    this.selectedDataset = this.datasets[0]?.key || '';
    
    this.tasksList = this.adminService.getTaskList();
    
    this.buildDatasetGroups();
    this.updateCurrentModelInfo();
    this.updateCurrentDatasetInfo();
    await this.loadAvailableHeads();  
    //console.log(' Configuration chargée avec succès !');
    //console.log(` ${this.encoderModels.length} encoders, ${this.llmModels.length} LLMs, ${this.datasets.length} datasets`);
  } catch (error) {
    console.error(' Erreur chargement configuration:', error);
    this.encoderModels = [];
    this.llmModels = [];
    this.datasets = [];
    this.tasksList = [];
  }
}
  
 setModelType(type: 'encoder' | 'llm') {
  this.modelType = type;
  this.filteredModels = type === 'encoder' ? [...this.encoderModels] : [...this.llmModels];
  if (this.filteredModels.length > 0) {
    this.selectedModel = this.filteredModels[0]?.key || '';
  }
  this.updateCurrentModelInfo();
  this.loadAvailableHeads();  
}

  onModelChange() {
  this.updateCurrentModelInfo();
  //console.log('Modèle sélectionné:', this.selectedModel);
  this.loadAvailableHeads(); 
}


  updateCurrentModelInfo() {
    this.currentModelInfo = this.adminService.getModel(this.selectedModel);
  }

  hasConcepts(): boolean {
    return !!(
      this.result &&
      this.result.concepts &&
      Object.keys(this.result.concepts).length > 0
    );
  }

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


  toggleModelDetails() {
    this.showModelDetails = !this.showModelDetails;
  }


buildDatasetGroups() {
  const groups: Map<string, { key: string; info: DatasetInfo }[]> = new Map();
  const datasetsToGroup = this.filteredDatasets.length > 0 ? this.filteredDatasets : this.datasets;

  for (const dataset of datasetsToGroup) {
    const task = dataset.info.task;
    if (!groups.has(task)) {
      groups.set(task, []);
    }
    groups.get(task)!.push(dataset);
  }
  const taskLabelMap = new Map<string, string>();
  this.tasksList.forEach(task => {
    taskLabelMap.set(task.key, `${task.info.icon} ${task.info.name}`);
  });

  this.datasetGroups = Array.from(groups.entries()).map(([task, datasets]) => ({
    label: taskLabelMap.get(task) || task, 
    datasets,
  }));
}

onDatasetChange() {
  this.updateCurrentDatasetInfo();  
  //console.log('Dataset sélectionné:', this.selectedDataset);
  this.loadAvailableHeads();
}


  updateCurrentDatasetInfo() {
    this.currentDatasetInfo = this.adminService.getDataset(
      this.selectedDataset,
    );
  }


async filterDatasetsByTask(taskKey: string) {
  this.selectedTask = taskKey;
  
  if (taskKey === 'all') {
    this.filteredDatasets = [...this.datasets];
    this.buildDatasetGroups();
    this.updateSelection();
    await this.loadAvailableHeads();
    return;
  }
  
  if (!this.tasksList || this.tasksList.length === 0) {
    //console.error('Liste des tâches non chargée');
    this.filteredDatasets = [];
    this.buildDatasetGroups();
    return;
  }
  
  try {
    const task = this.tasksList.find(t => t.key === taskKey);
    
    if (!task) {
      //console.error(`Tâche "${taskKey}" non trouvée dans la liste`);
      //console.log('Tâches disponibles:', this.tasksList.map(t => t.key));
      this.filteredDatasets = [];
      this.buildDatasetGroups();
      return;
    }
    const taskId = task.info.task_id;
    if (!taskId) {
      //console.error(`❌ La tâche "${taskKey}" n'a pas d'ID`);
      this.filteredDatasets = [];
      this.buildDatasetGroups();
      return;
    }
    //console.log(`🔍 Chargement des datasets pour "${taskKey}" (task_id: ${taskId})...`);
    const response = await this.adminService.getDatasetsByTask(taskId).toPromise();
    
    if (response && response.datasets) {
      this.filteredDatasets = Object.entries(response.datasets).map(([key, info]: [string, any]) => ({
        key,
        info: {
          ...info,
          task: taskKey,
          task_id: taskId
        }
      }));
      //console.log(`${this.filteredDatasets.length} datasets chargés`);
    } else {
      //console.warn(`Aucun dataset pour la tâche "${taskKey}"`);
      this.filteredDatasets = [];
    }
    this.buildDatasetGroups();
    this.updateSelection();
    await this.loadAvailableHeads();
    
  } catch (error) {
    //console.error('Erreur chargement datasets:', error);
    this.filteredDatasets = [];
    this.buildDatasetGroups();
  }
}

private updateSelection() {
  if (this.filteredDatasets.length > 0) {
    this.selectedDataset = this.filteredDatasets[0]?.key || '';
    this.updateCurrentDatasetInfo();
  } else {
    this.selectedDataset = '';
    this.currentDatasetInfo = null;
    this.availableHeads = [];
    this.noCheckpointAvailable = true;
  }
}

  

  resetFilter() {
    this.selectedTask = 'all';
    this.filteredDatasets = [...this.datasets];
    this.buildDatasetGroups();
  }


  toggleDatasetDetails() {
    this.showDatasetDetails = !this.showDatasetDetails;
  }


  getTaskColor(task: string): string {
    const colors: Record<string, string> = {
      sentiment: '#10b981',
      toxicity: '#ef4444',
      emotion: '#f59e0b',
      nli: '#3b82f6',
    };
    return colors[task] || '#6b7280';
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
    if (this.scatterPoints.length > 0) {
      this.refreshScatterRouting();
    }
  }

  onThresholdChange() {
    if (this.scatterPoints.length > 0) {
      this.refreshScatterRouting();
    }
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
  const isNLI = this.currentDatasetInfo?.task === 'nli' || 
                this.currentDatasetInfo?.task === 'natural_language_inference';

  if (isNLI && !this.validateNLIFormat(this.inputText)) {
    this.errorMessage = this.getNLIErrorMessage();
    this.isLoading = false;
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';
  this.result = null;

  this.credenceService
    .predict(
      this.inputText,
      this.selectedModel,
      this.selectedDataset,
      this.selectedNHeads,
    )
    .subscribe({
      next: (response) => {
        this.result = response;
        this.isLoading = false;
        this.saveAnalyse(response);

        setTimeout(() => this.addPointAndRender(response), 50);
        if (isNLI) {
          setTimeout(() => this.renderSnliProbabilities(response), 100);
          setTimeout(() => this.renderSnliHeadsChart(), 200);
        } else {
          setTimeout(() => this.renderConceptHistogram(), 100);
          setTimeout(() => this.renderEUCurve(), 150);
          setTimeout(() => this.renderHeadsPerConceptChart(), 150);
        }
      },
      error: (err) => {
        //console.error('API Error:', err);
        this.errorMessage = 'Error: ' + err.message;
        this.isLoading = false;
      },
    });
}

validateNLIFormat(text: string): boolean {
  if (!text.includes('[SEP]')) return false;
  const parts = text.split('[SEP]');
  return parts.length >= 2 && 
         parts[0].trim().length > 0 && 
         parts[1].trim().length > 0;
}

getNLIErrorMessage(): string {
  return `❌ Invalid format for ${this.currentDatasetInfo?.name || 'NLI dataset'}. 
Use: premise [SEP] hypothesis
Example: "A man is playing guitar [SEP] A person is performing music"`;
}

  getUncertainty(conceptKey: string): number {
    return this.result?.concept_uncertainties?.[conceptKey] ?? 0;
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
            borderRadius: 8,
          },
          {
            label: 'Aleatoric Uncertainty (AU)',
            data: auValues,
            backgroundColor: '#db2777',
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            title: { display: true, text: 'Uncertainty Value' },
          },
        },
      },
    });
  }


  refreshScatterRouting() {
    this.scatterPoints = this.scatterPoints.map((p) => ({
      ...p,
      routing: this.computeRouting(p.x, p.y),
    }));
    this.updateRoutingCounts();
    this.renderScatterChart();
  }


  updateRoutingCounts() {
    this.routingCounts = { TRUST: 0, DATA: 0, REVIEW: 0, ABSTAIN: 0 };
    this.scatterPoints.forEach((p) => this.routingCounts[p.routing]++);
  }



  getRoutingPercentage(decision: string): number {
    if (this.scatterPoints.length === 0) return 0;
    const count =
      this.routingCounts[decision as keyof typeof this.routingCounts];
    return Math.round((count / this.scatterPoints.length) * 100);
  }


  resetScatter() {
    this.scatterPoints = [];
    this.routingCounts = { TRUST: 0, DATA: 0, REVIEW: 0, ABSTAIN: 0 };
    if (this.scatterChart) {
      this.scatterChart.destroy();
      this.scatterChart = null;
    }
  }


  renderScatterChart() {
    const canvas = document.getElementById('scatterChart') as HTMLCanvasElement;
    if (!canvas) {
      //console.error('Canvas scatterChart not found');
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
        { x: 0.02, y: this.thresholdAle },
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
            min: 0,
            max: 0.02,
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
            min: 0,
            max: 1.05,
          },
        },
      },
    });

    /*console.log(
      'Scatter chart rendu avec',
      this.scatterPoints.length,
      'points',
    );*/
  }


  renderEUCurve() {
    if (!this.result || !this.result.concepts) return;

    const canvas = document.getElementById(
      'euAccuracyChart',
    ) as HTMLCanvasElement;
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
      const acc = this.result?.concepts?.[concept];
      if (acc !== undefined) accuracyValues.push(acc);
    });

    const points = euValues.map((eu, idx) => ({
      x: eu,
      y: accuracyValues[idx],
    }));

    this.euAccuracyChart = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Current Concepts',
            data: points,
            backgroundColor: '#3b82f6',
            pointRadius: 7,
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
            min: 0,
          },
          y: { title: { display: true, text: 'Accuracy' }, min: 0, max: 1 },
        },
      },
    });
  }


  renderHeadsPerConceptChart() {
    if (!this.hasConcepts() || !this.result?.heads_predictions) return;

    const canvas = document.getElementById(
      'headsPerConceptChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.headsPerConceptChart) {
      this.headsPerConceptChart.destroy();
      this.headsPerConceptChart = null;
    }

    const headNames = Object.keys(this.result.heads_predictions); 
    const conceptNames = Object.keys(
      this.result.heads_predictions[headNames[0]] ?? {},
    );
    const headColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#62d3ad'];

    const datasets = headNames.map((headName, idx) => {
      const headData = this.result!.heads_predictions![headName];

      const values = conceptNames.map((concept) => headData[concept] ?? 0);

      return {
        label: `Head ${idx}`,
        data: values,
        borderColor: headColors[idx % headColors.length],
        backgroundColor: headColors[idx % headColors.length] + '33',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 7,
        pointHoverRadius: 10,
        pointBackgroundColor: '#ffffff',
        pointBorderWidth: 2,
        fill: false,
      };
    });

    this.headsPerConceptChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: conceptNames.map((c) => c.charAt(0).toUpperCase() + c.slice(1)),
        datasets,
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
              label: (ctx) =>
                `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(4)}`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 1,
            title: { display: true, text: 'Predicted Probability' },
            ticks: { stepSize: 0.1 },
          },
          x: {
            title: { display: true, text: 'Concepts' },
          },
        },
      },
    });
  }


  renderSnliProbabilities(response: PredictionResult) {
    if (!response.probabilities) {
      //console.warn('No probabilities for SNLI');
      return;
    }

    const canvas = document.getElementById(
      'snliProbChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.snliProbChart) {
      this.snliProbChart.destroy();
      this.snliProbChart = null;
    }

    const probs = response.probabilities;
    const labels = ['Entailment', 'Neutral', 'Contradiction'];
    const values = [probs.entailment, probs.neutral, probs.contradiction];
    const colors = ['#10b981', '#f59e0b', '#ef4444'];

    this.snliProbChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Probability',
            data: values,
            backgroundColor: colors,
            borderRadius: 8,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `Probability: ${((ctx.raw as number) * 100).toFixed(1)}%`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            title: { display: true, text: 'Probability' },
            ticks: {
              callback: (value) => `${((value as number) * 100).toFixed(0)}%`,
            },
          },
        },
      },
    });
  }



  renderSnliHeadsChart() {
    if (!this.result?.heads_predictions) {
      //console.warn('heads_predictions not available for SNLI');
      return;
    }

    const canvas = document.getElementById(
      'snliHeadsChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.snliHeadsChart) {
      this.snliHeadsChart.destroy();
      this.snliHeadsChart = null;
    }

    const headNames = Object.keys(this.result.heads_predictions);
    const classLabels = ['entailment', 'neutral', 'contradiction'];
    const classDisplayNames = ['Entailment', 'Neutral', 'Contradiction'];

    const headColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#62d3ad'];

    const datasets = [];
    for (let i = 0; i < headNames.length; i++) {
      const headName = headNames[i];
      const headData = this.result.heads_predictions[headName];
      const classProbs = classLabels.map(
        (className) => headData[className] || 0,
      );

      datasets.push({
        label: `Head ${i}`,
        data: classProbs,
        borderColor: headColors[i % headColors.length],
        backgroundColor: headColors[i % headColors.length] + '33',
        borderWidth: 3,
        tension: 0.2,
        pointRadius: 7,
        pointHoverRadius: 10,
        pointBackgroundColor: '#ffffff',
        pointBorderWidth: 2,
        fill: false,
      });
    }

    this.snliHeadsChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: classDisplayNames,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'center',
            labels: {
              font: { size: 13, weight: 'bold' },
              usePointStyle: true,
              padding: 20,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const probability = (ctx.raw as number) * 100;
                return `${ctx.dataset.label}: ${probability.toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 1,
            title: { display: true, text: 'Probability' },
            ticks: {
              callback: (value) => `${((value as number) * 100).toFixed(0)}%`,
            },
          },
          x: {
            title: { display: true, text: 'NLI Classes' },
          },
        },
      },
    });
  }
  getTextareaPlaceholder(): string {
    if (this.selectedDataset === 'tid8') {
      return 'Enter premise [SEP] hypothesis \nExample: A man is playing guitar [SEP] A person is performing music';
    }
    return 'Enter your text here for analysis...';
  }
  validateTid8Format(text: string): boolean {
    return text.includes('[SEP]');
  }
  async loadAvailableHeads() {
  try {
    //console.log(`Recherche des heads disponibles pour ${this.selectedModel} + ${this.selectedDataset}...`);
    
    const heads = await this.adminService.getAvailableHeads(
      this.selectedModel,
      this.selectedDataset
    );
    
    this.availableHeads = heads.sort((a, b) => a - b);
    this.noCheckpointAvailable = this.availableHeads.length === 0;
    
    if (this.availableHeads.includes(5)) {
      this.selectedNHeads = 5;
    } else if (this.availableHeads.length > 0) {
      this.selectedNHeads = this.availableHeads[0];
    }
    
    //console.log(` ${this.availableHeads.length} heads disponibles:`, this.availableHeads);
    
  } catch (error) {
   // console.error(' Erreur chargement heads:', error);
    this.availableHeads = [];
    this.noCheckpointAvailable = true;
  }
}
  
 saveAnalyse(response: PredictionResult) {
  const payload = {
    text: this.inputText,
    encoder: this.selectedModel,
    dataset: this.selectedDataset,
    n_heads: this.selectedNHeads,
    mode: this.mode,
    threshold_epi: this.thresholdEpi,
    threshold_ale: this.thresholdAle,
    routing_decision: this.routingDecision,
    prediction_label: response.prediction,
    confidence: response.confidence,
    epistemic: response.epistemic,
    aleatoric: response.aleatoric || 0,
    probabilities: response.probabilities || null,
    heads_predictions: response.heads_predictions || null,
    concepts: response.concepts || null,
    concept_uncertainties: response.concept_uncertainties || null,
    aleatoric_by_concept: response.aleatoric_by_concept || null,
  };

  this.http.post(`${environment.apiUrl}/analyse/save`, payload)
    .subscribe({
      next: (result: any) => {
        //console.log(` Analyse sauvegardée (ID: ${result.analyse_id})`);
      },
      error: (err: any) => {
        //console.error(' Erreur sauvegarde:', err);
      }
    });
}
}
