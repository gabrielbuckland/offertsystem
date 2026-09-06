import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { standardHandler } from './handlers.js';

export const mswServer = setupServer(...standardHandler);

// `onUnhandledRequest: 'error'`: jeder nicht abgedeckte Request wird zum Testfehler —
// Entkopplungskriterium (a) so maschinell belegt statt nur zugesichert.
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
