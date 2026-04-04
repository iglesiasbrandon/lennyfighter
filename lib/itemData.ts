/**
 * Shared item data module
 *
 * Canonical source of item definitions, used by both Durable Objects
 * and the client-side game code. Item validation happens server-side
 * so that WebSocket endpoints can accept a simple itemId instead of
 * trusting arbitrary JSON from the client.
 */
import type { GameItem } from './types';

export const ITEMS: GameItem[] = [
  {
    id: 'hook_model',
    name: 'The Hook Model',
    cost: 150,
    rarity: 'common',
    effect: 'eliminate_wrong_answer',
    timing: 'trivia_phase',
    description: 'Eliminates one wrong trivia answer option',
    flavor: 'Trigger, Action, Reward, Investment - now you are hooked on the right answer',
  },
  {
    id: 'blitzscaling_bomb',
    name: 'Blitzscaling Bomb',
    cost: 200,
    rarity: 'uncommon',
    effect: 'atk_boost_def_penalty',
    timing: 'pre_match',
    atkBoost: 0.30,
    defPenalty: 0.15,
    description: '+30% ATK for the match, but -15% DEF',
    flavor: 'Grow fast, break things. Including your opponent.',
  },
  {
    id: 'moat_builder',
    name: 'Moat Builder',
    cost: 200,
    rarity: 'uncommon',
    effect: 'def_boost',
    timing: 'pre_match',
    defBoost: 0.30,
    description: '+30% DEF for the match',
    flavor: 'Warren Buffett approved competitive advantage',
  },
  {
    id: 'first_mover',
    name: 'First-Mover Advantage',
    cost: 175,
    rarity: 'uncommon',
    effect: 'go_first',
    timing: 'pre_match',
    description: 'Guarantees you go first',
    flavor: 'Strike before they can react',
  },
  {
    id: 'runway_extension',
    name: 'Runway Extension',
    cost: 250,
    rarity: 'rare',
    effect: 'heal_30pct',
    timing: 'active_use',
    description: 'Restore 30% of max HP once during the match',
    flavor: 'Buys you more time when the burn rate is high',
  },
  {
    id: 'pmf_shield',
    name: 'Product-Market Fit Shield',
    cost: 300,
    rarity: 'rare',
    effect: 'nullify_type',
    timing: 'active_use',
    description: 'Nullifies type advantage/disadvantage for one attack',
    flavor: 'When you have PMF, nothing can stop you',
  },
  {
    id: 'hockey_stick',
    name: 'Hockey Stick',
    cost: 175,
    rarity: 'uncommon',
    effect: 'double_damage',
    timing: 'active_use',
    description: 'One attack deals 2x damage',
    flavor: 'Growth so vertical it hurts',
  },
  {
    id: 'pivot_potion',
    name: 'Pivot Potion',
    cost: 150,
    rarity: 'common',
    effect: 'block_self_damage',
    timing: 'passive',
    description: 'Blocks self-damage from one wrong trivia answer',
    flavor: 'Change direction, minimize the pain',
  },
  {
    id: 'founder_mode',
    name: 'Founder Mode',
    cost: 350,
    rarity: 'epic',
    effect: 'steal_move',
    timing: 'active_use',
    description: "Steal opponent's highest-power move for one use",
    flavor: 'Get into every detail. Even their playbook.',
  },
  {
    id: 'bridge_round',
    name: 'Bridge Round',
    cost: 400,
    rarity: 'epic',
    effect: 'revive_20pct',
    timing: 'passive',
    description: "If KO'd, revive with 20% HP (once)",
    flavor: 'Painful, but you survive to fight another day',
  },
  {
    id: 'the_memo',
    name: 'The Memo',
    cost: 250,
    rarity: 'rare',
    effect: 'reveal_move',
    timing: 'passive',
    description: "See opponent's selected move before choosing yours",
    flavor: 'Like Bezos 6-pager - reveals everything',
  },
  {
    id: 'scope_creep',
    name: 'Scope Creep',
    cost: 300,
    rarity: 'rare',
    effect: 'invert_answer',
    timing: 'active_use',
    description: "Opponent's next correct answer counts as incorrect",
    flavor: 'Never-ending requirements drain their focus',
  },
];

/** All valid item IDs. Use this to validate client-supplied itemId values. */
export const VALID_ITEM_IDS: string[] = ITEMS.map(i => i.id);

/** Look up an item by ID. Returns undefined if the ID is not in the catalog. */
export function getItemById(id: string): GameItem | undefined {
  return ITEMS.find(i => i.id === id);
}

/** Get all items (the full catalog). */
export function getAllItems(): GameItem[] {
  return ITEMS;
}

/** Shared rarity color mapping. */
export const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
};
