
export type Goal = 'lose' | 'maintain';
export type DietaryPreference = 'vegetarian' | 'non-vegetarian' | 'none';

export interface UserProfile {
  age: number;
  height: number; // in cm
  weight: number; // in kg
  goal: Goal;
  dietaryPreference: DietaryPreference;
  dailyTarget: number;
  setupComplete: boolean;
}

export interface ActivityEntry {
  id: string;
  type: 'intake' | 'exercise';
  calories: number;
  timestamp: number;
  description: string;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  intake: number;
  burned: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
