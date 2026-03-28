// Shared types for LennyFighter

// ---- Player & Auth ----
export interface Player {
  id: string;
  username: string;
  created_at: string;
}

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
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
