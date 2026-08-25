import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AggregatFehlerCode, BerechnungsFehlerCode, ProviderFehler } from '@offert/core';
import {
  AGGREGAT_VORLAGEN,
  KERN_VORLAGEN,
  uebersetzeAggregatFehler,
  uebersetzeProviderFehler,
  uebersetzeStufenFehler,
} from '../../src/server/fehlertexte.js';

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

describe('Platzhalter werden formatiert eingesetzt', () => {
  it('setzt Zahlen in Schweizer Notation ein', () => {
    const text = uebersetzeStufenFehler({
      stufe: 5, code: 'VERKAUFSSUMME_AUSSERHALB',
      parameter: { v: 25_000_000_000, vMin: 100_000_000, vMax: 20_000_000_000 },
    }).text;
    // Tausendertrennung U+2019, wie `de-CH` sie setzt (siehe packages/offer/test/format).
    expect(text).toContain('CHF 250’000’000');
    expect(text).toContain('Die Honorarstaffelung ist zu erweitern.');
  });

  it('unterscheidet die beiden Faelle von ANPASSUNG_UNZULAESSIG ueber den Parameter grund', () => {
    const modell = uebersetzeStufenFehler({
      stufe: 2, code: 'ANPASSUNG_UNZULAESSIG',
      parameter: { grund: 'modell', wohnungsnummer: 'A3', z: -1.2 },
    }).text;
    expect(modell).toContain('grösser als −1');
    const konfig = uebersetzeStufenFehler({
      stufe: 2, code: 'ANPASSUNG_UNZULAESSIG',
      parameter: { grund: 'konfiguration', wohnungsnummer: 'A3', z: 0.4,
                   min: -0.2, max: 0.2, anpassungsliste: ['Aussicht +40 %'] },
    }).text;
    expect(konfig).toContain('ausserhalb des zulässigen Bereichs');
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
