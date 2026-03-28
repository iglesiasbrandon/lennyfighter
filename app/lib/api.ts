/**
 * Client-side API helper for LennyFighter.
 *
 * Uses gamertag from localStorage as the sole identity mechanism.
 */

import type { ApiResponse } from '../../lib/types';

const API_BASE = '/api/v1';

const GAMERTAG_KEY = 'lennyfighter_gamertag';

export function getGamertag(): string | null {
  if (typeof window === 'undefined') return null;
  // Migrate legacy keys on read
  const legacy = localStorage.getItem('lf_gamertag') || localStorage.getItem('username');
  if (!localStorage.getItem(GAMERTAG_KEY) && legacy) {
    localStorage.setItem(GAMERTAG_KEY, legacy);
    localStorage.removeItem('lf_gamertag');
    localStorage.removeItem('username');
    return legacy;
  }
  return localStorage.getItem(GAMERTAG_KEY);
}

export function getUsername(): string | null {
  return getGamertag();
}


async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  return res.json() as Promise<ApiResponse<T>>;
}

export async function checkUsername(username: string) {
  return apiFetch<{ available: boolean }>(`/players/check?username=${encodeURIComponent(username)}`);
}

// ---- Items ----

export async function getShopItems() {
  return apiFetch('/items');
}

export async function purchaseItem(itemId: string) {
  const gamertag = getGamertag();
  return apiFetch('/items', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, gamertag }),
  });
}

export async function getInventory() {
  const gamertag = getGamertag();
  if (!gamertag) return { success: false, error: { code: 'NO_GAMERTAG', message: 'No gamertag set' } } as ApiResponse;
  return apiFetch(`/items/inventory?gamertag=${encodeURIComponent(gamertag)}`);
}

export async function consumeItem(itemId: string) {
  const gamertag = getGamertag();
  return apiFetch<{ item_id: string; remaining: number; message: string }>('/items/consume', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, gamertag }),
  });
}

// ---- Session Token ----

const SESSION_TOKEN_KEY = 'lf_session_token';

export async function getSessionToken(): Promise<string> {
  // Return cached token if exists
  if (typeof window === 'undefined') throw new Error('No window');
  const cached = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (cached) return cached;

  const gamertag = getGamertag();
  if (!gamertag) throw new Error('No gamertag set');

  const res = await fetch('/api/v1/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gamertag }),
  });

  const data = (await res.json()) as { success: boolean; data?: { token: string }; error?: { message: string } };
  if (!data.success || !data.data?.token) {
    throw new Error(data.error?.message || 'Failed to get session token');
  }

  sessionStorage.setItem(SESSION_TOKEN_KEY, data.data.token);
  return data.data.token;
}

export function clearSessionToken(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
}
