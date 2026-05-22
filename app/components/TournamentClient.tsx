'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Fighter, BracketMatch, BracketSize } from '../../lib/types';
import { FIGHTERS, getFighterById } from '../../lib/fighterData';
import { opponentOf } from '../../lib/bracket';
import { FighterSelect } from './FighterSelect';
import { MultiplayerBattle } from './MultiplayerBattle';
import { TournamentBracket } from './TournamentBracket';
import { ErrorBoundary } from './ErrorBoundary';
import { useTournament } from '../hooks/useTournament';
import { useMatchRoom, getLocalGamertag } from '../hooks/useMultiplayer';
import type { MatchInfo } from '../hooks/useMultiplayer';

const ACTIVE_TOURNAMENT_KEY = 'lf_active_tournament';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BRACKET_SIZE_OPTIONS: BracketSize[] = [4, 8, 16];

interface StoredTournament {
  code: string;
  fighterId: string;
}

function readStoredTournament(): StoredTournament | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_TOURNAMENT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredTournament;
    if (typeof data.code === 'string' && typeof data.fighterId === 'string') return data;
    return null;
  } catch {
    return null;
  }
}

function persistTournament(code: string, fighterId: string): void {
  sessionStorage.setItem(ACTIVE_TOURNAMENT_KEY, JSON.stringify({ code, fighterId }));
}

function clearStoredTournament(): void {
  sessionStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
}

function generateCode(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Renders a single tournament match using the existing `useMatchRoom` +
 * `MultiplayerBattle` combat machinery. Kept as a separate component so the
 * `useMatchRoom` hook is always called unconditionally — `TournamentClient`
 * mounts/unmounts this component to switch between match and bracket views.
 */
function TournamentMatch({
  matchInfo,
  fighter,
  code,
  onDone,
}: {
  matchInfo: MatchInfo;
  fighter: Fighter;
  code: string;
  onDone: () => void;
}) {
  const {
    battleState,
    connected,
    sendAnswer,
    selectItem,
    useItem,
    proposeWager,
    acceptWager,
    counterWager,
    skipWager,
  } = useMatchRoom(matchInfo, fighter, true, code);

  const doneRef = useRef(false);

  // Once the match finishes, fall back to the bracket view after a short delay.
  useEffect(() => {
    if (battleState.status === 'finished' && !doneRef.current) {
      doneRef.current = true;
      const t = setTimeout(onDone, 3500);
      return () => clearTimeout(t);
    }
  }, [battleState.status, onDone]);

  return (
    <ErrorBoundary>
      <MultiplayerBattle
        battleState={battleState}
        connected={connected}
        sendAnswer={sendAnswer}
        onMatchEnd={() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }}
        selectItem={selectItem}
        useItem={useItem}
        inventory={[]}
        proposeWager={proposeWager}
        acceptWager={acceptWager}
        counterWager={counterWager}
        skipWager={skipWager}
      />
    </ErrorBoundary>
  );
}

type Phase = 'entry' | 'live';

export function TournamentClient() {
  const stored = useRef<StoredTournament | null>(readStoredTournament());

  const [phase, setPhase] = useState<Phase>(stored.current ? 'live' : 'entry');
  const [fighter, setFighter] = useState<Fighter | null>(() => {
    if (stored.current) {
      const f = getFighterById(stored.current.fighterId);
      if (f) return f;
    }
    return null;
  });
  const [code, setCode] = useState<string | null>(stored.current?.code ?? null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [finishedMatchIds, setFinishedMatchIds] = useState<Set<string>>(new Set());

  // If sessionStorage restore failed (bad fighter id), drop back to entry.
  useEffect(() => {
    if (stored.current && !fighter) {
      clearStoredTournament();
      setCode(null);
      setPhase('entry');
    }
  }, [fighter]);

  // Require a registered gamertag, like LobbyClient.
  useEffect(() => {
    if (!getLocalGamertag()) {
      window.location.href = '/';
    }
  }, []);

  const {
    tournamentState,
    connected,
    error,
    closeCode,
    isAdmin,
    myGamertag,
    setBracketSize,
    startTournament,
  } = useTournament(code, fighter);

  const handleCreate = useCallback(() => {
    if (!fighter) return;
    const newCode = generateCode();
    persistTournament(newCode, fighter.id);
    setCode(newCode);
    setPhase('live');
  }, [fighter]);

  const handleJoin = useCallback(() => {
    if (!fighter) return;
    const trimmed = joinCodeInput.trim().toUpperCase();
    if (trimmed.length !== 4) return;
    persistTournament(trimmed, fighter.id);
    setCode(trimmed);
    setPhase('live');
  }, [fighter, joinCodeInput]);

  const backToEntry = useCallback(() => {
    clearStoredTournament();
    setCode(null);
    setJoinCodeInput('');
    setFinishedMatchIds(new Set());
    setPhase('entry');
  }, []);

  const markMatchFinished = useCallback((matchId: string) => {
    setFinishedMatchIds(prev => {
      if (prev.has(matchId)) return prev;
      const next = new Set(prev);
      next.add(matchId);
      return next;
    });
  }, []);

  // ---- Entry phase ----
  if (phase === 'entry') {
    return (
      <div className="tournament-container">
        <div className="page-header">
          <h1>Tournament</h1>
          <p>Pick a fighter, then create a new tournament or join one with a code.</p>
        </div>
        <FighterSelect fighters={FIGHTERS} selected={fighter} onSelect={setFighter} />
        <div className="tournament-entry-actions">
          <div className="tournament-entry-block">
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!fighter}
              style={{ width: '100%' }}
            >
              Create Tournament
            </button>
            <p className="tournament-entry-hint">Generate a fresh 4-letter code to share.</p>
          </div>
          <div className="tournament-entry-divider">or</div>
          <div className="tournament-entry-block">
            <input
              className="tournament-code-input"
              type="text"
              maxLength={4}
              placeholder="CODE"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
            />
            <button
              className="btn btn-outline"
              onClick={handleJoin}
              disabled={!fighter || joinCodeInput.trim().length !== 4}
              style={{ width: '100%' }}
            >
              Join Tournament
            </button>
            <p className="tournament-entry-hint">Enter a 4-character code from a host.</p>
          </div>
        </div>
        {!fighter && (
          <p className="tournament-entry-warn">Select a fighter above to continue.</p>
        )}
      </div>
    );
  }

  // ---- Live phase ----

  // Fatal close codes / errors → message + a way back.
  if (closeCode !== null || (error && !tournamentState)) {
    return (
      <div className="tournament-container">
        <div className="tournament-message">
          <h2>Could not join tournament</h2>
          <p>{error ?? 'Something went wrong.'}</p>
          <button className="btn btn-primary" onClick={backToEntry}>Back</button>
        </div>
      </div>
    );
  }

  if (!tournamentState) {
    return (
      <div className="tournament-container">
        <div className="queuing-screen">
          <h2>{connected ? 'Loading tournament...' : 'Connecting...'}</h2>
          <p>Joining tournament {code}</p>
          <div className="queuing-bar"><div className="queuing-bar-fill" /></div>
          <button className="btn btn-outline" onClick={backToEntry} style={{ marginTop: '20px' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const { status, roster, bracketSize, matches, champion } = tournamentState;

  // ---- Lobby ----
  if (status === 'lobby') {
    const canStart = roster.length === 4 || roster.length === 8 || roster.length === 16;
    return (
      <div className="tournament-container">
        <div className="tournament-lobby">
          <div className="tournament-code-banner">
            <span className="tournament-code-label">Tournament Code</span>
            <span className="tournament-code-value">{tournamentState.code}</span>
            <span className="tournament-code-hint">Share this code so others can join.</span>
          </div>

          {error && <p className="tournament-entry-warn">{error}</p>}

          <div className="tournament-roster">
            <h3>
              Players <span className="tournament-roster-count">{roster.length} / {bracketSize}</span>
            </h3>
            <ul className="tournament-roster-list">
              {roster.map((p) => (
                <li key={p.gamertag} className="tournament-roster-item">
                  <span className={`tournament-dot ${p.connected ? 'is-on' : 'is-off'}`} />
                  <span className={p.gamertag === myGamertag ? 'tournament-roster-me' : ''}>
                    {p.gamertag}
                    {p.gamertag === tournamentState.adminGamertag && (
                      <span className="tournament-host-tag">HOST</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {isAdmin ? (
            <div className="tournament-admin-controls">
              <div className="tournament-bracket-size">
                <span>Bracket size:</span>
                {BRACKET_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    className={`btn ${bracketSize === size ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setBracketSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary"
                onClick={startTournament}
                disabled={!canStart}
                style={{ fontSize: '24px', padding: '12px 32px' }}
              >
                Start Tournament
              </button>
              {!canStart && (
                <p className="tournament-entry-hint">
                  Need exactly 4, 8, or 16 players to start.
                </p>
              )}
            </div>
          ) : (
            <p className="tournament-waiting">Waiting for the host to start&hellip;</p>
          )}

          <button className="btn btn-outline" onClick={backToEntry} style={{ marginTop: '8px' }}>
            Leave Tournament
          </button>
        </div>
      </div>
    );
  }

  // ---- In progress ----
  if (status === 'in_progress') {
    const myActiveMatch: BracketMatch | undefined = matches.find(
      (m) =>
        (m.p1 === myGamertag || m.p2 === myGamertag) &&
        m.status === 'ready' &&
        !m.winner &&
        !finishedMatchIds.has(m.matchId),
    );

    if (myActiveMatch && fighter && code) {
      const opponent = opponentOf(myActiveMatch, myGamertag) ?? '';
      const matchInfo: MatchInfo = {
        matchId: myActiveMatch.matchId,
        slot: myActiveMatch.p1 === myGamertag ? 'player1' : 'player2',
        opponent: { id: opponent, username: opponent, level: 1 },
      };
      return (
        <div className="tournament-container tournament-match-wrap">
          <TournamentMatch
            key={myActiveMatch.matchId}
            matchInfo={matchInfo}
            fighter={fighter}
            code={code}
            onDone={() => markMatchFinished(myActiveMatch.matchId)}
          />
        </div>
      );
    }

    // Bracket waiting room.
    const me = roster.find((p) => p.gamertag === myGamertag);
    const eliminated = !!me?.eliminated;
    let statusLine: string;
    if (eliminated) {
      statusLine = 'You were eliminated — spectating';
    } else {
      const nextMatch = matches.find(
        (m) =>
          (m.p1 === myGamertag || m.p2 === myGamertag) &&
          !m.winner &&
          !finishedMatchIds.has(m.matchId),
      );
      if (nextMatch) {
        const nextOpp = opponentOf(nextMatch, myGamertag);
        statusLine = nextOpp ? `Next match: vs ${nextOpp}` : 'Waiting for your next opponent…';
      } else {
        statusLine = 'Waiting for your next opponent…';
      }
    }

    return (
      <div className="tournament-container">
        <div className="tournament-live-header">
          <h2>Tournament {tournamentState.code}</h2>
          <p className={`tournament-status-line ${eliminated ? 'is-eliminated' : ''}`}>{statusLine}</p>
        </div>
        <TournamentBracket matches={matches} myGamertag={myGamertag} champion={champion} />
      </div>
    );
  }

  // ---- Finished ----
  const iAmChampion = !!champion && champion === myGamertag;
  return (
    <div className="tournament-container">
      <div className={`tournament-champion ${iAmChampion ? 'is-me' : ''}`}>
        {iAmChampion && <div className="tournament-champion-crown">{'\u{1F451}'}</div>}
        <h1 className="tournament-champion-title">
          {champion ?? 'Nobody'} WINS THE TOURNAMENT
        </h1>
        {iAmChampion && <p className="tournament-champion-sub">You are the champion!</p>}
      </div>
      <TournamentBracket matches={matches} myGamertag={myGamertag} champion={champion} />
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            clearStoredTournament();
            window.location.href = '/lobby';
          }}
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
