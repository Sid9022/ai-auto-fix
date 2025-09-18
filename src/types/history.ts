export interface DiagnosticHistory {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  description: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  predicted_fault: string;
  confidence: number;
  severity: string;
  explanation: string;
  recommended_actions: string[];
  alternatives?: any;
  pdf_content?: string;
  model_used: string;
  analysis_duration?: number;
  expires_at: string;
  is_favorite: boolean;
}

export interface CreateHistoryEntry {
  description: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  predicted_fault: string;
  confidence: number;
  severity: string;
  explanation: string;
  recommended_actions: string[];
  alternatives?: any;
  pdf_content?: string;
  model_used?: string;
  analysis_duration?: number;
}