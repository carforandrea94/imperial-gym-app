import { Day, WeekPlan } from './workout.model';
import { Diet } from './diet.model';
import { todayLocalISO } from '../core/utils/date.util';

export type ProtocolStatus = 'draft' | 'active' | 'archived';
export type ProtocolSource = 'manual' | 'pdf';

export interface WorkoutProtocol {
  weekPlan: WeekPlan[];
  days: Day[];
  programStart: string; // ISO yyyy-mm-dd, inizio del programma per il calcolo automatico della settimana
}

export interface Protocol {
  id: string;
  clientId: string;
  coachId: string;
  name: string;
  status: ProtocolStatus;
  source: ProtocolSource;
  workout: WorkoutProtocol;
  diet: Diet;
  infoNote: string;
  createdAt: string;
  updatedAt: string;
}

export function emptyWorkoutProtocol(): WorkoutProtocol {
  return {
    weekPlan: Array.from({ length: 8 }, () => ({ sets: 4, reps: 10 })),
    days: [],
    programStart: todayLocalISO()
  };
}

export function emptyDiet(): Diet {
  return [];
}

export function emptyProtocol(clientId: string, coachId: string): Omit<Protocol, 'id'> {
  const now = new Date().toISOString();
  return {
    clientId,
    coachId,
    name: 'Nuovo protocollo',
    status: 'draft',
    source: 'manual',
    workout: emptyWorkoutProtocol(),
    diet: emptyDiet(),
    infoNote: '',
    createdAt: now,
    updatedAt: now
  };
}
