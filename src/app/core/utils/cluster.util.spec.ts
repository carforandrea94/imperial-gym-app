import {
  newCluster, normalizeCluster, formatClusterRest, clusterLabel, clusterScheme,
  buildBlocks, canAddBlock, buildBlock, currentBlock, clusterSetDone, blocksLabel,
  plannedReps, CLUSTER_DEFAULT_REST
} from './cluster.util';
import { BlockRow, MAX_BLOCKS_PER_SET } from './extra-sets.util';
import { ClusterSpec } from '../../models/workout.model';

const FISSO: ClusterSpec = { blocks: [8, 8], restSec: 30, end: 'fixed' };
const APERTO: ClusterSpec = { blocks: [5], restSec: 30, end: 'open' };

function blocchi(...fatti: (number | null)[]): BlockRow[] {
  return fatti.map(n => ({ reps: n === null ? '' : String(n), ripPlaceholder: '8', done: n !== null }));
}

describe('normalizeCluster', () => {
  it('legge un cluster scritto bene', () => {
    expect(normalizeCluster({ blocks: [8, 8], restSec: 30, end: 'fixed' })).toEqual(FISSO);
  });

  it('non e\' un cluster se non e\' un oggetto', () => {
    expect(normalizeCluster(null)).toBeNull();
    expect(normalizeCluster('8+8')).toBeNull();
  });

  it('senza blocchi non e\' un cluster', () => {
    expect(normalizeCluster({ blocks: [], restSec: 30, end: 'fixed' })).toBeNull();
    expect(normalizeCluster({ blocks: [0, -2], restSec: 30, end: 'fixed' })).toBeNull();
  });

  /* Un blocco solo, coi blocchi scritti, e' una serie normale: chiamarla
     cluster aggiungerebbe una parola e nessuna pausa. */
  it('un blocco solo a blocchi fissi non e\' un cluster', () => {
    expect(normalizeCluster({ blocks: [10], restSec: 30, end: 'fixed' })).toBeNull();
  });

  it('a esaurimento un blocco solo basta', () => {
    expect(normalizeCluster({ blocks: [5], restSec: 30, end: 'open' })).toEqual(APERTO);
  });

  // Li' il numero di blocchi non e' del piano: tenerne scritti altri direbbe il contrario.
  it('a esaurimento tiene solo il primo blocco', () => {
    expect(normalizeCluster({ blocks: [5, 5, 5], restSec: 30, end: 'open' })?.blocks).toEqual([5]);
  });

  it('una pausa assurda torna a quella di default', () => {
    expect(normalizeCluster({ blocks: [8, 8], end: 'fixed' })?.restSec).toBe(CLUSTER_DEFAULT_REST);
    expect(normalizeCluster({ blocks: [8, 8], restSec: 1, end: 'fixed' })?.restSec).toBe(CLUSTER_DEFAULT_REST);
  });

  it('non supera il tetto dei blocchi', () => {
    const molti = Array.from({ length: MAX_BLOCKS_PER_SET + 4 }, () => 5);
    expect(normalizeCluster({ blocks: molti, restSec: 30, end: 'fixed' })?.blocks.length)
      .toBe(MAX_BLOCKS_PER_SET);
  });

  it('un end sconosciuto vale come blocchi scritti', () => {
    expect(normalizeCluster({ blocks: [8, 8], restSec: 30, end: 'boh' })?.end).toBe('fixed');
  });
});

describe('come si scrive', () => {
  it('la pausa come la scrive il coach', () => {
    expect(formatClusterRest(30)).toBe('30"');
    expect(formatClusterRest(60)).toBe("1'");
    expect(formatClusterRest(90)).toBe('1\'30"');
  });

  it('i blocchi scritti: 8+8', () => {
    expect(clusterLabel(FISSO)).toBe('8+8');
  });

  it('a esaurimento: blocco e pausa', () => {
    expect(clusterLabel(APERTO)).toBe('5+30"');
  });

  it('lo schema intero mette davanti le serie', () => {
    expect(clusterScheme(FISSO, 4)).toBe('4x8+8');
    expect(clusterScheme(APERTO, 2)).toBe('2x5+30"');
  });

  it('quello che hai fatto, non quello che era previsto', () => {
    expect(blocksLabel(blocchi(8, 8, 5))).toBe('8+8+5');
  });

  it('i blocchi non fatti restano fuori', () => {
    expect(blocksLabel(blocchi(8, null))).toBe('8');
  });
});

describe('i blocchi di una serie', () => {
  it('nascono vuoti, coi loro suggerimenti', () => {
    const b = buildBlocks(FISSO);
    expect(b.length).toBe(2);
    expect(b[0]).toEqual({ reps: '', ripPlaceholder: '8', done: false });
  });

  it('il corrente e\' il primo non fatto', () => {
    expect(currentBlock(blocchi(8, null, null))).toBe(1);
  });

  it('finiti tutti non ce n\'e\' uno corrente', () => {
    expect(currentBlock(blocchi(8, 8))).toBe(-1);
  });

  it('un blocco in piu\' solo a esaurimento', () => {
    expect(canAddBlock(FISSO, blocchi(8, 8))).toBe(false);
    expect(canAddBlock(APERTO, blocchi(5))).toBe(true);
  });

  it('nemmeno a esaurimento oltre il tetto', () => {
    const pieni = Array.from({ length: MAX_BLOCKS_PER_SET }, () => blocchi(5)[0]);
    expect(canAddBlock(APERTO, pieni)).toBe(false);
  });

  it('il blocco in piu\' suggerisce quello del piano', () => {
    expect(buildBlock(APERTO).ripPlaceholder).toBe('5');
  });
});

describe('quando la serie e\' finita', () => {
  it('coi blocchi scritti, quando sono tutti fatti', () => {
    expect(clusterSetDone(FISSO, blocchi(8, null))).toBe(false);
    expect(clusterSetDone(FISSO, blocchi(8, 8))).toBe(true);
  });

  /* A esaurimento un altro blocco e' sempre possibile: se si chiudesse da
     sola, deciderebbe lei quando non ne escono piu'. */
  it('a esaurimento non si chiude mai da sola', () => {
    expect(clusterSetDone(APERTO, blocchi(5, 5, 5))).toBe(false);
  });

  it('senza blocchi non e\' finita', () => {
    expect(clusterSetDone(FISSO, [])).toBe(false);
  });
});

describe('plannedReps', () => {
  it('somma i blocchi previsti', () => {
    expect(plannedReps(FISSO)).toBe(16);
    expect(plannedReps(APERTO)).toBe(5);
  });
});

describe('newCluster', () => {
  it('nasce come il cluster piu\' comune', () => {
    expect(newCluster()).toEqual({ blocks: [8, 8], restSec: 30, end: 'fixed' });
  });
});
