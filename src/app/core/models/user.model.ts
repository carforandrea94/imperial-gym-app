export type UserRole = 'coach' | 'client';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  pairingCode: string;
  /** Solo per i client: uid del coach a cui sono associati. */
  coachId: string | null;
  /** Solo per i client: true dopo il primo accesso completato con successo (email+password+codice). */
  paired: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  coachId: string;
  text: string;
  createdAt: string;
}
