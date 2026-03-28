import { NavBar } from '../components/NavBar';
import { ArchitectureDiagrams } from '../components/ArchitectureDiagrams';

export const metadata = { title: 'Technology — LennyFighter' };

export default function TechnologyPage() {
  return (
    <>
      <NavBar />
      <div className="about-container">

        {/* OVERVIEW */}
        <section className="about-section">
          <h2>Overview</h2>
          <p>LennyFighter is built entirely on Cloudflare&apos;s developer platform, running at the edge with zero origin servers.</p>
        </section>

        {/* ARCHITECTURE */}
        <section className="about-section">
          <h2>Architecture</h2>
          <ul>
            <li>Vinext (Cloudflare&apos;s React SSR framework)</li>
            <li>Cloudflare Workers (edge runtime)</li>
            <li>Durable Objects: MatchmakingQueue (pairs players), MatchRoom (battle state)</li>
            <li>D1 (SQLite database for player stats, LennyCoin balances, transactions)</li>
            <li>KV (session token cache with 1-hour TTL)</li>
            <li>WebSockets for real-time multiplayer with KV-backed token auth</li>
          </ul>
        </section>

        {/* ARCHITECTURE DIAGRAMS */}
        <section className="about-section">
          <h2>Architecture Diagrams</h2>
          <p style={{ marginBottom: '16px', opacity: 0.7 }}>Click each diagram to expand.</p>
          <ArchitectureDiagrams />
        </section>

        {/* TECH STACK */}
        <section className="about-section">
          <h2>Tech Stack</h2>
          <div className="about-tech-list">
            <div><strong>Framework:</strong> Vinext (React SSR on Cloudflare Workers)</div>
            <div><strong>React:</strong> React 19 with React Server Components</div>
            <div><strong>Build:</strong> Vite 8</div>
            <div><strong>Runtime:</strong> Cloudflare Workers</div>
            <div><strong>Multiplayer:</strong> Durable Objects + WebSockets</div>
            <div><strong>Database:</strong> Cloudflare D1 (SQLite)</div>
            <div><strong>Session Cache:</strong> Cloudflare KV</div>
            <div><strong>Game Engine:</strong> Pure HTML/CSS + React (no canvas/Phaser)</div>
            <div><strong>Matchmaking:</strong> MatchmakingQueue DO (singleton)</div>
            <div><strong>Match State:</strong> MatchRoom DO (one per match)</div>
          </div>
        </section>

        {/* SECURITY */}
        <section className="about-section">
          <h2>Security</h2>
          <ul>
            <li>KV-backed session tokens for WebSocket authentication</li>
            <li>Server-side damage calculation (clients cannot send arbitrary damage values)</li>
            <li>Parameterized SQL queries for all D1 operations</li>
            <li>Atomic LennyCoin transfers via D1 batch transactions</li>
          </ul>
        </section>

        {/* MULTIPLAYER INFRASTRUCTURE */}
        <section className="about-section">
          <h2>Multiplayer Infrastructure</h2>
          <ul>
            <li><strong>MatchmakingQueue</strong> is a singleton Durable Object that pairs players using level-based matching (within 3 levels, FIFO fallback) with a 3-second alarm retry cycle</li>
            <li><strong>MatchRoom</strong> is a per-match Durable Object that holds authoritative battle state, processes turns, validates moves, and records results</li>
            <li>If a player disconnects, they get a <strong>20-second reconnection grace period</strong> before the match is forfeited</li>
            <li>WebSockets use hibernatable mode so idle connections do not consume billable duration</li>
          </ul>
        </section>

        {/* DATA MODEL */}
        <section className="about-section">
          <h2>Data Model</h2>
          <ul>
            <li><strong>KV:</strong> Session tokens (keyed by UUID, value is gamertag, 1-hour TTL)</li>
            <li><strong>D1:</strong> Player registration, win/loss stats, LennyCoin balances, item inventory, and transaction history</li>
            <li><strong>DO memory:</strong> Ephemeral match state (HP, turns, trivia, wagers) &mdash; not persisted after the match ends</li>
            <li><strong>Client storage:</strong> Gamertag in localStorage, session token and match info in sessionStorage</li>
          </ul>
        </section>

      </div>
    </>
  );
}
