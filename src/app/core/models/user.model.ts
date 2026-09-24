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
  /**
   * Altezza in centimetri. Sta sul profilo e non fra le misurazioni perche' si
   * misura una volta e resta: in `MeasurementEntry` l'app la richiederebbe a
   * ogni rilevazione, accanto a peso e pliche, che invece cambiano ogni volta.
   *
   * Assente sui profili creati prima che il campo esistesse, e null quando
   * l'utente non l'ha ancora messa: chi la legge deve reggere entrambi.
   */
  heightCm?: number | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  coachId: string;
  text: string;
  createdAt: string;
}
