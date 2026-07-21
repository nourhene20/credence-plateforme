import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Task, Model, Dataset, Checkpoint,
  ModelInfo, DatasetInfo, TaskInfo 
} from '../shared/models_interfaces';

interface ConfigCache {
  tasks: { key: string; info: TaskInfo }[];
  models: { key: string; info: ModelInfo }[];
  datasets: { key: string; info: DatasetInfo }[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private apiUrl = environment.apiUrl;

  private configSubject = new BehaviorSubject<ConfigCache | null>(null);
  config$ = this.configSubject.asObservable();
  
  private configLoaded = false;

  constructor(private http: HttpClient) {}

  async loadConfig(forceRefresh: boolean = false): Promise<void> {
    if (this.configLoaded && !forceRefresh) {
      //console.log(' Utilisation du cache');
      return;
    }

    //console.log('Chargement depuis l\'API...');
    
    try {
      const config = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/data/all`)
      );

      const cache: ConfigCache = {
        tasks: (config.tasks || []).map((t: any) => ({
          key: this.getTaskKey(t.name),
          info: { name: t.name, icon: t.icon, task_id: t.task_id }
        })),
        models: (config.models || []).map((m: any) => ({
          key: m.hugging_face_id,
          info: {
            name: m.name,
            description: m.description,
            params: m.params,
            speed: m.speed,
            type: m.type,
            model_id: m.model_id,
            hugging_face_id: m.hugging_face_id
          }
        })),
        datasets: (config.datasets || []).map((d: any) => {
          const taskName = config.tasks?.find((t: any) => t.task_id === d.task_id)?.name || '';
          return {
            key: d.name.toLowerCase().replace(/ /g, '_').replace(/-/g, ''),
            info: {
              name: d.name,
              description: d.description,
              icon: d.icon,
              task: this.getTaskKey(taskName),
              num_classes: d.num_classes,
              class_names: d.classes?.map((c: any) => c.label_name) || [],
              has_concepts: d.has_concepts,
              concept_names: d.concepts?.map((c: any) => c.concept_name) || [],
              task_id: d.task_id,
              dataset_id: d.dataset_id
            }
          };
        })
      };

      this.configSubject.next(cache);
      this.configLoaded = true;
      //console.log(`Chargé : ${cache.models.length} modèles, ${cache.datasets.length} datasets`);
      
    } catch (error) {
      //console.error(' Erreur:', error);
      throw error;
    }
  }

  private getTaskKey(name: string): string {
    const mapping: Record<string, string> = {
      'natural_language_inference': 'nli',
      'toxicity_detection': 'toxicity',
      'emotion_recognition': 'emotion',
      'sentiment_analysis': 'sentiment'
    };
    const key = name.toLowerCase().replace(/ /g, '_');
    return mapping[key] || key;
  }


  getModelList(): { key: string; info: ModelInfo }[] {
    return this.configSubject.value?.models || [];
  }

  getModel(key: string): ModelInfo | null {
    return this.configSubject.value?.models?.find(m => m.key === key)?.info || null;
  }

  getDatasetList(): { key: string; info: DatasetInfo }[] {
    return this.configSubject.value?.datasets || [];
  }

  getDataset(key: string): DatasetInfo | null {
    return this.configSubject.value?.datasets?.find(d => d.key === key)?.info || null;
  }

  getTaskList(): { key: string; info: TaskInfo }[] {
    return this.configSubject.value?.tasks || [];
  }

  async getAvailableHeads(encoder: string, dataset: string): Promise<number[]> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ heads: number[] }>(`${this.apiUrl}/data/available-heads`, {
          params: { encoder, dataset }
        })
      );
      return result.heads || [];
    } catch (error) {
      //console.error('❌ Erreur heads:', error);
      return [];
    }
  }


  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/data/tasks`);
  }

  createTask(task: Task): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/admin/tasks`, task);
  }

  updateTask(taskId: number, task: Partial<Task>): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/admin/tasks/${taskId}`, task);
  }

  deleteTask(taskId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/tasks/${taskId}`);
  }


  getModels(): Observable<Model[]> {
    return this.http.get<Model[]>(`${this.apiUrl}/data/models`);
  }

  createModel(model: Model): Observable<Model> {
    return this.http.post<Model>(`${this.apiUrl}/admin/models`, model);
  }

  updateModel(modelId: number, model: Partial<Model>): Observable<Model> {
    return this.http.put<Model>(`${this.apiUrl}/admin/models/${modelId}`, model);
  }

  deleteModel(modelId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/models/${modelId}`);
  }

  getDatasets(): Observable<Dataset[]> {
    return this.http.get<Dataset[]>(`${this.apiUrl}/data/datasets`);
  }

  createDataset(dataset: Dataset): Observable<Dataset> {
    return this.http.post<Dataset>(`${this.apiUrl}/admin/datasets`, dataset);
  }

  updateDataset(datasetId: number, dataset: Partial<Dataset>): Observable<Dataset> {
    return this.http.put<Dataset>(`${this.apiUrl}/admin/datasets/${datasetId}`, dataset);
  }

  deleteDataset(datasetId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/datasets/${datasetId}`);
  }

  getDatasetClasses(datasetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/data/datasets/${datasetId}/classes`);
  }

  addDatasetClass(datasetId: number, cls: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/datasets/${datasetId}/classes`, cls);
  }

  deleteDatasetClass(classId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/dataset-classes/${classId}`);
  }

  getDatasetConcepts(datasetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/data/datasets/${datasetId}/concepts`);
  }

  addDatasetConcept(datasetId: number, concept: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/datasets/${datasetId}/concepts`, concept);
  }

  deleteDatasetConcept(conceptId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/dataset-concepts/${conceptId}`);
  }



  getCheckpoints(): Observable<Checkpoint[]> {
    return this.http.get<Checkpoint[]>(`${this.apiUrl}/data/checkpoints`);
  }

  createCheckpoint(checkpoint: Checkpoint): Observable<Checkpoint> {
    return this.http.post<Checkpoint>(`${this.apiUrl}/admin/checkpoints`, checkpoint);
  }

  updateCheckpoint(checkpointId: number, checkpoint: Partial<Checkpoint>): Observable<Checkpoint> {
    return this.http.put<Checkpoint>(`${this.apiUrl}/admin/checkpoints/${checkpointId}`, checkpoint);
  }

  deleteCheckpoint(checkpointId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/checkpoints/${checkpointId}`);
  }


  getModelName(modelId: number): string {
    const model = this.configSubject.value?.models?.find(m => m.info.model_id === modelId);
    return model?.info?.name || 'N/A';
  }

  getDatasetName(datasetId: number): string {
    const dataset = this.configSubject.value?.datasets?.find(d => d.info.dataset_id === datasetId);
    return dataset?.info?.name || 'N/A';
  }

  getTaskName(taskId: number): string {
    const task = this.configSubject.value?.tasks?.find(t => t.info.task_id === taskId);
    return task?.info?.name || 'N/A';
  }

  refreshConfig(): void {
    this.configLoaded = false;
    this.configSubject.next(null);
    this.loadConfig(true);
  }
  getDatasetsByTask(taskId: number): Observable<any> {
  return this.http.get(`${this.apiUrl}/data/datasets/by-task/${taskId}`);
}
}