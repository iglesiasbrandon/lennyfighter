import { NavBar } from '../components/NavBar';
import { FIGHTERS } from '../../lib/fighterData';
import { ITEMS } from '../../lib/itemData';

export const metadata = { title: 'About the Game — LennyFighter' };

const TYPE_CHART = [
  { attacker: 'Growth', defender: 'Data' },
  { attacker: 'Data', defender: 'Design' },
  { attacker: 'Design', defender: 'Product' },
  { attacker: 'Product', defender: 'Engineering' },
  { attacker: 'Engineering', defender: 'Growth' },
];

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic'] as const;

export default function AboutPage() {
  return (
    <>
      <NavBar />
      <main className="about-container">

        {/* HOW TO PLAY */}
        <section className="about-section">
          <h2>How to Play</h2>
          <ol>
            <li>Enter a gamertag (stored in a KV-backed session token)</li>
            <li>Pick a fighter from {FIGHTERS.length} characters across 5 types</li>
            <li>Choose <strong>Multiplayer</strong> (real opponent via WebSockets) or <strong>Bot</strong> (practice)</li>
            <li>In multiplayer, a wager negotiation phase lets both players bet LennyCoin on the outcome</li>
            <li>If you have items in your inventory, a selection phase lets you equip one item for the match</li>
            <li>First turn is randomly assigned (unless someone uses the First-Mover Advantage item)</li>
            <li>On your turn, pick a move, then answer a trivia question about your <em>opponent&apos;s</em> podcast interview</li>
            <li>Correct answer = full damage. Wrong answer = 0 damage to opponent + recoil (50% of the move&apos;s power as self-damage)</li>
            <li>Turns alternate until one fighter reaches 0 HP</li>
          </ol>
        </section>

        {/* DAMAGE FORMULA */}
        <section className="about-section">
          <h2>Damage Formula</h2>
          <div className="about-formula">
            <code>damage = round(move.power * (attacker.ATK / defender.DEF) * typeMultiplier)</code>
          </div>
          <ul>
            <li><strong>Correct answer:</strong> Full damage applied to the opponent</li>
            <li><strong>Wrong answer:</strong> 0 damage to opponent, but you take <code>round(move.power * 0.5)</code> as self-damage (recoil)</li>
          </ul>
          <p>High-power moves hit harder on correct answers but carry greater recoil risk on wrong answers.</p>
        </section>

        {/* TYPE SYSTEM */}
        <section className="about-section">
          <h2>Type System</h2>
          <p>Five types form a rock-paper-scissors circle:</p>
          <div className="about-type-chart">
            {TYPE_CHART.map(({ attacker, defender }) => (
              <div key={attacker} className="about-type-row">
                <span className={`type-badge type-${attacker}`}>{attacker}</span>
                <span>&gt;</span>
                <span className={`type-badge type-${defender}`}>{defender}</span>
              </div>
            ))}
          </div>
          <ul>
            <li>Strong matchup = 1.5x damage</li>
            <li>Weak matchup = 0.67x damage</li>
            <li>Neutral = 1.0x damage</li>
          </ul>
          <p>Each fighter&apos;s moves match their own type, so type effectiveness depends on the matchup between fighters, not move selection. Lenny Rachitsky is Product type but has moves spanning multiple types.</p>
        </section>

        {/* FIGHTERS */}
        <section className="about-section">
          <h2>Fighters</h2>
          <div className="about-fighter-grid">
            {FIGHTERS.map((fighter) => (
              <div key={fighter.id} className="about-fighter-card">
                <div className="name">{fighter.name}</div>
                <span className={`type-badge type-${fighter.type}`}>{fighter.type}</span>
                <div className="title">{fighter.title}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ITEMS */}
        <section className="about-section">
          <h2>Items</h2>
          <p>Players can equip one item per match from their inventory. Items cost LennyCoin and are consumed on use.</p>
          <div className="about-item-grid">
            {RARITY_ORDER.map(rarity => {
              const items = ITEMS.filter(i => i.rarity === rarity);
              if (items.length === 0) return null;
              return (
                <div key={rarity} className="about-item-rarity-group">
                  <h3 className={`item-rarity item-rarity-${rarity}`}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</h3>
                  {items.map(item => (
                    <div key={item.id} className="about-item-row">
                      <strong>{item.name}</strong> <span className="item-cost">({item.cost} LC)</span>
                      <div className="item-desc">{item.description}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {/* LENNYCOIN ECONOMY */}
        <section className="about-section">
          <h2>LennyCoin Economy</h2>
          <ul>
            <li><strong>Win reward:</strong> 10 LC per multiplayer victory</li>
            <li><strong>Transfer vs. mint:</strong> If the loser has LC, coins transfer from loser to winner. If the loser has 0 LC, new coins are minted for the winner.</li>
            <li><strong>Wager system:</strong> Before each multiplayer match, players can propose a wager. The max wager is the minimum of both players&apos; balances. If either player has 0 LC, the wager phase is skipped. The wager payout is on top of the base 10 LC reward.</li>
            <li><strong>Spending:</strong> LennyCoin is spent on items from the shop</li>
          </ul>
        </section>

        {/* CREDITS & SOURCES */}
        <section className="about-section">
          <h2>Credits</h2>
          <ul>
            <li>Trivia sourced from <a href="https://www.lennysnewsletter.com/podcast" target="_blank" rel="noopener noreferrer">Lenny&apos;s Podcast</a> interviews</li>
            <li>Pixel art sprites from <a href="https://github.com/hbshih/PokeLenny" target="_blank" rel="noopener noreferrer">PokeLenny</a> by Ben Shih</li>
            <li>Inspired by <a href="https://lennyrpg.fun" target="_blank" rel="noopener noreferrer">LennyRPG</a> (lennyrpg.fun)</li>
          </ul>
        </section>

      </main>
    </>
  );
}
