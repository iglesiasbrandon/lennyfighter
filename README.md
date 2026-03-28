# LennyFighter

A multiplayer trivia fighting game built on Cloudflare.

**Live at [lennyfighter.com](https://lennyfighter.com)**

![LennyFighter](screenshot.png)

## What is this?

LennyFighter is a real-time 1v1 fighting game where players pick tech industry leaders as fighters and battle by answering trivia from their Lenny's Podcast interviews. Correct answers deal damage; wrong answers miss but deal recoil damage to yourself. Type matchups, stats, and items add strategic depth.

## Tech Stack

- [Vinext](https://github.com/nicolo-ribaudo/vinext) (Cloudflare React SSR framework)
- Cloudflare Workers + Durable Objects (MatchRoom, MatchmakingQueue)
- Cloudflare D1 (SQLite) for player data, leaderboards, and LennyCoin ledger
- WebSockets for real-time multiplayer
- VT323 pixel font

## How It Works

1. **Pick a fighter** — 15 tech industry leaders across 5 types (Growth, Data, Design, Product, Engineering)
2. **Queue up** — Multiplayer (real opponent) or Bot (practice)
3. **Answer trivia** — Questions are sourced from your opponent's podcast interview
4. **Deal damage** — Correct answers hit; wrong answers miss and deal recoil to yourself
5. **Type effectiveness** — Growth > Data > Design > Product > Engineering > Growth
6. **Earn LennyCoin** — Win matches to earn currency for items

## Local Development

```sh
npm install
npm run dev
```

Opens at http://localhost:3000. The local dev server uses a Node WebSocket server for multiplayer (Vite doesn't proxy WS upgrades to workerd).

## Deployment

```sh
npm run deploy
npx wrangler d1 migrations apply lennyfighter-db --remote
```

## Project Structure

```
app/            React components, pages, API routes
durableObjects/ MatchRoom (battle state), MatchmakingQueue (pairs players)
lib/            Shared types, fighter data, game constants
worker/         Cloudflare Worker entry point
migrations/     D1 database schema (001_init through 006_cleanup)
```

## Credits

- Inspired by [PokeLenny](https://github.com/hbshih/PokeLenny) by Ben Shih
- Trivia sourced from [Lenny's Podcast](https://www.lennyspodcast.com/)
