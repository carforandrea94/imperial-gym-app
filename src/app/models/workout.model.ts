export interface MuscleInfo {
  color: string;
  dim: string;
}

export interface Exercise {
  name: string;
  scheme: 'wave' | 'plain';
  sets: number;
  muscle: string;
  text?: string;
  reps?: (number | string)[];
  note?: string;
  /** Solo per scheme 'wave': progressione settimanale specifica di questo esercizio. */
  weekPlan?: WeekPlan[];
}

export interface Day {
  id: string;
  label: string;
  rec: string;
  ex: Exercise[];
}

export interface WeekPlan {
  sets: number;
  reps: number;
}

export interface ExerciseState {
  loads: (string | null)[];
  reps: (string | null)[];
  done: boolean[];
}

export interface WorkoutSession {
  dayId: string;
  dayLabel: string;
  date: string;
  exercises: {
    name: string;
    sets: { load: string | null; reps: string | null; done: boolean }[];
  }[];
}

export interface ExInsight {
  lastText: string;
  sparkSvg: string | null;
  delta: string | null;
  deltaClass: string;
  suggestion: string | null;
}
