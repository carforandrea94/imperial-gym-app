export type UserRole = 'coach' | 'client';

/**
 * Sesso biologico. Due soli valori perche' e' l'ingresso delle formule di
 * composizione corporea (Jackson-Pollock sulle pliche, Deurenberg), che hanno
 * un coefficiente per l'uno e uno per l'altro e non sanno farne altri. Non
 * entra invece nel BMI, che e' peso diviso altezza al quadrato per chiunque.
 */
export type Sex = 'm' | 'f';

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
  /** Assente sui profili creati prima del campo, null se non l'ha scelto. */
  sex?: Sex | null;
  /** Data di nascita ISO yyyy-mm-dd. Serve all'eta', che e' un ingresso delle
   *  formule di composizione corporea. Assente sui profili creati prima. */
  birthDate?: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  coachId: string;
  text: string;
  createdAt: string;
}
