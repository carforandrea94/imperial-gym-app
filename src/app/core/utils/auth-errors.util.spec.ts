import { loginErrorMessage, resetErrorMessage, deleteAccountErrorMessage, RESET_SENT_MESSAGE } from './auth-errors.util';

describe('loginErrorMessage', () => {
  /* Firebase non distingue fra utente inesistente e password sbagliata, e
     l'app non deve inventare la distinzione: direbbe a chiunque quali
     indirizzi sono registrati. */
  it('non dice se e\' l\'email o la password a essere sbagliata', () => {
    const atteso = 'Email o password non corrette.';
    expect(loginErrorMessage({ code: 'auth/invalid-credential' })).toBe(atteso);
    expect(loginErrorMessage({ code: 'auth/wrong-password' })).toBe(atteso);
    expect(loginErrorMessage({ code: 'auth/user-not-found' })).toBe(atteso);
  });

  it('il timeout ha la precedenza sul codice', () => {
    expect(loginErrorMessage({ message: 'TIMEOUT', code: 'auth/invalid-email' }))
      .toContain('troppo tempo');
  });

  it('senza rete lo dice', () => {
    expect(loginErrorMessage({ code: 'auth/network-request-failed' })).toContain('connessione');
  });

  it('troppi tentativi', () => {
    expect(loginErrorMessage({ code: 'auth/too-many-requests' })).toContain('Troppi tentativi');
  });

  it('un account disattivato manda dal coach', () => {
    expect(loginErrorMessage({ code: 'auth/user-disabled' })).toContain('coach');
  });

  it('un codice che non conosce non lascia la pagina muta', () => {
    expect(loginErrorMessage({ code: 'auth/boh' })).toBeTruthy();
    expect(loginErrorMessage(null)).toBeTruthy();
  });

  // Un codice Firebase grezzo in faccia all'utente non spiega niente.
  it('non mostra mai il codice', () => {
    expect(loginErrorMessage({ code: 'auth/invalid-credential' })).not.toContain('auth/');
  });
});

describe('resetErrorMessage', () => {
  it('email non valida', () => {
    expect(resetErrorMessage({ code: 'auth/invalid-email' })).toBe('Email non valida.');
  });

  it('troppe richieste', () => {
    expect(resetErrorMessage({ code: 'auth/too-many-requests' })).toContain('Troppe richieste');
  });

  it('un errore sconosciuto resta un errore d\'invio', () => {
    expect(resetErrorMessage({ code: 'boh' })).toContain('inviare');
  });
});

describe('RESET_SENT_MESSAGE', () => {
  /* Dire "ti ho mandato un'email" confermerebbe che quell'indirizzo e'
     registrato: basterebbe provarne uno per volta per sapere chi c'e' dentro. */
  it('non conferma che l\'account esiste', () => {
    expect(RESET_SENT_MESSAGE).toContain('Se esiste');
  });

  it('avvisa dello spam, che e\' dove finisce', () => {
    expect(RESET_SENT_MESSAGE).toContain('spam');
  });
});

describe('deleteAccountErrorMessage', () => {
  /* Qui la password si riscrive apposta, quindi sbagliarla e' il caso
     normale e va detto con quelle parole, non con un errore generico. */
  it('la password sbagliata si chiama col suo nome', () => {
    expect(deleteAccountErrorMessage({ code: 'auth/wrong-password' })).toBe('Password non corretta.');
    expect(deleteAccountErrorMessage({ code: 'auth/invalid-credential' })).toBe('Password non corretta.');
  });

  it('senza rete non e\' colpa della password', () => {
    expect(deleteAccountErrorMessage({ code: 'auth/network-request-failed' })).toContain('connessione');
  });

  it('un permesso negato parla dei dati, non delle regole', () => {
    expect(deleteAccountErrorMessage({ code: 'permission-denied' })).toContain('cancellare i tuoi dati');
  });

  /* I nostri errori (un coach con clienti, una sessione scaduta) arrivano
     gia' scritti per una persona: riscriverli li peggiorerebbe. */
  it('lascia passare i messaggi che ci siamo scritti noi', () => {
    expect(deleteAccountErrorMessage(new Error('Hai ancora 3 clienti collegati.')))
      .toBe('Hai ancora 3 clienti collegati.');
  });

  it('un errore muto resta comprensibile', () => {
    expect(deleteAccountErrorMessage({})).toContain('chiudere l\'account');
  });
});
