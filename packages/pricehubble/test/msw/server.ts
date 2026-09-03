import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { standardHandler } from './handlers.js';

export const mswServer = setupServer(...standardHandler);

/**
 * `onUnhandledRequest: 'error'` ist der Netzwerk-Interceptor: Jeder nicht
 * abgedeckte ausgehende Request wird zum Testfehler. Damit ist
 * Entkopplungskriterium (a) maschinell belegt statt zugesichert.
 */
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
