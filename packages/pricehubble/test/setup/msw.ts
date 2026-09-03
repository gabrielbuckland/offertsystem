/**
 * Zentrale Testvorbereitung der Projekte `pricehubble` und `contract`.
 * Eingebunden wird sie in `vitest.workspace.ts`, nicht paketlokal (PE-12).
 *
 * Zweck: AK-07 — in `test:unit` darf kein Netzwerkzugriff stattfinden.
 *
 * P1 hatte hier eine Sperre auf der globalen `fetch`-Funktion, solange es keinen
 * Adaptercode gab. Diese Fassung loest sie ab: Der MSW-Server mit
 * `onUnhandledRequest: 'error'` ist die genauere Durchsetzung derselben Zusage —
 * er laesst die abgedeckten Aufrufe zu und macht jeden nicht abgedeckten ausgehenden
 * Request zum Testfehler. Damit ist das Entkopplungskriterium (a) maschinell belegt
 * statt zugesichert.
 *
 * Die Lebenszyklushaken stehen in `../msw/server.ts`; dieser Import registriert sie.
 */
import '../msw/server.js';
