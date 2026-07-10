import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ModelInfo {
  name: string;
  description: string;
  params: string;
  speed: string;
  type: 'encoder' | 'llm';
  model_id?: number;
  hugging_face_id?: string;
}

export interface DatasetInfo {
  name: string;
  description: string;
  icon: string;
  task: string;
  num_classes: number;
  class_names: string[];
  has_concepts: boolean;
  concept_names: string[];
  task_id?: number;
  dataset_id?: number;
}

export interface TaskInfo {
  name: string;
  icon: string;
  task_id?: number;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private apiUrl = environment.apiUrl;
  private config: any = null;

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    try {
      console.log(' Chargement de la configuration depuis la base de données...');
      this.config = await firstValueFrom(
        this.http.get(`${this.apiUrl}/config/all`)
      );
      console.log(' Configuration chargée depuis la base de données');
      console.log(` ${Object.keys(this.config.models).length} modèles, ${Object.keys(this.config.datasets).length} datasets, ${Object.keys(this.config.tasks).length} tâches`);
    } catch (error) {
      console.error(' Erreur chargement configuration depuis la base:', error);
    }
  }


  getModelList(): { key: string; info: ModelInfo }[] {
    if (!this.config?.models) return [];
    return Object.entries(this.config.models).map(([key, info]: any) => ({
      key,
      info: info as ModelInfo,
    }));
  }

  
  getModel(key: string): ModelInfo | null {
    return this.config?.models?.[key] || null;
  }

 
  getDatasetList(): { key: string; info: DatasetInfo }[] {
    if (!this.config?.datasets) return [];
    return Object.entries(this.config.datasets).map(([key, info]: any) => ({
      key,
      info: info as DatasetInfo,
    }));
  }

 
  getDataset(key: string): DatasetInfo | null {
    return this.config?.datasets?.[key] || null;
  }


  getTaskList(): { key: string; info: TaskInfo }[] {
    if (!this.config?.tasks) return [];
    return Object.entries(this.config.tasks).map(([key, info]: any) => ({
      key,
      info: info as TaskInfo,
    }));
  }

  async getAvailableHeads(encoder: string, dataset: string): Promise<number[]> {
  try {
    const result = await firstValueFrom(
      this.http.get(`${this.apiUrl}/config/available-heads`, {
        params: { encoder, dataset }
      })
    );
    return (result as any).heads || [];
  } catch (error) {
    console.error(' Erreur chargement heads:', error);
    return [];
  }
}
}