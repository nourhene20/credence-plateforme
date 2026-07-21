export interface Task {
  task_id?: number;
  name: string;
  icon: string;
}
export type TaskInfo = Task;

export interface Model {
  model_id?: number;
  name: string;
  description: string;
  params: string;
  speed: 'fast' | 'medium' | 'slow';
  type: 'encoder' | 'llm';
  hugging_face_id: string;
}
export type ModelInfo = Model;

export interface Dataset {
  dataset_id?: number;
  name: string;
  description: string;
  icon: string;
  num_classes: number;
  has_concepts: boolean;
  task_id: number;
  task_name?: string;  
  class_names?: string[];
  concept_names?: string[];
  task:string
}
export type DatasetInfo = Dataset;

export interface Checkpoint {
  checkpoint_id?: number;
  model_id: number;
  dataset_id: number;
  n_heads: number;
  repo_id: string;
}

export interface PredictionResult {
  prediction: string;
  confidence: number;
  epistemic: number;
  aleatoric: number;
  
  
  aleatoric_by_concept?: { food: number; service: number; ambiance: number; noise: number; };
  concepts?: Record<string, number>;
  concept_uncertainties?: Record<string, number>;
  heads_predictions?: Record<string, Record<string, number>>;
  
  
  probabilities?: {
    entailment: number;
    neutral: number;
    contradiction: number;
  };
}

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
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}