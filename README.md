# Offertsystem — Prototyp zur Bachelorarbeit

Interaktives Offertsystem mit dynamischer Immobilienbewertung über die
PriceHubble-API. Der Prototyp gehört zur Bachelorarbeit «Konzeption und
Implementierung eines interaktiven Offertsystems mit dynamischer
Immobilienbewertung mittels PriceHubble-API» (HSLU). Herleitung, Modell und
Nachweise stehen im Bericht; dieses Repository enthält die Implementierung
samt Prüf- und Auswertungswerkzeugen.

## Voraussetzungen

- Node.js ≥ 22.6 (`.nvmrc`: 22.11.0), npm.
- Einmalig: `npm ci` in der Repo-Wurzel (npm-Workspaces, installiert alles).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `packages/core` | Berechnungskern, reine Logik ohne I/O: Domänenmodell (Aggregate Root `Liegenschaft`), Konfigurationsschema mit drei Prüfebenen (Struktur, Wertebereiche, fachliche Invarianten), fünfstufige Berechnungspipeline (`src/pipeline/`), Normalisierungsstrategien, `ValuationProvider`-Port, `Result`-Typ mit textfreien Fehlercodes |
| `packages/pricehubble` | Adapter zur PriceHubble-API: HTTP-Client mit Zeitlimit/Retry/Backoff, Token-Haltung, Zod-Contract-Schemata, ACL-Mapping der Bewertung und Lagescores, totale Fehlerabbildung. Provider-Factory mit drei Betriebsarten (mock/fixture/pricehubble) |
| `packages/offer` | Offert-Datenobjekt (Zod-Schema), Herkunftsträger `Provenanced<T,P>`, Schweizer Zahlenformatierung, HTML-Vorlagen (Kundendokument `VermarktungsOfferte`, interne Rechenweg-Ansicht), Druck-Stylesheet für den PDF-Export |
| `apps/web` | Next.js-Anwendung (App Router unter `src/app/`): Projektübersicht und -detailseite (`/projekte`), Einstellungen mit Firmen- und Projektebene (`/einstellungen`), Offert-Ansicht und Druckseite (`/offerte/[id]`), API-Routen unter `src/app/api/` (u. a. `projekt`, `offerte`, `einstellungen`, `vorlage`) |
| `tools/` | Werkzeuge ausserhalb der Anwendung: `check-deps.ts` (Deklarationsdisziplin), `record-fixtures.ts` (API-Aufzeichnung), `beispiel-offerte.ts`, `eval/` (Auswertungen, siehe unten) |
| `config/` | Fachliche Laufzeitkonfiguration `company-defaults.json` plus Varianten (`*.erweitert.json`, `*.strategie.json`). Beträge durchgängig in Rappen; Herleitung aller Zahlenwerte in `config/README.md` |
| `fixtures/pricehubble` | Aufgezeichnete, anonymisierte API-Antworten für den Fixture-Betrieb (MSW) und die Contract-Tests |
| `data/` | Lokale Ablagen (gitignored): `offerten/` append-only, `projekte/` veränderliche Arbeitsstände |
| `artifacts/` | Nachweisartefakte der Test- und Auswertungsläufe (gitignored, siehe «Artefakte lesen») |

## Anwendung starten

```bash
npm run dev      # http://localhost:3000
```

Ohne weitere Konfiguration läuft die Anwendung im **Mock-Betrieb**
(`VALUATION_PROVIDER=mock`): Bewertungen kommen aus einem Interface-Mock,
es ist kein API-Zugang nötig. Einstieg ist die Projektübersicht unter
`/projekte`; die Startseite leitet dorthin weiter.

Für andere Betriebsarten `.env.example` (Repo-Wurzel) als Vorlage nehmen und
die Werte in `apps/web/.env.local` eintragen:

- `VALUATION_PROVIDER=fixture` — reserviert für den Betrieb gegen
  aufgezeichnete Antworten. **Bekannte Einschränkung:** Im Dev-Betrieb derzeit
  baugleich mit `pricehubble` (echter Adapter, echtes `fetch`), weil der
  MSW-Ersatz nur in der Testumgebung greift — braucht also ebenfalls
  PH-Zugang. Die Contract-Tests nutzen die Fixtures dagegen ohne Zugang.
- `VALUATION_PROVIDER=pricehubble` — echte API. Braucht `PH_BASE_URL`,
  `PH_DOSSIER_ID` und entweder `PH_USERNAME`/`PH_PASSWORD` oder einen von Hand
  besorgten `PH_ACCESS_TOKEN`.

`npm run build` erzeugt den Produktionsbuild.

## Prüfkette

```bash
npm run verify   # lint + check:deps + typecheck + test:unit + test:contract
```

`verify` ist das Merge-Gate und muss grün sein. Die Teile einzeln:

- `npm run lint` — ESLint inkl. Architektur-Grenzregeln (R1–R4: u. a. kein
  Adapter-Import im Kern, keine Deep Imports in Workspace-Pakete).
- `npm run check:deps` — jede Abhängigkeit ist im nutzenden Paket deklariert.
- `npm run typecheck` — TypeScript-Projektreferenzen; läuft ohne vorherigen
  Next-Build.
- `npm run test:unit` — Vitest-Projekte `core`, `pricehubble`, `offer`, `web`,
  `tools`.
- `npm run test:contract` — Contract-Tests gegen die aufgezeichneten
  PriceHubble-Fixtures.
- `npm run test:coverage` — Abdeckung nach `artifacts/coverage/`.

Hinweise:

- Jeder Vitest-Lauf schreibt über den Reporter ein Testartefakt nach
  `artifacts/tests/`. Parallel laufende Vollläufe überschreiben sich
  gegenseitig; für Teilläufe darum `npx vitest run <pfad> --reporter=default`.
- `packages/core/test/arch/formelverweise.test.ts` prüft die Formelverweise
  der Kern-Quelldateien gegen die `eq:`-Labels des Berichts. Er findet das
  Berichtsrepo über `BA_MAIN` oder als Nachbarverzeichnis `../bachelorarbeit`;
  fehlt beides, schlägt er absichtlich fehl statt leer grün zu laufen.
- Kennungen in Testnamen (`I-*`, `E-*`, `PE-*`, `AK-*`, `NFA-*`, `US-*`,
  `A-*`, `CFG_*`, `F-*`) sind die Traceability zu den Anforderungen der
  Arbeit; Anhang A5 des Berichts wird aus ihnen generiert.

## Auswertungswerkzeuge

Die Läufe für Kapitel 6 und die Anhänge des Berichts. `eval:report` sammelt
die jeweils jüngsten Artefakte und bricht ab, wenn eines fehlt — darum die
Reihenfolge einhalten (oder `npm run eval:all` verwenden):

| Befehl | Zweck | Artefakt |
|---|---|---|
| `npm run eval:config` | Konfigurationsvalidierung: Positivlauf je Prüfebene plus Negativmatrix | `artifacts/config/` |
| `npm run eval:oat` | Sensitivitätsanalyse One-at-a-Time über die Faktorgewichte, mit Renormalisierung | `artifacts/eval/oat/` (CSV) |
| `npm run eval:degression-margin` | Netto-Degression der Honorarstaffel, analytisch ohne Pipeline-Lauf | `artifacts/eval/degression/` |
| `npm run eval:tornado` | Tornado-Diagramme (Vektor-PDF) aus der OAT-Ausgabe | `artifacts/eval/tornado/` |
| `npm run eval:report` | Erzeugt die LaTeX-Fragmente des Berichts (Anhang A5, Kapitel-6-Tabellen) aus den gesammelten Artefakten | `$BA_MAIN/appendix/generated/`, `$BA_MAIN/chapters/generated/` |
| `npm run beispiel:offerte` | Beispiel-Offerte im Mock-Betrieb; wird von `eval:report` gegengeprüft | `data/offerten/` |
| `npm run test:record` | Zeichnet echte API-Antworten als anonymisierte Fixtures auf (braucht PH-Zugang) | `fixtures/pricehubble/` |

`eval:report` verlangt die Umgebungsvariable `BA_MAIN` (Pfad zum
Berichtsrepository) und rät kein Verzeichnis. Beispiel:

```bash
BA_MAIN="../bachelorarbeit" npm run eval:report
```

## Artefakte lesen

- Jeder Lauf legt `artifacts/<instrument>/<zeitstempel>/` an und setzt einen
  Zeiger `latest.json` auf den jüngsten Lauf. Der Sammler von `eval:report`
  liest ausschliesslich über diese Zeiger.
- Die Test- und Eval-Läufe tragen einen Laufkopf (`run-meta.json` bzw.
  Kopfteil der Artefaktdatei) mit Commit, Seed und Node-Version — das ist der
  Reproduzierbarkeitsnachweis: gleicher Stand + gleicher Seed = gleiche
  Zahlen. Ausnahme: `artifacts/config/` (`eval:config`) führt keinen Laufkopf.
- Property-Tests laufen mit fixiertem Seed (`20260816`); Abweichungen zwischen
  zwei Läufen auf demselben Stand sind darum ein Befund, kein Rauschen.

## Konventionen

- Fachbegriffe (Typen, Funktionen, Felder) deutsch, technische Struktur
  (Verzeichnisse, Schichtbegriffe) englisch; Dateinamen `kebab-case`,
  React-Komponenten `PascalCase.tsx`, reine Logik neben einer Komponente als
  `<name>-logik.ts`.
- Jede Nicht-Index-Quelldatei in `packages/core/src` trägt in den ersten
  20 Zeilen einen `eq:`-Formelverweis auf den Bericht oder den Vermerk
  «Keine Formel» (per Architekturtest erzwungen).
- Beträge sind ganzzahlige Rappen, gerechnet wird ohne Gleitkomma-Franken;
  der Rundungsmodus steht in `packages/core/src/domain/geld.ts`, die
  Skalierungslogik in `packages/core/src/modell/skalierung.ts`.
