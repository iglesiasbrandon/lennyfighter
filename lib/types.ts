// Shared types for LennyFighter

// ---- Game Types ----
export type FighterType = 'Growth' | 'Engineering' | 'Design' | 'Data' | 'Product';

export interface Fighter {
  id: string;
  name: string;
  title: string;
  type: FighterType;
  stats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
  };
  moves: Move[];
  trivia: TriviaQuestion[];
  avatar: string;
}

export interface Move {
  name: string;
  type: FighterType;
  power: number;
  description: string;
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  answer: string;
}

// ---- Items ----
export interface GameItem {
  id: string;
  name: string;
  cost: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  effect: string;
  timing: 'pre_match' | 'active_use' | 'passive' | 'trivia_phase';
  description: string;
  flavor: string;
  atkBoost?: number;
  defPenalty?: number;
  defBoost?: number;
}

export interface InventoryEntry {
  item: GameItem;
  quantity: number;
}

// ---- Tournament ----
export type BracketSize = 4 | 8 | 16;
export type TournamentStatus = 'lobby' | 'in_progress' | 'finished';
export type MatchSlotStatus = 'pending' | 'ready' | 'active' | 'done';

/** A single match slot in a single-elimination bracket. Stored flat. */
export interface BracketMatch {
  /** Pre-generated id used to address the MatchRoom DO (idFromName). */
  matchId: string;
  /** 0-based round index (0 = first round). */
  round: number;
  /** Position of this match within its round. */
  indexInRound: number;
  /** Participant gamertags, null until decided. */
  p1: string | null;
  p2: string | null;
  /** Winner gamertag, null until the match is done. */
  winner: string | null;
  status: MatchSlotStatus;
  /** Flat index of the next-round match the winner advances into (null = final). */
  advancesTo: number | null;
  /** Which slot of the next match the winner fills. */
  advancesToSlot: 'p1' | 'p2' | null;
}

export interface TournamentPlayer {
  gamertag: string;
  fighterId: string;
  connected: boolean;
  eliminated: boolean;
}

/** Full tournament state — used for both DO storage and the `state_sync` wire message. */
export interface TournamentState {
  code: string;
  adminGamertag: string | null;
  status: TournamentStatus;
  bracketSize: BracketSize;
  roster: TournamentPlayer[];
  matches: BracketMatch[];
  champion: string | null;
  createdAt: number;
}

// ---- API Response Envelope ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
}

// ---- Env bindings ----
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  MATCH_ROOM: DurableObjectNamespace;
  MATCHMAKING_QUEUE: DurableObjectNamespace;
  TOURNAMENT: DurableObjectNamespace;
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
