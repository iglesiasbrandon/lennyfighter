import type { Fighter, FighterType, Move, TriviaQuestion } from '../../lib/types';

/**
 * LennyFighter Character Roster
 *
 * 15 fighters based on real podcast guests from Lenny's Podcast (PokeLenny).
 * Trivia questions sourced from actual podcast interviews.
 *
 * Types and matchups:
 * Growth > Data > Design > Product > Engineering > Growth
 *
 * Fighter data is defined in lib/fighterData.ts (shared with Durable Objects).
 * This file re-exports it and adds game-specific helpers (type chart, multipliers).
 */

// Re-export fighter data from the shared module
export { FIGHTERS, VALID_FIGHTER_IDS, getFighterById } from '../../lib/fighterData';

// Re-export game logic from the shared module
export { TYPE_CHART, getTypeMultiplier } from '../../lib/gameLogic';
