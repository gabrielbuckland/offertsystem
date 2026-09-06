// PE-12: zentrale Testvorbereitung, eingebunden in `vitest.workspace.ts`, nicht paketlokal.
// AK-07: in `test:unit` darf kein Netzwerkzugriff stattfinden; MSW mit
// `onUnhandledRequest: 'error'` (Lebenszyklushaken in `../msw/server.ts`) erzwingt das.
import '../msw/server.js';
