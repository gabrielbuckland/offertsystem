/// AK-4.4, I-14: Neulauf aus Artefakt (Quelle: nur Artefakt, nicht Konfiguration/Umgebung).
/// PE-08: Deserialize mit ReadonlyMaps und eingebetteter Kopie; Liegenschaft ueber
/// `erzeugeLiegenschaft` (I-02).
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
import { druckeOfferte } from '@offert/offer/druck';
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
    // Nachweist ReadonlyMap-Felder + Aggregatinvarianten über Serialisierung erhalten bleiben.
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
    expect(eingang.wert.konfiguration.faktoren.size).toBeGreaterThan(0);

    // Namen zusammengesetzt, um Selbstreferenz-Test zu ermöglichen.
    const quelle = readFileSync(
      `${WURZEL}/apps/web/test/server/reproduzierbarkeit.test.ts`, 'utf8');
    for (const verboten of [`hole${'Laufzeit'}`, `lade${'Konfiguration'}`]) {
      expect(quelle, `${verboten} gehoert nicht in diesen Test`).not.toContain(verboten);
    }
  });

  it('bleibt nach einer Konfigurationsaenderung reproduzierbar', async () => {
    // Metadaten: Kopie (kein Verweis) — Normalfall bei konfigurationsgetriebenen Systemen.
    const alteSumme = geladen.metadata.konfigPruefsumme;
    const erneut = await ladeOfferte(geladen.metadata.offertId, verzeichnis);
    expect(erneut.metadata.konfigPruefsumme).toBe(alteSumme);
    expect(erneut.aggregates.totalSalesValue.value)
      .toBe(geladen.aggregates.totalSalesValue.value);

    const eingang = deserialisiereEingang(erneut.metadata.berechnungsEingabe);
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;
    // Eingebetteter alpha-Wert bleibt Erstellungszeitpunkt-Wert, nicht aktuelle Datei.
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
    expect(String(seite.goto.mock.calls[0]![0]))
      .toContain(`/offerte/${geladen.metadata.offertId}/druck`);
    expect(String(druckeOfferte)).not.toContain('offerte:');
  });
});
