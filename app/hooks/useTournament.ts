'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { Fighter, TournamentState, BracketSize } from '../../lib/types';
import { getGamertag, getSessionToken } from '../lib/api';

/**
 * Manages ONE persistent WebSocket to /ws/tournament/{code} for the whole
 * lifetime of a tournament. Mirrors the connection machinery in
 * `useMatchRoom` (dev port-3001 detection, prod session token, dev gamertag
 * param, exponential-backoff reconnect, cleanup on unmount).
 *
 * The socket stays open across individual matches — match combat uses its
 * own separate `useMatchRoom` connection.
 */
export function useTournament(code: string | null, fighter: Fighter | null) {
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const [myGamertag, setMyGamertag] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const cleanedUpRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  // Bumped to force a reconnect after an explicit `reconnect()` call.
  const [reconnectNonce, setReconnectNonce] = useState(0);

  useEffect(() => {
    if (!code || !fighter) return;

    cleanedUpRef.current = false;
    setConnected(false);
    setError(null);
    setCloseCode(null);

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsHost = isDev ? window.location.hostname + ':3001' : window.location.host;

    async function connectWs() {
      if (cleanedUpRef.current || !code || !fighter) return;

      let token: string;
      try {
        token = await getSessionToken();
      } catch {
        setError('Could not authenticate. Please sign in again.');
        return;
      }

      // Close any existing connection before opening a new one.
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }

      const devParam = isDev ? `&gamertag=${encodeURIComponent(getGamertag() || '')}` : '';
      const url = `${proto}//${wsHost}/ws/tournament/${code}?token=${token}&fighterId=${fighter.id}${devParam}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onerror = () => { /* surfaced via onclose */ };

      ws.onmessage = (e) => {
        let msg: { type?: string; code?: string; yourGamertag?: string; state?: TournamentState; message?: string };
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'tournament_joined':
            retryCountRef.current = 0;
            if (msg.yourGamertag) setMyGamertag(msg.yourGamertag);
            break;

          case 'state':
            retryCountRef.current = 0;
            if (msg.state) setTournamentState(msg.state);
            break;

          case 'error':
            setError(msg.message || 'Tournament error');
            break;
        }
      };

      ws.onclose = (ev) => {
        setConnected(false);
        if (cleanedUpRef.current) return;

        // Fatal close codes — do not reconnect.
        if (ev.code === 4002 || ev.code === 4003 || ev.code === 4004) {
          setCloseCode(ev.code);
          setError(
            ev.code === 4002 ? 'That fighter is not valid for this tournament.' :
            ev.code === 4003 ? 'This tournament has already started.' :
            'This tournament is full.',
          );
          return;
        }

        // Give up after too many failed reconnects.
        retryCountRef.current++;
        if (retryCountRef.current > 12) {
          setError('Lost connection to the tournament.');
          return;
        }
        // Exponential backoff: 500ms, 750ms, 1s... capped at ~3s.
        const delay = Math.min(500 * Math.pow(1.5, retryCountRef.current - 1), 3000);
        reconnectTimerRef.current = setTimeout(connectWs, delay);
      };
    }

    connectWs();

    return () => {
      cleanedUpRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [code, fighter, reconnectNonce]);

  const setBracketSize = useCallback((size: BracketSize) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_bracket_size', size }));
    }
  }, []);

  const startTournament = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start' }));
    }
  }, []);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    setError(null);
    setCloseCode(null);
    setReconnectNonce(n => n + 1);
  }, []);

  const isAdmin = !!tournamentState && tournamentState.adminGamertag === myGamertag && myGamertag !== '';

  return {
    tournamentState,
    connected,
    error,
    closeCode,
    isAdmin,
    myGamertag,
    setBracketSize,
    startTournament,
    reconnect,
  };
}
