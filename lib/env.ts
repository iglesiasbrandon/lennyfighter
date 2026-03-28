import { AsyncLocalStorage } from 'node:async_hooks';
import type { Env } from './types';

/**
 * AsyncLocalStorage-backed env accessor for API routes.
 *
 * The Worker entry point calls `runWithEnv(env, fn)` to make
 * the Cloudflare bindings available to all downstream code
 * (API routes, middleware, etc.) without threading env through
 * every function signature.
 */
const envStorage = new AsyncLocalStorage<Env>();

export function runWithEnv<T>(env: Env, fn: () => T | Promise<T>): T | Promise<T> {
  return envStorage.run(env, fn);
}

export function getEnv(): Env {
  const env = envStorage.getStore();
  if (!env) {
    throw new Error('getEnv() called outside of request context. Ensure runWithEnv() wraps the handler.');
  }
  return env;
}
