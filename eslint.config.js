import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// tools/ ist Teil der Quellenmenge (PE-20): Dort entstehen Negativmatrix und
// Nachweisartefakt; ungeprueft liefe der Code, der die Nachweise erzeugt.
const QUELLEN = ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}', 'tools/**/*.ts'];

// Wiederholt in jedem Block, weil no-restricted-imports nicht additiv ist:
// fuer dieselbe Regel gewinnt der zuletzt zutreffende Block vollstaendig.
const KEINE_RELATIVEN_PAKETPFADE = {
  group: ['**/../../packages/*', '**/../../../packages/*', '**/../../apps/*'],
  message: 'Pakete werden ausschliesslich ueber @offert/* importiert.',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'artifacts/**',
      'data/**',
      'coverage/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  // `no-undef` ist auf TypeScript redundant und meldet auf Dateien ausserhalb
  // eines TS-Projekts (vitest.workspace.ts, vitest.config.ts) faelschlich
  // eingebaute Web-Globale wie `URL`. Unaufgeloeste Bezeichner findet `tsc`
  // schaerfer und mit Typinformation.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    rules: { 'no-undef': 'off' },
  },
  ...tseslint.configs.recommendedTypeChecked.map((eintrag) => ({ ...eintrag, files: QUELLEN })),
  {
    files: QUELLEN,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
    },
  },

  // R1 — Der Berechnungskern ist nach aussen abhaengigkeitsfrei (NFA-02, I-03, I-23).
  {
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@offert/pricehubble', '@offert/pricehubble/*',
                    '@offert/offer', '@offert/offer/*',
                    '@offert/web', '@offert/web/*'],
            message: 'NFA-02/I-23: Der Berechnungskern darf kein aeusseres Modul kennen. '
                   + 'Zugriff auf Bewertungsdaten ausschliesslich ueber ValuationProvider.',
          },
          {
            group: ['react', 'react-dom', 'next', 'next/*'],
            message: 'Der Kern ist framework-frei (Spec 01 §2.1).',
          },
          {
            group: ['axios', 'node-fetch', 'undici', 'msw', 'playwright', 'playwright-core'],
            message: 'Der Kern kennt keinen HTTP-Client und keinen Browser (Spec 01 §3.2).',
          },
          {
            group: ['fs', 'node:fs', 'fs/*', 'node:fs/*', 'path', 'node:path', 'node:crypto', 'crypto'],
            message: 'Der Kern liest nicht selbst vom Dateisystem und bildet keine Pruefsumme; '
                   + 'die Konfiguration wird ihm uebergeben (NFA-04, I-21, E-26).',
          },
          {
            group: ['../*', '../../*'],
            message: 'Kein Import ueber Paketgrenzen per Relativpfad.',
          },
          KEINE_RELATIVEN_PAKETPFADE,
        ],
      }],
    },
  },

  // R2 — Adapter und Offert-Paket kennen einander nicht und kennen web nicht.
  {
    files: ['packages/pricehubble/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@offert/web', '@offert/web/*'],
            message: 'Kein Paket darf die Zugriffsschicht importieren.' },
          { group: ['@offert/offer', '@offert/offer/*'],
            message: 'Nicht-Kante pricehubble -> offer (Spec 01 §2.2).' },
          KEINE_RELATIVEN_PAKETPFADE,
        ],
      }],
    },
  },
  {
    files: ['packages/offer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@offert/web', '@offert/web/*'],
            message: 'Kein Paket darf die Zugriffsschicht importieren.' },
          { group: ['@offert/pricehubble', '@offert/pricehubble/*'],
            message: 'Nicht-Kante offer -> pricehubble: die Vorlage haengt sonst am '
                   + 'Antwortformat des Anbieters (Spec 01 §2.2, A-13).' },
          KEINE_RELATIVEN_PAKETPFADE,
        ],
      }],
    },
  },

  // R3 — Relativpfade in Schwesterpakete, systemweit; die Paketverbote aus R1/R2
  // werden oben wiederholt, weil no-restricted-imports nicht additiv ist.
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/../../packages/*', '**/../../../packages/*'],
            message: 'Pakete werden ausschliesslich ueber @offert/* importiert.' },
        ],
      }],
    },
  },

  // Zugangsdaten werden ausschliesslich in apps/web/src/server gelesen (Spec 01 §7.2).
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': ['error', {
        object: 'process',
        property: 'env',
        message: 'Umgebungsvariablen werden ausschliesslich in apps/web/src/server gelesen '
               + 'und dem Paket als Parameter uebergeben (Spec 01 §7.2).',
      }],
    },
  },

  // Die .mjs-Dateien des Aufloesungshakens laufen ausserhalb der TypeScript-
  // Projekte und werden deshalb nicht typgeprueft gelintet.
  { files: ['tools/**/*.mjs'], rules: { 'no-undef': 'off' } },

  // Benannte Ausnahme fuer GENAU eine Datei (PE-10, Pfad nach PE-25). P2s
  // Toleranzmodul liest die Invariantendefinitionen aus
  // test/property/invariants.json. Der Pfad verlaesst src/, was R1 sonst verbietet.
  //
  // Die naheliegende Alternative — die JSON-Datei nach src/ verschieben — ist
  // abzulehnen: Sie machte die Toleranzdatei zu Code. Der Messfilter der
  // Erweiterbarkeitsmessung zaehlt alles unter packages/*/src/** als Code; eine
  // Toleranzanpassung im Erweiterungsszenario schluege dann auf die
  // Null-Dateien-Messlatte durch. E-15 verlangt genau das Gegenteil, und E-17
  // verlangt genau eine Toleranzquelle — die auf der Testseite liegen muss.
  {
    files: ['packages/core/src/config/toleranzen.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@offert/pricehubble', '@offert/pricehubble/*',
                    '@offert/offer', '@offert/offer/*',
                    '@offert/web', '@offert/web/*'],
            message: 'NFA-02/I-23: Der Berechnungskern darf kein aeusseres Modul kennen.',
          },
          {
            group: ['react', 'react-dom', 'next', 'next/*'],
            message: 'Der Kern ist framework-frei (Spec 01 §2.1).',
          },
          {
            group: ['fs', 'node:fs', 'fs/*', 'node:fs/*', 'path', 'node:path',
                    'node:crypto', 'crypto'],
            message: 'Der Kern liest nicht selbst vom Dateisystem (NFA-04, I-21, E-26).',
          },
          {
            // Dateibezogen formuliert, nicht verzeichnisbezogen: `no-restricted-imports`
            // wertet `group` mit gitignore-Semantik aus, und dort laesst sich eine
            // Datei nicht wieder aufnehmen, wenn ein *Verzeichnis* darueber
            // ausgeschlossen ist. `../*` schliesst aber genau das aus — naemlich
            // `../..` als Verzeichnis —, weshalb die Ausnahme in der
            // verzeichnisbezogenen Fassung wirkungslos blieb. Die Endungsmuster
            // schliessen nur Dateien aus; erst dadurch greift der negierte Eintrag.
            group: ['../**/*.ts', '../**/*.tsx', '../**/*.js', '../**/*.mjs',
                    '../**/*.json', '!../../test/property/invariants.json'],
            message: 'Kein Import ueber Paketgrenzen per Relativpfad. Einzige Ausnahme: '
                   + 'die Invariantendefinitionen unter test/property/ (E-17, PE-10).',
          },
          KEINE_RELATIVEN_PAKETPFADE,
        ],
      }],
    },
  },
);
