import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ModelInfo {
  name: string;
  description: string;
  params: string;
  speed: string;
  type: 'encoder' | 'llm';
  hidden_size?: number;
  max_length?: number;
  recommended_for: string[];
  huggingface_id?: string;
}

export interface DatasetInfo {
  name: string;
  description: string;
  icon: string;
  task: string;
  num_classes: number;
  class_names: string[];
  has_concepts: boolean;
  num_concepts: number;
  concept_names: string[];
  has_multi_annotator: boolean;
  train_size: number;
  val_size: number;
  test_size: number;
  language: string;
  source: string;
  year: number;
  sample: string;
}

export interface TaskInfo {
  name: string;
  icon: string;
  color: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: any = null;

  constructor(private http: HttpClient) {}

  async loadConfig() {
    if (this.config) return this.config;
    try {
      this.config = await firstValueFrom(
        this.http.get('/assets/config/datasets-models.json')
      );
    } catch (error) {
      console.error('Could not load config file, using defaults');
      this.config = this.getDefaultConfig();
    }
    return this.config;
  }

  private getDefaultConfig() {
    return {
      models: {
        'distilbert-base-uncased': {
          name: 'DistilBERT Base',
          description: 'Version distillée de BERT, 40% plus légère et 60% plus rapide.',
          params: '66M',
          speed: '⚡ Très rapide',
          type: 'encoder',
          recommended_for: ['sentiment', 'toxicity']
        },
        'bert-base-uncased': {
          name: 'BERT Base',
          description: 'Modèle transformer original de Google.',
          params: '110M',
          speed: '🚀 Rapide',
          type: 'encoder',
          recommended_for: ['sentiment', 'toxicity', 'emotion', 'nli']
        },
        'roberta-base': {
          name: 'RoBERTa Base',
          description: 'Optimisation de BERT avec plus de données.',
          params: '125M',
          speed: '🚀 Rapide',
          type: 'encoder',
          recommended_for: ['sentiment', 'toxicity', 'emotion', 'nli']
        },
        'answerdotai/ModernBERT-base': {
          name: 'ModernBERT Base',
          description: 'Dernier modèle encoder SOTA avec contexte de 8192 tokens.',
          params: '139M',
          speed: '⚡ Très rapide',
          type: 'encoder',
          recommended_for: ['sentiment', 'toxicity', 'emotion', 'nli']
        },
        'meta-llama/Llama-3.2-3B': {
          name: 'Llama 3.2 3B',
          description: 'LLM efficace de Meta avec bon compromis performance/taille.',
          params: '3B',
          speed: '🚀 Rapide',
          type: 'llm',
          recommended_for: ['sentiment', 'toxicity', 'nli']
        },
        'Qwen/Qwen2.5-3B': {
          name: 'Qwen 2.5 3B',
          description: 'LLM multilingue efficace d\'Alibaba.',
          params: '3B',
          speed: '🚀 Rapide',
          type: 'llm',
          recommended_for: ['sentiment', 'toxicity', 'nli']
        }
      },
      datasets: {
        'cebab': {
          name: 'CEBaB',
          description: 'Critiques de restaurants avec annotations multi-aspects.',
          icon: '🍽️',
          task: 'sentiment',
          num_classes: 3,
          class_names: ['negative', 'neutral', 'positive'],
          has_concepts: true,
          num_concepts: 4,
          concept_names: ['food', 'service', 'ambiance', 'noise'],
          has_multi_annotator: true,
          train_size: 11967,
          val_size: 1000,
          test_size: 1000,
          language: 'en',
          source: 'CEBaB/CEBaB',
          year: 2022,
          sample: 'The food was amazing but the service was slow.'
        },
        'sst2': {
          name: 'SST-2',
          description: 'Stanford Sentiment Treebank binaire.',
          icon: '🎬',
          task: 'sentiment',
          num_classes: 2,
          class_names: ['negative', 'positive'],
          has_concepts: false,
          num_concepts: 0,
          concept_names: [],
          has_multi_annotator: false,
          train_size: 67349,
          val_size: 872,
          test_size: 1821,
          language: 'en',
          source: 'glue/sst2',
          year: 2013,
          sample: 'A brilliant and moving film.'
        }
      },
      tasks: {
        'sentiment': { name: 'Sentiment Analysis', icon: '😊', color: '#10b981', description: '' },
        'toxicity': { name: 'Toxicity Detection', icon: '⚠️', color: '#ef4444', description: '' },
        'emotion': { name: 'Emotion Recognition', icon: '😢', color: '#f59e0b', description: '' },
        'nli': { name: 'Natural Language Inference', icon: '🔍', color: '#3b82f6', description: '' }
      }
    };
  }

  getModel(modelKey: string): ModelInfo | null {
    return this.config?.models[modelKey] || null;
  }

  getModelList(): { key: string; info: ModelInfo }[] {
    if (!this.config) return [];
    return Object.entries(this.config.models).map(([key, info]) => ({ key, info: info as ModelInfo }));
  }

  getDataset(datasetKey: string): DatasetInfo | null {
    return this.config?.datasets[datasetKey] || null;
  }

  getDatasetList(): { key: string; info: DatasetInfo }[] {
    if (!this.config) return [];
    return Object.entries(this.config.datasets).map(([key, info]) => ({ key, info: info as DatasetInfo }));
  }

  getTaskList(): { key: string; info: TaskInfo }[] {
    if (!this.config) return [];
    return Object.entries(this.config.tasks).map(([key, info]) => ({ key, info: info as TaskInfo }));
  }
}