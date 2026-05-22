'use client';

import type { BracketMatch } from '../../lib/types';

interface TournamentBracketProps {
  matches: BracketMatch[];
  myGamertag: string;
  champion: string | null;
}

/**
 * Pure presentational single-elimination bracket. Groups the flat `matches`
 * array by `round` and renders each round as a horizontal column.
 */
export function TournamentBracket({ matches, myGamertag, champion }: TournamentBracketProps) {
  if (matches.length === 0) return null;

  // Group matches by round index.
  const rounds: BracketMatch[][] = [];
  for (const m of matches) {
    (rounds[m.round] ||= []).push(m);
  }
  const lastRound = rounds.length - 1;

  function roundLabel(round: number): string {
    if (round === lastRound) return 'Final';
    if (round === lastRound - 1) return 'Semifinals';
    return `Round ${round + 1}`;
  }

  return (
    <div className="bracket-scroll">
      <div className="bracket-columns">
        {rounds.map((roundMatches, roundIdx) => (
          <div key={roundIdx} className="bracket-column">
            <div className="bracket-round-header">{roundLabel(roundIdx)}</div>
            <div className="bracket-round-matches">
              {(roundMatches ?? []).map((m) => (
                <BracketMatchBox
                  key={m.matchId}
                  match={m}
                  myGamertag={myGamertag}
                  champion={champion}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatchBox({
  match,
  myGamertag,
  champion,
}: {
  match: BracketMatch;
  myGamertag: string;
  champion: string | null;
}) {
  const done = match.status === 'done';
  return (
    <div className={`bracket-match ${done ? 'is-done' : ''} ${match.status === 'ready' || match.status === 'active' ? 'is-live' : ''}`}>
      <BracketSlot
        name={match.p1}
        isWinner={done && match.winner === match.p1}
        isMe={!!match.p1 && match.p1 === myGamertag}
        isChampion={!!champion && match.p1 === champion}
      />
      <div className="bracket-match-vs">vs</div>
      <BracketSlot
        name={match.p2}
        isWinner={done && match.winner === match.p2}
        isMe={!!match.p2 && match.p2 === myGamertag}
        isChampion={!!champion && match.p2 === champion}
      />
    </div>
  );
}

function BracketSlot({
  name,
  isWinner,
  isMe,
  isChampion,
}: {
  name: string | null;
  isWinner: boolean;
  isMe: boolean;
  isChampion: boolean;
}) {
  return (
    <div
      className={`bracket-slot ${isWinner ? 'is-winner' : ''} ${isMe ? 'is-me' : ''} ${name ? '' : 'is-tbd'}`}
    >
      <span className="bracket-slot-name">{name ?? 'TBD'}</span>
      {isChampion && <span className="bracket-slot-crown" aria-label="Champion">{'\u{1F451}'}</span>}
    </div>
  );
}
