import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  berechne,
  rappen,
  validiereKonfiguration,
  type AggregatFehlerCode,
  type BerechnungsFehlerCode,
  type EingangsArgumente,
  type Konfiguration,
  type ProviderFehler,
  type Quadratmeter,
  type KonfigurationsFehler,
  type StufenFehler,
} from '@offert/core';
// Modulpfad wie in `fehlertexte.ts` selbst (PE-09): Der Paketindex zoege die
// React-Komponenten nach, fuer die Node kein Type-Stripping leistet.
import {
  formatiereAggregat, formatiereProzent, formatiereScore,
} from '@offert/offer/src/format/de-ch.js';
import {
  AGGREGAT_VORLAGEN,
  KERN_VORLAGEN,
  KONFIG_VORLAGEN,
  uebersetzeKonfigFehler,
  uebersetzeAggregatFehler,
  uebersetzeProviderFehler,
  uebersetzeStufenFehler,
} from '../../src/server/fehlertexte.js';
import { baueEingangsArgumente } from '../bau/offerte-bauer.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');

describe('Vollstaendigkeit der Abbildung', () => {
  it('bildet jeden BerechnungsFehlerCode ab', () => {
    const codes: readonly BerechnungsFehlerCode[] = [
      'NORM_GRENZEN_IDENTISCH', 'FAKTOR_FEHLT', 'REFERENZBEWERTUNG_FEHLT',
      'REFERENZFLAECHE_NULL', 'GEWICHTSSUMME_UNGUELTIG', 'ANPASSUNG_UNZULAESSIG',
      'STUFE_ENTARTET', 'VERKAUFSSUMME_AUSSERHALB',
    ];
    for (const code of codes) {
      expect(Object.keys(KERN_VORLAGEN)).toContain(code);
    }
    expect(Object.keys(KERN_VORLAGEN)).toHaveLength(codes.length);
  });

  it('bildet jeden AggregatFehlerCode ab', () => {
    const codes: readonly AggregatFehlerCode[] = [
      'WOHNUNGSNUMMER_DOPPELT', 'WOHNUNGSTYP_UNBEKANNT', 'ZIMMERZAHL_MEHRFACH',
      'WOHNUNGSTYP_OHNE_EINHEIT', 'KEINE_EINHEIT',
    ];
    for (const code of codes) {
      expect(Object.keys(AGGREGAT_VORLAGEN)).toContain(code);
    }
    expect(Object.keys(AGGREGAT_VORLAGEN)).toHaveLength(codes.length);
  });
});

/**
 * Regressionsanker fuer den gemeldeten Befund: Die Oberflaeche zeigte vor dieser
 * Uebersetzung den rohen Fehlercode samt JSON-Parametern an, z. B.
 * `WOHNUNGSTYP_OHNE_EINHEIT ({"wohnungstypen":["R2"]})`.
 */
describe('uebersetzeAggregatFehler', () => {
  it('uebersetzt WOHNUNGSTYP_OHNE_EINHEIT in einen lesbaren Satz, nicht den rohen Code', () => {
    const text = uebersetzeAggregatFehler([
      { code: 'WOHNUNGSTYP_OHNE_EINHEIT', parameter: { wohnungstypen: ['R2'] } },
    ]);
    expect(text).not.toContain('WOHNUNGSTYP_OHNE_EINHEIT');
    expect(text).not.toContain('{');
    expect(text).toContain('R2');
    expect(text).toContain('noch keine Einheit erfasst');
  });

  it('verbindet mehrere Aggregatfehler zu einem Text', () => {
    const text = uebersetzeAggregatFehler([
      { code: 'KEINE_EINHEIT', parameter: {} },
      { code: 'WOHNUNGSNUMMER_DOPPELT', parameter: { wohnungsnummern: ['A1', 'A2'] } },
    ]);
    expect(text).toContain('noch keine Einheit erfasst');
    expect(text).toContain('A1, A2');
    expect(text).toContain('sind mehrfach vergeben');
  });
});

/**
 * Regressionsanker fuer eine Klasse von Fehlern, die hier lange unbemerkt blieb: Die
 * Vorlagen lasen Parameternamen, die der Kern nie liefert — `v`/`vMin`/`vMax` statt
 * `verkaufssumme`/`bereichVon`/`bereichBis`, `k` statt `stufenindex`, `faktorliste` statt
 * `faktoren`, `grund`/`z`/`anpassungsliste` statt `art`/`zSumme`/`anpassungen`. Vier der
 * acht Vorlagen rendeten dadurch `NaN`, `undefined` oder eine leere Aufzaehlung.
 *
 * Die frueheren Tests konnten das nicht sehen, weil sie das `parameter`-Objekt SELBST
 * schrieben, und zwar mit den Namen der Vorlage: Sie prueften die Vorlage gegen sich
 * selbst. Deshalb entsteht hier jeder Fehler so, wie der Kern ihn erzeugt — durch einen
 * echten `berechne`-Lauf ueber eine gezielt verletzte Fixtur. Erst dadurch ist der
 * Parametername Vertragsgegenstand (Spec 03 §8) statt Testannahme.
 *
 * Die Sperre `not.toMatch(/undefined|NaN/)` ist der eigentliche Waechter: Sie haette alle
 * vier Abweichungen gemeldet, unabhaengig vom Wortlaut der jeweiligen Vorlage.
 */
describe('Vorlagen lesen genau die Parameter, die der Kern liefert', () => {
  function scheitert(eingang: EingangsArgumente): StufenFehler {
    const ergebnis = berechne(eingang);
    if (ergebnis.ok) {
      throw new Error('Die Fixtur rechnet durch — sie trifft den zu pruefenden Fall nicht.');
    }
    return ergebnis.fehler;
  }

  function mitKonfiguration(aendere: (k: Konfiguration) => Konfiguration): EingangsArgumente {
    const basis = baueEingangsArgumente();
    return { ...basis, konfiguration: aendere(basis.konfiguration) };
  }

  /** Verkaufssumme des fehlerfreien Laufs — Bezugsgroesse der beiden Stufe-5-Faelle. */
  function verkaufssummeDerFixtur(): number {
    const ergebnis = berechne(baueEingangsArgumente());
    if (!ergebnis.ok) throw new Error('Die Fixtur rechnet nicht mehr durch.');
    return ergebnis.wert.verkaufssumme.verkaufssumme;
  }

  /**
   * Elementtyp ueber die Konfiguration selbst hergeleitet, nicht ueber den gleichnamigen
   * Import: `@offert/core` exportiert ZWEI `Stuetzstelle` — die des Ladeschemas
   * (`config/validieren.js`) und die des Kerns (`config/typen.js`, dort als
   * `KernStuetzstelle`). Nur letztere steht in `Konfiguration`; der naheliegende Import
   * waere die falsche gewesen.
   */
  type Stelle = Konfiguration['honorar']['stuetzstellen'][number];
  const stelle = (v: number): Stelle =>
    ({ v: rappen(v), hMin: rappen(3_000_000), hMax: rappen(4_000_000) });

  interface Fall {
    readonly code: BerechnungsFehlerCode;
    readonly eingang: () => EingangsArgumente;
    /** Bausteine, die im Text stehen muessen — je einer je eingesetztem Parameter. */
    readonly erwartet: () => readonly string[];
  }

  const faelle: readonly (readonly [string, Fall])[] = [
    ['FAKTOR_FEHLT', {
      code: 'FAKTOR_FEHLT',
      eingang: () => ({ ...baueEingangsArgumente(), vermarkterFaktoren: { werte: new Map() } }),
      erwartet: () => ['Qualitaet des Innenausbaus'],
    }],
    ['REFERENZBEWERTUNG_FEHLT', {
      code: 'REFERENZBEWERTUNG_FEHLT',
      eingang: () => ({ ...baueEingangsArgumente(), bewertungen: [] }),
      erwartet: () => ['3.5 Zimmer', 'A1.01, A2.01'],
    }],
    ['NORM_GRENZEN_IDENTISCH', {
      code: 'NORM_GRENZEN_IDENTISCH',
      eingang: () => mitKonfiguration((k) => ({
        ...k,
        faktoren: new Map([...k.faktoren].map(([id, p]) =>
          [id, { ...p, grenzeMin: 5, grenzeMax: 5 }])),
      })),
      erwartet: () => ['Qualitaet des Innenausbaus', formatiereScore(5)],
    }],
    ['REFERENZFLAECHE_NULL', {
      code: 'REFERENZFLAECHE_NULL',
      eingang: () => {
        const basis = baueEingangsArgumente();
        return {
          ...basis,
          liegenschaft: {
            ...basis.liegenschaft,
            wohnungstypen: basis.liegenschaft.wohnungstypen.map((t, i) => (i === 0
              ? {
                ...t,
                parametrisierung: {
                  ...t.parametrisierung,
                  flaecheInnen: 0 as Quadratmeter,
                  flaecheAussen: 0 as Quadratmeter,
                },
              }
              : t)),
          },
        };
      },
      erwartet: () => ['3.5 Zimmer', formatiereScore(0.5)],
    }],
    ['GEWICHTSSUMME_UNGUELTIG', {
      code: 'GEWICHTSSUMME_UNGUELTIG',
      eingang: () => mitKonfiguration((k) => ({
        ...k,
        faktoren: new Map([...k.faktoren].map(([id, p]) =>
          [id, { ...p, gewicht: (p.gewicht + 0.5) as typeof p.gewicht }])),
      })),
      // Die Faktorliste stand wegen `faktorliste` statt `faktoren` immer leer da.
      erwartet: () => ['innenausbau_qualitaet|Qualitaet des Innenausbaus'],
    }],
    ['ANPASSUNG_UNZULAESSIG (Konfigurationsgrenze)', {
      code: 'ANPASSUNG_UNZULAESSIG',
      eingang: () => mitKonfiguration((k) => ({
        ...k, preisanpassung: { ...k.preisanpassung, zMin: -0.001, zMax: 0.001 },
      })),
      erwartet: () => [
        'A1.01', 'ausserhalb des zulässigen Bereichs',
        formatiereProzent(-0.03), 'Nordlage, eingeschraenkte Besonnung',
      ],
    }],
    ['ANPASSUNG_UNZULAESSIG (Modellgrenze)', {
      code: 'ANPASSUNG_UNZULAESSIG',
      eingang: () => {
        const basis = baueEingangsArgumente();
        return {
          ...basis,
          liegenschaft: {
            ...basis.liegenschaft,
            einheiten: basis.liegenschaft.einheiten.map((e, i) => (i === 0
              ? {
                ...e,
                anpassungen: [{
                  faktor: -1.5,
                  begruendung: 'Testfall',
                  erfassungsform: 'relativ' as const,
                }],
              }
              : e)),
          },
        };
      },
      // Zweigwahl ueber `art === 'modellgrenze'`: Mit dem frueheren `grund === 'modell'`
      // landete dieser Fall im Konfigurationszweig — samt NaN-Grenzen.
      erwartet: () => ['A1.01', 'grösser als −1', formatiereProzent(-1.5)],
    }],
    ['VERKAUFSSUMME_AUSSERHALB', {
      code: 'VERKAUFSSUMME_AUSSERHALB',
      eingang: () => mitKonfiguration((k) => ({
        ...k,
        honorar: { ...k.honorar, stuetzstellen: [stelle(0), stelle(1_000)] },
      })),
      erwartet: () => [
        formatiereAggregat(verkaufssummeDerFixtur()),
        formatiereAggregat(0), formatiereAggregat(1_000),
        'Die Honorarstaffelung ist zu erweitern.',
      ],
    }],
    ['STUFE_ENTARTET', {
      code: 'STUFE_ENTARTET',
      eingang: () => {
        const v = verkaufssummeDerFixtur();
        return mitKonfiguration((k) => ({
          ...k,
          honorar: { ...k.honorar, stuetzstellen: [stelle(0), stelle(v), stelle(v)] },
        }));
      },
      erwartet: () => ['Honorarstufe 1', formatiereAggregat(verkaufssummeDerFixtur())],
    }],
  ];

  it.each(faelle)('%s: setzt jeden Platzhalter aus echten Kernparametern', (_name, fall) => {
    const fehler = scheitert(fall.eingang());
    expect(fehler.code).toBe(fall.code);

    const angezeigt = uebersetzeStufenFehler(fehler);
    // Der Waechter: ein nicht gelieferter Parameter wird zu `undefined` oder `NaN`.
    expect(angezeigt.text).not.toMatch(/undefined|NaN/);
    // Und keine leere Aufzaehlung, wie sie ein falsch benannter Listenparameter erzeugt.
    expect(angezeigt.text).not.toMatch(/: \.|\[, |, \]/);
    for (const baustein of fall.erwartet()) {
      expect(angezeigt.text).toContain(baustein);
    }
  });

  it('setzt Zahlen in Schweizer Notation ein', () => {
    const fehler = scheitert(mitKonfiguration((k) => ({
      ...k, honorar: { ...k.honorar, stuetzstellen: [stelle(0), stelle(1_000)] },
    })));
    // Tausendertrennung U+2019, wie `de-CH` sie setzt (siehe packages/offer/test/format).
    expect(uebersetzeStufenFehler(fehler).text).toContain('’');
    expect(uebersetzeStufenFehler(fehler).text).toContain('Die Honorarstaffelung ist zu erweitern.');
  });
});

/**
 * Dieselbe Pruefart wie fuer die Stufenfehler, fuer die Ladezeitcodes: Der
 * `KonfigurationsFehler` entsteht durch echte Kernpruefung ueber eine gezielt verletzte
 * Kopie von `config/company-defaults.json` — nie durch ein handgeschriebenes
 * Parameterobjekt.
 *
 * Die drei Vorlagen sind seit dem Schreibweg der Einstellungen (`einstellungen-ablage.ts`)
 * nicht mehr toter Code: Er ruft `uebersetzeKonfigFehler` fuer genau diese Codes auf und
 * beantwortet damit ein fehlgeschlagenes Speichern mit 422 statt 500. `CFG_STRATEGY_UNKNOWN`
 * WARF zuvor (`liste` rief `.join` auf dem String `verfuegbare` auf) — der erste Fall unten
 * haelt genau diese Regression fest.
 */
describe('Ladezeitvorlagen lesen die Parameter des Konfigurationspruefers', () => {
  const KONFIGURATIONSPFAD = new URL('../../../../config/company-defaults.json', import.meta.url);

  /** Frische Kopie je Fall; die Datei selbst wird nur gelesen. */
  function rohkonfiguration(): Record<string, unknown> {
    return JSON.parse(readFileSync(KONFIGURATIONSPFAD, 'utf8')) as Record<string, unknown>;
  }

  /**
   * `validiereKonfiguration` ist der Weg, den auch der Schreibpfad geht; es meldet die
   * Stuetzstellenbefunde mit, nicht nur die reinen Schemaverstoesse. Gesucht wird gezielt
   * nach dem erwarteten Code: Eine verletzte Fixtur kann mehrere Befunde ausloesen, und
   * `[0]` waere dann von der Reihenfolge abhaengig.
   */
  function befund(roh: Record<string, unknown>, code: string): KonfigurationsFehler {
    const ergebnis = validiereKonfiguration(roh);
    if (ergebnis.ok) throw new Error('Die Fixtur ist gueltig — sie trifft den Fall nicht.');
    const treffer = ergebnis.fehler.find((f) => f.code === code);
    if (treffer === undefined) {
      throw new Error(`${code} nicht gemeldet, stattdessen: `
        + ergebnis.fehler.map((f) => f.code).join(', '));
    }
    return treffer;
  }

  /** Der Aufrufer reicht `KonfigurationsFehler['parameter']` genau so hinein. */
  function angezeigt(f: KonfigurationsFehler) {
    const parameter = f.parameter as unknown as Parameters<typeof uebersetzeKonfigFehler>[1];
    return uebersetzeKonfigFehler(f.code as keyof typeof KONFIG_VORLAGEN, parameter);
  }

  it('CFG_STRATEGY_UNKNOWN nennt Bezeichner und verfuegbare Strategien, ohne zu werfen', () => {
    const roh = rohkonfiguration();
    const faktoren = roh['aufwandfaktoren'] as Record<string, Record<string, unknown>>;
    const ersterFaktor = Object.keys(faktoren)[0]!;
    faktoren[ersterFaktor]!['strategie'] = 'gibt-es-nicht';

    const treffer = befund(roh, 'CFG_STRATEGY_UNKNOWN');
    // Regressionsanker: `verfuegbare` ist ein STRING. Der fruehere `liste`-Zugriff rief
    // `.join` darauf auf und warf `TypeError`, statt einen Satz zu liefern.
    expect(typeof treffer.parameter['verfuegbare']).toBe('string');
    expect(() => angezeigt(treffer)).not.toThrow();

    const text = angezeigt(treffer).text;
    expect(text).not.toMatch(/undefined|NaN/);
    expect(text).toContain('gibt-es-nicht');
    expect(text).toContain(String(treffer.parameter['verfuegbare']));
    // Der Feldanker steckt im Pfad des Befunds, nicht im Satz.
    expect(treffer.pfad).toContain(ersterFaktor);
  });

  it('CFG_TIER_ORDER nennt das konkrete Stuetzstellenpaar statt einer leeren Liste', () => {
    const roh = rohkonfiguration();
    const honorar = roh['honorar'] as Record<string, unknown>;
    const stellen = honorar['stuetzstellen'] as Record<string, number>[];
    stellen[2] = { ...stellen[1]! }; // gleiche Verkaufssumme: Stufenbreite null

    const treffer = befund(roh, 'CFG_TIER_ORDER');

    const text = angezeigt(treffer).text;
    expect(text).not.toMatch(/undefined|NaN/);
    expect(text).toContain(`Stufe ${String(treffer.parameter['stufe'])}`);
    expect(text).toContain(formatiereAggregat(Number(treffer.parameter['vorher'])));
    expect(text).toContain(formatiereAggregat(Number(treffer.parameter['nachher'])));
  });

  it('CFG_TIER_OPEN nennt die tatsaechliche Anzahl Stuetzstellen', () => {
    const roh = rohkonfiguration();
    const honorar = roh['honorar'] as Record<string, unknown>;
    const stellen = honorar['stuetzstellen'] as unknown[];
    honorar['stuetzstellen'] = [stellen[0]];

    const treffer = befund(roh, 'CFG_TIER_OPEN');
    expect(treffer.parameter['anzahl']).toBe(1);

    const text = angezeigt(treffer).text;
    expect(text).not.toMatch(/undefined|NaN/);
    expect(text).toContain('nur 1 Stützstelle');
    expect(text).toContain('mindestens zwei');
  });

  it('richtet alle drei Ladezeitmeldungen an den Auftraggeber', () => {
    const roh = rohkonfiguration();
    const honorar = roh['honorar'] as Record<string, unknown>;
    honorar['stuetzstellen'] = [(honorar['stuetzstellen'] as unknown[])[0]];
    expect(angezeigt(befund(roh, 'CFG_TIER_OPEN')).adressat).toBe('auftraggeber');
  });
});

describe('Fremdsystemfehler (benannte Ausnahme von E-03)', () => {
  it('reicht die Meldung des ACL durch, statt sie erneut abzubilden', () => {
    const fehler: ProviderFehler = {
      art: 'anfrage_abgelehnt',
      detail: 'Die Objektangaben wurden von PriceHubble nicht akzeptiert: livingArea.',
      feld: 'livingArea',
      diagnose: { endpoint: 'dossier.update', httpStatus: 400, versuche: 1, dauerMs: 240 },
    };
    const angezeigt = uebersetzeProviderFehler(fehler);
    expect(angezeigt.text).toBe(fehler.detail);
    expect(angezeigt.text).not.toContain('400');
    expect(angezeigt.text).not.toMatch(/at .*\(/); // keine Stapelverfolgung
  });

  it('zeigt bei Kontingentfehlern die Wartedauer, nicht den Header', () => {
    const angezeigt = uebersetzeProviderFehler({
      art: 'kontingent', wiederholbarNach: 120,
      diagnose: { endpoint: 'dossier.valuation', httpStatus: 429, versuche: 3, dauerMs: 5000 },
    });
    expect(angezeigt.text).toContain('2');
    expect(angezeigt.text).not.toContain('Retry-After');
  });
});

describe('Kein Anzeigetext im Kern (AK-3.9)', () => {
  it('haelt Anzeigetexte aus packages/core heraus', () => {
    const treffer = execSync(
      "grep -rn 'Bitte \\|müssen sich\\|liegt ausserhalb' packages/core/src --include='*.ts' || true",
      { encoding: 'utf8', cwd: WURZEL },
    ).trim();
    expect(treffer).toBe('');
  });
});
