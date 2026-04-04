import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse, jsonResponse } from './utils';

// ---- jsonResponse ----

describe('jsonResponse', () => {
  it('sets Content-Type to application/json', () => {
    const res = jsonResponse({ hello: 'world' });
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('defaults to status 200', () => {
    const res = jsonResponse({ ok: true });
    expect(res.status).toBe(200);
  });

  it('uses custom status code', () => {
    const res = jsonResponse({ error: true }, 500);
    expect(res.status).toBe(500);
  });

  it('serializes body as JSON', async () => {
    const data = { key: 'value', num: 42 };
    const res = jsonResponse(data);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toEqual(data);
  });
});

// ---- successResponse ----

describe('successResponse', () => {
  it('returns success: true with data', async () => {
    const res = successResponse({ items: [1, 2, 3] });
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [1, 2, 3] });
  });

  it('includes pagination when provided', async () => {
    const pagination = { page: 1, per_page: 10, total: 50 };
    const res = successResponse({ items: [] }, pagination);
    const body = await res.json() as Record<string, unknown>;
    expect(body.pagination).toEqual(pagination);
  });

  it('omits pagination when not provided', async () => {
    const res = successResponse({ items: [] });
    const body = await res.json() as Record<string, unknown>;
    expect(body.pagination).toBeUndefined();
  });
});

// ---- errorResponse ----

describe('errorResponse', () => {
  it('returns success: false with error details', async () => {
    const res = errorResponse('NOT_FOUND', 'Player not found', 404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Player not found');
  });

  it('uses the provided status code', () => {
    const res = errorResponse('BAD_REQUEST', 'Invalid input', 400);
    expect(res.status).toBe(400);
  });

  it('defaults to status 400', () => {
    const res = errorResponse('VALIDATION', 'Bad data');
    expect(res.status).toBe(400);
  });
});
