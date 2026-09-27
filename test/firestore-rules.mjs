/**
 * Le regole di Firestore, provate davvero.
 *
 * I test dell'app girano con una finta Firestore che le regole non le legge
 * nemmeno: un permesso sbagliato li passerebbe tutti. Qui invece parte
 * l'emulatore vero, carica firestore.rules e ci si presenta davanti come un
 * estraneo, come un coach e come un cliente.
 *
 *   npm run test:rules        (serve Java, che l'emulatore si porta dietro)
 *
 * Non e' ancora agganciato alla CI: per ora si lancia a mano, e va lanciato
 * ogni volta che firestore.rules cambia.
 */
import { initializeTestEnvironment, assertFails, assertSucceeds }
  from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'prova-regole',
  firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('/home/user/imperial-gym-app/firestore.rules', 'utf8') }
});

const COACH = 'coach-1', ALTRO_COACH = 'coach-2', CLIENTE = 'cliente-1', ESTRANEO = 'cliente-2';

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users', COACH), { uid: COACH, role: 'coach', coachId: null, pairingCode: 'AB12CD' });
  await setDoc(doc(db, 'users', ALTRO_COACH), { uid: ALTRO_COACH, role: 'coach', coachId: null, pairingCode: 'ZZ99ZZ' });
  await setDoc(doc(db, 'users', CLIENTE), { uid: CLIENTE, role: 'client', coachId: COACH });
  await setDoc(doc(db, 'users', ESTRANEO), { uid: ESTRANEO, role: 'client', coachId: ALTRO_COACH });
  await setDoc(doc(db, 'users', CLIENTE, 'measurements', 'm1'), { peso: 80 });
  await setDoc(doc(db, 'users', CLIENTE, 'sessions', 's1'), { dayId: 'day1' });
  await setDoc(doc(db, 'coachCodes', 'AB12CD'), { coachId: COACH });
  await setDoc(doc(db, 'coachCodes', 'ZZ99ZZ'), { coachId: ALTRO_COACH });
});

const anonimo = env.unauthenticatedContext().firestore();
const coach = env.authenticatedContext(COACH).firestore();
const altro = env.authenticatedContext(ALTRO_COACH).firestore();
const cliente = env.authenticatedContext(CLIENTE).firestore();

let ko = 0;
const prova = async (nome, p) => {
  try { await p; console.log('  ok   ', nome); }
  catch (e) { ko++; console.log('  KO   ', nome, '->', e.message.slice(0, 90)); }
};

console.log('\n— i codici coach —');
await prova('un estraneo legge UN codice preciso (serve a iscriversi)',
  assertSucceeds(getDoc(doc(anonimo, 'coachCodes', 'AB12CD'))));
await prova('un estraneo NON puo\' elencarli tutti',
  assertFails(getDocs(collection(anonimo, 'coachCodes'))));
await prova('nemmeno un utente collegato puo\' elencarli',
  assertFails(getDocs(collection(cliente, 'coachCodes'))));

console.log('\n— il coach e i suoi clienti —');
await prova('legge le misurazioni del proprio cliente',
  assertSucceeds(getDocs(collection(coach, 'users', CLIENTE, 'measurements'))));
await prova('cancella le misurazioni del proprio cliente',
  assertSucceeds(deleteDoc(doc(coach, 'users', CLIENTE, 'measurements', 'm1'))));
await prova('cancella le sedute del proprio cliente',
  assertSucceeds(deleteDoc(doc(coach, 'users', CLIENTE, 'sessions', 's1'))));
await prova('cancella il profilo del proprio cliente',
  assertSucceeds(deleteDoc(doc(coach, 'users', CLIENTE))));

console.log('\n— quello che il coach NON puo\' fare —');
await prova('non legge i dati del cliente di un altro coach',
  assertFails(getDocs(collection(coach, 'users', ESTRANEO, 'measurements'))));
await prova('non cancella il cliente di un altro coach',
  assertFails(deleteDoc(doc(coach, 'users', ESTRANEO))));
await prova('non cancella un altro coach',
  assertFails(deleteDoc(doc(coach, 'users', ALTRO_COACH))));
await prova('non si porta via il codice di un altro coach',
  assertFails(deleteDoc(doc(coach, 'coachCodes', 'ZZ99ZZ'))));
await prova('si porta via il PROPRIO codice',
  assertSucceeds(deleteDoc(doc(coach, 'coachCodes', 'AB12CD'))));

console.log('\n— quello che un cliente NON puo\' fare —');
await prova('non cancella il profilo di un altro cliente',
  assertFails(deleteDoc(doc(cliente, 'users', ESTRANEO))));
await prova('non legge le misurazioni di un altro cliente',
  assertFails(getDocs(collection(cliente, 'users', ESTRANEO, 'measurements'))));
await prova('cancella il PROPRIO profilo',
  assertSucceeds(deleteDoc(doc(altro, 'users', ALTRO_COACH))));

console.log('\n— l\'informativa —');
const NUOVO = 'cliente-nuovo';
const nuovo = env.authenticatedContext(NUOVO).firestore();
const profiloBase = { uid: NUOVO, role: 'client', coachId: COACH, email: 'n@e.com' };
await prova('non si crea un profilo senza accettazione',
  assertFails(setDoc(doc(nuovo, 'users', NUOVO), profiloBase)));
await prova('nemmeno con la sola data, senza la versione',
  assertFails(setDoc(doc(nuovo, 'users', NUOVO), { ...profiloBase, privacyAcceptedAt: '2026-09-27T00:00:00.000Z' })));
await prova('con data e versione si crea',
  assertSucceeds(setDoc(doc(nuovo, 'users', NUOVO), {
    ...profiloBase, privacyAcceptedAt: '2026-09-27T00:00:00.000Z', privacyVersion: '2026-09-27'
  })));

console.log('\n— i campi che uno cambia di suo —');
const io = env.authenticatedContext(ESTRANEO).firestore();
await prova('cambia nome, cognome e nome intero',
  assertSucceeds(updateDoc(doc(io, 'users', ESTRANEO), { firstName: 'Anna', lastName: 'Rossi', displayName: 'Anna Rossi' })));
await prova('cambia data di nascita e sesso',
  assertSucceeds(updateDoc(doc(io, 'users', ESTRANEO), { birthDate: '1994-05-01', sex: 'f' })));
await prova('NON puo\' svuotare il nome intero',
  assertFails(updateDoc(doc(io, 'users', ESTRANEO), { displayName: '' })));
await prova('NON puo\' cambiarsi il ruolo',
  assertFails(updateDoc(doc(io, 'users', ESTRANEO), { role: 'coach' })));
await prova('NON puo\' cambiarsi il coach',
  assertFails(updateDoc(doc(io, 'users', ESTRANEO), { coachId: COACH })));
await prova('NON puo\' riscrivere quando ha accettato l\'informativa',
  assertFails(updateDoc(doc(io, 'users', ESTRANEO), { privacyAcceptedAt: '2030-01-01T00:00:00.000Z' })));

await env.cleanup();
console.log(ko === 0 ? '\nTUTTO COME DEVE ESSERE' : `\n${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
