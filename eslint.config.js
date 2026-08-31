import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// tools/ ist Teil der Quellenmenge (PE-20): Dort entstehen Negativmatrix und Nachweisartefakt.
const QUELLEN = ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}', 'tools/**/*.ts'];

// Wiederholt in jedem Block, weil no-restricted-imports nicht additiv ist:
// fuer dieselbe Regel gewinnt der zuletzt zutreffende Block vollstaendig.
const KEINE_RELATIVEN_PAKETPFADE = {
  group: ['**/../../packages/*', '**/../../../packages/*', '**/../../apps/*'],
  message: 'Pakete werden ausschliesslich ueber @offert/* importiert.',
};

// R4: Paketgrenzen — keine Deep Imports, Verkehr nur ueber Einstiegspunkte. Wiederholt
// in jedem Block aus demselben Grund wie KEINE_RELATIVEN_PAKETPFADE (Zeile 7-8); der
// Basis-Block unten deckt tools/, das von keiner spezifischeren Regel erfasst wird.
const KEIN_DEEP_IMPORT = {
  group: ['@offert/*/src/**'],
  message: 'R4: Paketgrenzen — keine Deep Imports, Verkehr nur ueber Einstiegspunkte '
         + '(z. B. @offert/offer, @offert/offer/druck).',
};

// Verbietet src/ -> test/ Importe. Dateibezogen (Endungsmuster statt Verzeichnismuster)
// formuliert, weil `no-restricted-imports` `group` mit gitignore-Semantik auswertet: ein
// Verzeichnismuster wie `../*` erfasst den ganzen Paketinhalt und traefe damit auch den
// regulaeren Weg `test/**` -> `src/**`. Ausserdem liesse sich unterhalb eines
// ausgeschlossenen Verzeichnisses keine Datei per Ausnahme wieder aufnehmen (PE-10).
const KEIN_TESTCODE_IN_SRC = [
  '../**/test/**/*.ts', '../**/test/**/*.tsx',
  '../**/test/**/*.js', '../**/test/**/*.mjs',
  '../**/test/**/*.json',
];

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
  // `no-undef` ist auf TypeScript redundant und meldet auf Nicht-Projekt-Dateien
  // (vitest.*.ts) faelschlich Web-Globale wie `URL`; `tsc` prueft das schaerfer.
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

      // Unterstrich-Praefix = projektweite Kennzeichnung fuer absichtlich ungenutzt,
      // analog zu TypeScripts `noUnusedParameters`.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Eine Portmethode mit Promise-Rueckgabe bleibt vertragsgemaess `async`, auch wenn
      // eine Testfassung nichts awaitet.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // R4 (Basis) — gilt fuer die ganze Quellenmenge, insbesondere tools/, das keine der
  // spezifischeren R1-R3-Bloecke unten erfasst. Fuer packages/** und apps/** wird
  // KEIN_DEEP_IMPORT zusaetzlich in die jeweils zutreffenden Bloecke aufgenommen, weil
  // `no-restricted-imports` je Datei nur den zuletzt zutreffenden Block anwendet.
  {
    files: QUELLEN,
    rules: {
      'no-restricted-imports': ['error', { patterns: [KEIN_DEEP_IMPORT] }],
    },
  },

  // R1a — Der Berechnungskern ist nach aussen abhaengigkeitsfrei (NFA-02, I-03, I-23).
  // Gilt fuer das GANZE Paket inkl. Tests, sonst waere die Abhaengigkeitsfreiheit
  // nur eine Absichtserklaerung.
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
          KEINE_RELATIVEN_PAKETPFADE,
          KEIN_DEEP_IMPORT,
        ],
      }],
    },
  },

  // R1b — Zusaetzlich fuer den QUELLCODE des Kerns: kein Dateisystem, keine Pruefsumme,
  // kein Testcode. Geltungsbereich endet bewusst an `src/`, weil `test/property/` fuer die
  // PE-18-Nachweisartefakte legitim `node:fs` braucht. Muster aus R1a wiederholt, da
  // `no-restricted-imports` nicht additiv ist.
  {
    files: ['packages/core/src/**/*.{ts,tsx}'],
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
            group: KEIN_TESTCODE_IN_SRC,
            message: 'Produktivcode des Kerns importiert nicht aus test/.',
          },
          KEINE_RELATIVEN_PAKETPFADE,
          KEIN_DEEP_IMPORT,
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
          KEIN_DEEP_IMPORT,
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
          KEIN_DEEP_IMPORT,
        ],
      }],
    },
  },

  // R3 — Relativpfade in Schwesterpakete, systemweit.
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/../../packages/*', '**/../../../packages/*'],
            message: 'Pakete werden ausschliesslich ueber @offert/* importiert.' },
          KEIN_DEEP_IMPORT,
        ],
      }],
    },
  },

  // Zugangsdaten werden ausschliesslich in apps/web/src/server gelesen (Spec 01 §7.2).
  // Geltungsbereich `src/**`, nicht das ganze Paket: `packages/core/test/property/` liest
  // legitim `FC_SEED` (Spec 06 §4.2, Property-Seed), keine verdeckte Konfigurationsquelle.
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': ['error', {
        object: 'process',
        property: 'env',
        message: 'Umgebungsvariablen werden ausschliesslich in apps/web/src/server gelesen '
               + 'und dem Paket als Parameter uebergeben (Spec 01 §7.2).',
      }],
    },
  },

  // Die .mjs-Dateien laufen ausserhalb der TypeScript-Projekte, daher ungeprueft.
  { files: ['tools/**/*.mjs'], rules: { 'no-undef': 'off' } },

  // Benannte Ausnahme fuer GENAU eine Datei (PE-10, Pfad nach PE-25): Das Toleranzmodul
  // liest Invariantendefinitionen aus test/property/invariants.json, was R1 sonst
  // verbietet. Die JSON-Datei nach src/ zu verschieben waere keine Verbesserung — sie
  // zaehlte dann als Code und schluege bei der Erweiterbarkeitsmessung (E-15) auf die
  // Null-Dateien-Messlatte durch; E-17 verlangt die Toleranzquelle auf der Testseite.
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
            // Der negierte Eintrag hebt das Verbot fuer genau diese eine Datei auf.
            group: [...KEIN_TESTCODE_IN_SRC, '!../../test/property/invariants.json'],
            message: 'Produktivcode des Kerns importiert nicht aus test/. Einzige Ausnahme: '
                   + 'die Invariantendefinitionen unter test/property/ (E-17, PE-10).',
          },
          KEINE_RELATIVEN_PAKETPFADE,
          KEIN_DEEP_IMPORT,
        ],
      }],
    },
  },
);
