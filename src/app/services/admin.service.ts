import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Task {
  task_id?: number;
  name: string;
  icon: string;
}

export interface Model {
  model_id?: number;
  name: string;
  description: string;
  params: string;
  speed: 'fast' | 'medium' | 'slow';
  type: 'encoder' | 'llm';
  hugging_face_id: string;
}

export interface Dataset {
  dataset_id?: number;
  name: string;
  description: string;
  icon: string;
  num_classes: number;
  has_concepts: boolean;
  task_id: number;
  task_name: string;
}

export interface Checkpoint {
  checkpoint_id?: number;
  model_id: number;
  dataset_id: number;
  n_heads: number;
  repo_id: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ─── TASKS ────────────────────────────────────────────────────
  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/admin/tasks`);
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

  // ─── MODELS ────────────────────────────────────────────────────
  getModels(): Observable<Model[]> {
    return this.http.get<Model[]>(`${this.apiUrl}/admin/models`);
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

  // ─── DATASETS ──────────────────────────────────────────────────
  getDatasets(): Observable<Dataset[]> {
    return this.http.get<Dataset[]>(`${this.apiUrl}/admin/datasets`);
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

  // ─── DATASET CLASSES ──────────────────────────────────────────
  getDatasetClasses(datasetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/datasets/${datasetId}/classes`);
  }
  addDatasetClass(datasetId: number, cls: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/datasets/${datasetId}/classes`, cls);
  }
  deleteDatasetClass(classId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/dataset-classes/${classId}`);
  }

  // ─── DATASET CONCEPTS ──────────────────────────────────────────
  getDatasetConcepts(datasetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/datasets/${datasetId}/concepts`);
  }
  addDatasetConcept(datasetId: number, concept: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/datasets/${datasetId}/concepts`, concept);
  }
  deleteDatasetConcept(conceptId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/dataset-concepts/${conceptId}`);
  }

  // ─── CHECKPOINTS ──────────────────────────────────────────────
  getCheckpoints(): Observable<Checkpoint[]> {
    return this.http.get<Checkpoint[]>(`${this.apiUrl}/admin/checkpoints`);
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
}