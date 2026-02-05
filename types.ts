
export enum ModuleId {
  TryOnClothing = 'TryOnClothing',
  TryOnEarrings = 'TryOnEarrings',
  HairstyleRef = 'HairstyleRef',
  BeautyScore = 'BeautyScore',
  CoupleMatch = 'CoupleMatch',
  TongueDiag = 'TongueDiag',
  FacialColor = 'FacialColor',
  Physiognomy = 'Physiognomy'
}

export interface ModuleConfig {
  id: ModuleId;
  title: string;
  icon: string;
  description: string;
  color: string;
}

export interface AnalysisResult {
  score?: number;
  content: string;
  title?: string;
  advice?: string[];
}

export interface User {
  id: string;
  nickname: string;
  created_at: string;
  last_login: string;
  credits: number;
  is_admin: boolean;
  device_id?: string;
  referred_by?: string;
}
