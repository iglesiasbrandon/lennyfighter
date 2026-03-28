# LennyFighter — Game Design Document

## Overview

LennyFighter is a 1v1 multiplayer trivia fighting game. Players select a fighter based on a real Lenny's Podcast guest, then battle by answering trivia questions from the opponent's interview episode. Correct answers deal damage; wrong answers deal 0 damage to the opponent plus 50% of the move's power as recoil (self-damage).

## Fighters

15 playable characters across 5 types:

| Fighter | Type | HP | ATK | DEF | SPD |
|---------|------|----|-----|-----|-----|
| Elena Verna | Growth | 120 | 16 | 8 | 14 |
| Nir Eyal | Growth | 105 | 15 | 10 | 12 |
| Shreyas Doshi | Product | 130 | 13 | 13 | 10 |
| Marty Cagan | Product | 135 | 12 | 14 | 9 |
| Teresa Torres | Product | 115 | 13 | 11 | 12 |
| Brian Chesky | Engineering | 140 | 14 | 13 | 9 |
| Dylan Field | Engineering | 115 | 15 | 10 | 13 |
| Eric Ries | Engineering | 125 | 13 | 12 | 11 |
| Julie Zhuo | Design | 100 | 14 | 9 | 15 |
| Scott Belsky | Design | 110 | 13 | 11 | 12 |
| April Dunford | Design | 108 | 15 | 10 | 13 |
| Seth Godin | Data | 118 | 14 | 10 | 12 |
| Gibson Biddle | Data | 125 | 13 | 13 | 10 |
| Kim Scott | Data | 112 | 14 | 11 | 11 |
| Lenny Rachitsky | Product | 150 | 15 | 12 | 11 |

Lenny is typed as Product but has moves spanning multiple types (Growth, Product, Data, Design).

### Stats

- **HP** — Hit Points. Reach 0 and you lose.
- **ATK** — Attack. Increases damage dealt.
- **DEF** — Defense. Reduces incoming damage.
- **SPD** — Speed. Reserved for future use.

## Type System

Five types form a rock-paper-scissors circle:

```
Growth > Data > Design > Product > Engineering > Growth
```

- **Strong matchup (1.5x):** Your move's type beats the defender's type.
- **Weak matchup (0.67x):** Your move's type loses to the defender's type.
- **Neutral (1.0x):** No advantage.

Lenny is Product type with multi-type moves, giving him partial coverage across the type chart.

## Combat

### Turn Structure

1. First turn is randomly assigned (unless a player uses the First-Mover Advantage item).
2. On your turn, you select a move.
3. A trivia question appears — sourced from your **opponent's** podcast interview.
4. Answer correctly to deal damage. Answer wrong and you deal 0 damage but take recoil (50% of the move's power as self-damage).
5. Turns alternate until one fighter reaches 0 HP.

### Damage Formula

```
damage = round(move.power * (attacker.ATK / defender.DEF) * typeMultiplier)
```

- **Correct answer:** Full damage is applied.
- **Wrong answer:** 0 damage to opponent + 50% of the move's power as self-damage (recoil).

### Moves

Each fighter has 4 unique moves with varying power:

- **High power** — hits hard but higher recoil risk on wrong answers (e.g., 32 power)
- **Low power** — reliable chip damage with lower recoil risk (e.g., 18 power)

Move type matches the fighter's type (Growth fighters have Growth moves, etc.), so type effectiveness depends on the matchup, not move selection.

### Example Damage Calculation

Elena Verna (ATK 16, Growth) uses "PLG Surge" (power 28) against Gibson Biddle (DEF 13, Data):

```
damage = round(28 * (16 / 13) * 1.5) = round(51.7) = 52
typeMultiplier = 1.5  (Growth is strong vs Data)
```

If Elena answers wrong: **0 damage to Gibson**, but Elena takes `round(28 * 0.5) = 14` recoil damage.

## Trivia

Each fighter has 4 trivia questions pulled from their real Lenny's Podcast interview. During battle, the attacking player answers a question about the **opponent's** fighter — not their own. This means knowing the podcast gives you an advantage against specific characters.

Questions are multiple choice with 4 options.

## Multiplayer Flow

1. **Gamertag** — Enter a gamertag (session token stored in KV).
2. **Fighter Select** — Pick your character from the roster.
3. **Mode Select** — Choose Multiplayer or Bot.
4. **Matchmaking** — Enter the queue. When another player is also queuing, you're paired.
5. **Wager Phase** — Both players negotiate an optional LennyCoin wager (15-second timeout). Skipped if either player has 0 LC.
6. **Item Selection** — If items are enabled and a player has inventory, they can equip one item.
7. **Battle** — Real-time turn-based combat over WebSockets.
8. **Result** — Victory or defeat screen with LC rewards. Option to play again.

## Items

Players can equip one item per match. Items are selected during a 15-second selection phase after both players connect but before the first turn. If a player doesn't select in time, they go without an item.

### Item Catalog

| Item | Rarity | Cost | Timing | Effect |
|------|--------|------|--------|--------|
| The Hook Model | Common | 150 | Trivia | Eliminates one wrong answer option |
| Pivot Potion | Common | 150 | Passive | Blocks self-damage from one wrong answer |
| First-Mover Advantage | Uncommon | 175 | Pre-match | Guarantees you go first |
| Hockey Stick | Uncommon | 175 | Active | One attack deals 2x damage |
| Blitzscaling Bomb | Uncommon | 200 | Pre-match | +30% ATK, but -15% DEF for the match |
| Moat Builder | Uncommon | 200 | Pre-match | +30% DEF for the match |
| The Memo | Rare | 250 | Passive | See opponent's selected move before choosing yours |
| Runway Extension | Rare | 250 | Active | Restore 30% of max HP once during the match |
| Scope Creep | Rare | 300 | Active | Opponent's next correct answer counts as incorrect |
| Product-Market Fit Shield | Rare | 300 | Active | Nullifies type advantage/disadvantage for one attack |
| Founder Mode | Epic | 350 | Active | Steal opponent's highest-power move for one use |
| Bridge Round | Epic | 400 | Passive | If KO'd, revive with 20% HP (once) |

### Timing Categories

- **Pre-match** — Applied automatically before the first turn. Stat boosts and turn order overrides.
- **Trivia** — Activates during the trivia question phase. Modifies the question or answer options.
- **Active** — Used manually on your turn instead of (or in addition to) attacking. One-time use.
- **Passive** — Triggers automatically when a specific condition is met. No player input needed.

### How Items Affect Combat

**Stat modifiers (pre-match):** Blitzscaling Bomb and Moat Builder modify ATK/DEF for the entire match. The modified stats feed directly into the damage formula, so a +30% ATK boost means ~30% more damage on every correct answer.

**Turn order (pre-match):** First-Mover Advantage guarantees you go first (first turn is normally random).

**Answer manipulation:** The Hook Model removes one wrong trivia option (making it 1-in-3 instead of 1-in-4). Scope Creep flips the opponent's next correct answer to incorrect (0 damage).

**Damage modifiers (active):** Hockey Stick doubles one attack's damage. Product-Market Fit Shield removes type effectiveness for one attack (useful when you have a type disadvantage). Founder Mode lets you use the opponent's strongest move with your own ATK stat.

**Survival (passive):** Pivot Potion blocks self-damage (recoil) from one wrong answer. Bridge Round revives you at 20% HP after a KO — the match continues. Runway Extension heals 30% HP on demand.

**Information (passive):** The Memo reveals which move the opponent selected, letting you choose your response strategically.

### Item Economy

Items cost LennyCoin (LC). Rarity determines the price range:
- **Common:** 150 LC
- **Uncommon:** 175–200 LC
- **Rare:** 250–300 LC
- **Epic:** 350–400 LC

Items are consumed on use — one item per match.

## LennyCoin Economy

- **Win reward:** 10 LC per multiplayer victory.
- **Transfer vs. mint:** If the loser has LC, up to 10 coins transfer from loser to winner. If the loser has 0 LC, 10 new coins are minted for the winner.
- **Wager system:** Before each multiplayer match, a 15-second wager negotiation phase begins. The maximum wager is the minimum of both players' balances. If either player has 0 LC, the wager phase is skipped entirely. Wager payouts are on top of the base 10 LC reward.
- **Spending:** LennyCoin is used to buy items from the shop.

## Reconnection

If a player disconnects during a multiplayer match, they get a 20-second grace period to reconnect. If they reconnect in time, the match resumes with full state restoration. If they do not reconnect, they forfeit.

## Session Auth

Players enter a gamertag. A session token is stored in KV (Cloudflare KV namespace) and cached in sessionStorage. The token is validated on WebSocket connection to the MatchRoom, ensuring the gamertag is verified server-side.

## Win Condition

Reduce the opponent's HP to 0. The attacking player who lands the finishing blow wins. Bridge Round can extend the match by reviving a KO'd player once.
