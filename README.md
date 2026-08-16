# Offertsystem — Prototyp

Prototyp zur Bachelorarbeit «Konzeption und Implementierung eines interaktiven
Offertsystems mit dynamischer Immobilienbewertung mittels PriceHubble-API».

## Setup

```bash
nvm use                      # Node >= 22.6, siehe .nvmrc
npm ci
cp .env.example .env.local   # Werte bleiben leer; Vorgabe ist der Mock-Betrieb
npm run verify
```

Ein frisch geklontes Repository laeuft **ohne Zugangsdaten** gruen durch.
`VALUATION_PROVIDER=mock` ist die Vorgabe.

**Node >= 22.6 ist zwingend.** Die Werkzeuge unter `tools/` sind TypeScript und
laufen ueber `node --experimental-strip-types`; sie importieren den Kern relativ
auf `packages/core/src/index.ts`, weil Node das Type-Stripping fuer Dateien aus
`node_modules` verweigert.

## Skripte

| Skript | Zweck |
|---|---|
| `npm run lint` | ESLint inkl. Boundary-Regeln, `--max-warnings=0`; erfasst `packages/`, `apps/` und `tools/` |
| `npm run check:deps` | prueft die `package.json`-Deklarationen gegen die Abhaengigkeitsmatrix |
| `npm run typecheck` | `tsc --build` ueber die Projektreferenzen, danach `tsc -p tools/tsconfig.json` |
| `npm run test:unit` | Vitest ohne Netzwerk, inkl. Testprojekt `tools` |
| `npm run test:contract` | Contract Tests gegen aufgezeichnete Antworten |
| `npm run test:coverage` | Abdeckungsmessung nach `artifacts/coverage/` inkl. `latest.json` |
| `npm test` | `lint && typecheck && test:unit` |
| `npm run verify` | vollstaendige Pruefkette vor jedem Merge |
| `npm run eval:config` | Positivlauf und Negativmatrix der Konfigurationsvalidierung |
| `npm run test:record` | **einziges Skript mit echtem API-Zugriff**; nie Teil von `verify` oder `test` |

Die Erweiterbarkeitsmessung liegt **nicht** hier, sondern im Evaluationsplan.

## Modulgrenzen

| von \ nach | `core` | `pricehubble` | `offer` | `web` |
|---|---|---|---|---|
| `core` | — | nein | nein | nein |
| `pricehubble` | ja | — | nein | nein |
| `offer` | ja | nein | — | nein |
| `web` | ja | ja | ja | — |

Die Richtung wird doppelt durchgesetzt: ESLint-Boundary-Regeln und
TypeScript-Projektreferenzen. Ein Verstoss bricht `lint` **und** `typecheck` ab,
und zwar vor dem ersten Test.

## Konfiguration

`config/company-defaults.json` traegt die firmenweite Berechnungsbasis. Saemtliche
Zahlenwerte sind **vorlaeufig** und vom Auftraggeber zu bestaetigen; die Herleitung
steht in `config/README.md`. Der Ladepfad prueft in drei Ebenen und weist eine
verletzende Konfiguration zurueck, bevor gerechnet wird.

## Nachweisartefakte

| Befehl | Artefakt | Wofuer |
|---|---|---|
| `npm run eval:config` | `artifacts/config/<zeitstempel>/config-validation.json` plus `artifacts/config/latest.json` | Positivlauf je Pruefebene und Negativmatrix (Variante → erwarteter Code → tatsaechlicher Code) |
| `npm run test:coverage` | `artifacts/coverage/coverage-summary.json` plus `artifacts/coverage/latest.json` | Testabdeckung |
| — | `docs/testdoku/boundary-negativfall.md` | protokollierter Nachweis, dass die Architekturregel scharf ist |
| — | `packages/core/test/fixtures/config-invalid/negativmatrix.md` | Negativmatrix inkl. konstruktiv ausgeschlossener Faelle |

Jedes Artefaktverzeichnis traegt einen `latest.json`-Zeiger auf den juengsten
Lauf. Der Sammler des Evaluationsplans sucht darueber und nicht ueber ein
Verzeichnismuster; ohne Zeiger bricht er ab.

Die Erweiterbarkeitsmessung wird **nicht** hier erhoben, sondern im
Evaluationsplan.

**Hinweis zum Uebersetzungslauf.** `npm run typecheck` erzeugt ausschliesslich
`.d.ts`, `.d.ts.map` und `.tsbuildinfo` (`emitDeclarationOnly`), wie Spec 01 §4
es beschreibt. Die Werkzeuge unter `tools/` brauchen keine uebersetzte Fassung
des Kerns: Sie laufen ueber `node --experimental-strip-types` direkt auf den
Quellen und loesen die NodeNext-`.js`-Spezifizierer ueber den Haken
`tools/ts-aufloeser.mjs` auf.
