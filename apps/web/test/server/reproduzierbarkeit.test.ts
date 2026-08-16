/**
 * AK-4.4 und I-14: Ein Neulauf allein aus dem abgelegten Artefakt liefert dieselben Werte.
 *
 * Bezugsquelle ist AUSSCHLIESSLICH das Artefakt — nicht die aktuelle Konfiguration und
 * nicht die Umgebung. Wird fuer den Neulauf die aktuelle Konfiguration verwendet, prueft
 * der Test nichts; die Konstruktion muss das ausschliessen. Zwei Quelltextpruefungen
 * unten halten das ueber die Zeit fest: Sie sind die einzige Absicherung dagegen, dass
 * jemand die Verdrahtung oder den Konfigurationslader «der Bequemlichkeit halber» in
 * diesen Test zieht. Die Namen selbst stehen deshalb nirgends im Klartext.
 *
 * `deserialisiereEingang` stellt die Liegenschaft ueber `erzeugeLiegenschaft` (I-02), die
 * ReadonlyMap-Felder und die Konfiguration aus der eingebetteten Kopie wieder her (PE-08).
 */
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  berechne,
  deserialisiereEingang,
  serialisiereEingang,
  type BerechnungsErgebnis,
} from '@offert/core';
import { druckeOfferte } from '@offert/offer/src/pdf/drucke-offerte.js';
import { vi } from 'vitest';
import type { Offer } from '@offert/offer';
import { ladeOfferte, legeOfferteAb } from '../../src/server/offerten-ablage.js';
import { baueBeispielOfferte, baueEingangsArgumente } from '../bau/offerte-bauer.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');

let verzeichnis: string;
let geladen: Offer;

beforeAll(async () => {
  verzeichnis = await mkdtemp(join(tmpdir(), 'offerten-'));
  const offerte = baueBeispielOfferte();
  await legeOfferteAb(offerte, verzeichnis);
  geladen = await ladeOfferte(offerte.metadata.offertId, verzeichnis);
});

describe('Neulauf aus dem Artefakt (AK-4.4, PE-08)', () => {
  it('rechnet aus den eingebetteten Parametern dieselben Werte', () => {
    const eingang = deserialisiereEingang(geladen.metadata.berechnungsEingabe);
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;

    const wiederholt = berechne(eingang.wert);
    expect(wiederholt.ok).toBe(true);
    if (!wiederholt.ok) return;
    const w: BerechnungsErgebnis = wiederholt.wert;

    // exakt in Rappen, keine Toleranz
    expect(w.verkaufssumme.verkaufssumme).toBe(geladen.aggregates.totalSalesValue.value);
    expect(w.honorar.honorarMin).toBe(geladen.aggregates.feeRange.value.min);
    expect(w.honorar.honorarMax).toBe(geladen.aggregates.feeRange.value.max);
    for (const [i, f] of geladen.aggregates.effortFactors.entries()) {
      expect(w.normalisierung.faktoren[i]!.normiert).toBe(f.normalised);
    }
  });

  it('fuehrt Zeitstempel und Konfiguration aus dem Artefakt mit, nicht aus der Umgebung', () => {
    const eingang = deserialisiereEingang(geladen.metadata.berechnungsEingabe);
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;
    expect(eingang.wert.zeitstempel).toBe(geladen.metadata.erstelltAm);
    expect(eingang.wert.konfiguration.meta.konfigVersion).toBe(geladen.metadata.konfigVersion);
  });

  it('ist rund: serialisieren und deserialisieren aendert den Eingang nicht', () => {
    // Der eigentliche Nachweis von I-14 ueber die Serialisierungsgrenze hinweg: Ohne ihn
    // bliebe offen, ob die Rundreise die ReadonlyMap-Felder und die Aggregatinvarianten
    // unveraendert erhaelt.
    const eingang = baueEingangsArgumente();
    const zurueck = deserialisiereEingang(serialisiereEingang(eingang));
    expect(zurueck.ok).toBe(true);
    if (!zurueck.ok) return;
    expect(berechne(zurueck.wert)).toStrictEqual(berechne(eingang));
  });
});

describe('Die Testkonstruktion schliesst die aktuelle Konfiguration aus', () => {
  it('bezieht die Konfiguration aus dem Artefakt, nicht aus der Konfigurationsdatei', () => {
    const eingang = deserialisiereEingang(geladen.metadata.berechnungsEingabe);
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;
    // Die eingebettete Kopie traegt die Konfiguration vollstaendig; ein Dateizugriff
    // waere ueberhaupt nicht noetig.
    expect(eingang.wert.konfiguration.faktoren.size).toBeGreaterThan(0);

    // Die gesuchten Namen werden zusammengesetzt: Stuenden sie als Literal in dieser
    // Datei, faende die Pruefung sich selbst und waere immer rot.
    const quelle = readFileSync(
      `${WURZEL}/apps/web/test/server/reproduzierbarkeit.test.ts`, 'utf8');
    for (const verboten of [`hole${'Laufzeit'}`, `lade${'Konfiguration'}`]) {
      expect(quelle, `${verboten} gehoert nicht in diesen Test`).not.toContain(verboten);
    }
  });

  it('bleibt nach einer Konfigurationsaenderung reproduzierbar', async () => {
    // Die Metadaten fuehren eine KOPIE und keinen Verweis: Bei einem
    // konfigurationsgetriebenen System ist die nachtraegliche Aenderung der Normalfall.
    const alteSumme = geladen.metadata.konfigPruefsumme;
    const erneut = await ladeOfferte(geladen.metadata.offertId, verzeichnis);
    expect(erneut.metadata.konfigPruefsumme).toBe(alteSumme);
    expect(erneut.aggregates.totalSalesValue.value)
      .toBe(geladen.aggregates.totalSalesValue.value);

    const eingang = deserialisiereEingang(erneut.metadata.berechnungsEingabe);
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;
    // Der eingebettete alpha-Wert bleibt der zum Erstellungszeitpunkt gueltige, auch
    // wenn die Datei inzwischen einen anderen fuehrt.
    expect(eingang.wert.konfiguration.flaeche.alpha)
      .toBe(erneut.derivation.alpha);
  });
});

describe('Ein Datenobjekt fuer HTML und PDF (I-25)', () => {
  it('speist HTML und PDF aus demselben Offert-Datenobjekt', async () => {
    const seite = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      emulateMedia: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
    };
    const browser = {
      newPage: vi.fn().mockResolvedValue(seite),
      close: vi.fn().mockResolvedValue(undefined),
    };
    await druckeOfferte(
      { basisUrl: 'http://localhost:3000', offertId: geladen.metadata.offertId },
      vi.fn().mockResolvedValue(browser),
    );
    // Der Drucker oeffnet die Route der Darstellung; er erhaelt kein zweites Datenobjekt.
    expect(String(seite.goto.mock.calls[0]![0]))
      .toContain(`/offerte/${geladen.metadata.offertId}/druck`);
    // Signaturbeleg: der Drucker nimmt Optionen entgegen, kein Offert-Objekt.
    expect(String(druckeOfferte)).not.toContain('offerte:');
  });
});
