import { describe, expect, it } from 'vitest';
import {
  bildeDelta, effektiveKonfiguration,
} from '../../../src/components/einstellungen/projekt-einstellungen-logik.js';

/**
 * Firmenwerte als Ausschnitt der echten Konfigurationsform: ein tiefer Zahlenwert
 * (`flaeche.alpha`), ein Objekt mit Geschwisterfeldern (`preisanpassung`), eine Liste
 * (`honorar.stuetzstellen`) und die projektbezogen gesperrten Wurzeln `meta`/`api`.
 */
const FIRMA = {
  flaeche: { alpha: 0.5 },
  preisanpassung: { zMin: -0.25, zMax: 0.25 },
  honorar: { stuetzstellen: [{ summe: 1_000_000, hMin: 0.02 }], gMin: 0.85 },
  meta: { version: '1.4.0' },
  api: { baseUrl: 'https://api.example.test', timeoutMs: 8000 },
} as const;

describe('effektiveKonfiguration', () => {
  it('liefert ohne Delta die reinen Firmenwerte', () => {
    expect(effektiveKonfiguration(FIRMA, {})).toEqual(FIRMA);
    expect(effektiveKonfiguration(FIRMA, undefined)).toEqual(FIRMA);
  });

  it('legt einen tiefen Skalar ein und laesst die Geschwisterfelder stehen', () => {
    const effektiv = effektiveKonfiguration(FIRMA, { preisanpassung: { zMax: 0.4 } });
    expect(effektiv['preisanpassung']).toEqual({ zMin: -0.25, zMax: 0.4 });
  });

  it('ersetzt ein Array als Ganzes statt elementweise zu verschmelzen', () => {
    // Elementweises Verschmelzen wuerde eine geloeschte Stuetzstelle wieder einfuehren.
    const effektiv = effektiveKonfiguration(FIRMA, { honorar: { stuetzstellen: [] } });
    expect(effektiv['honorar']).toEqual({ stuetzstellen: [], gMin: 0.85 });
  });

  it('veraendert die uebergebenen Objekte nicht (reine Funktion)', () => {
    const delta = { flaeche: { alpha: 0.6 } };
    effektiveKonfiguration(FIRMA, delta);
    expect(FIRMA.flaeche.alpha).toBe(0.5);
    expect(delta).toEqual({ flaeche: { alpha: 0.6 } });
  });
});

describe('bildeDelta', () => {
  it('liefert fuer einen unveraenderten Entwurf ein leeres Delta', () => {
    // Der tragende Fall: Oeffnen und Speichern ohne Aenderung darf das Projekt NICHT
    // zur Vollkopie der Firmenwerte machen — sonst erreichte es eine spaetere
    // firmenweite Korrektur nie mehr.
    expect(bildeDelta(effektiveKonfiguration(FIRMA, {}), FIRMA)).toEqual({});
  });

  it('nennt fuer einen geaenderten tiefen Skalar genau diesen einen Pfad', () => {
    const entwurf = effektiveKonfiguration(FIRMA, {});
    entwurf['flaeche'] = { alpha: 0.6 };
    expect(bildeDelta(entwurf, FIRMA)).toEqual({ flaeche: { alpha: 0.6 } });
  });

  it('laesst unveraenderte Geschwisterfelder aus dem Delta heraus', () => {
    const entwurf = effektiveKonfiguration(FIRMA, {});
    entwurf['preisanpassung'] = { zMin: -0.25, zMax: 0.4 };
    // `zMin` ist unveraendert und gehoert deshalb nicht in die Ablage: Es soll dem
    // Firmenwert weiterhin folgen.
    expect(bildeDelta(entwurf, FIRMA)).toEqual({ preisanpassung: { zMax: 0.4 } });
  });

  it('uebernimmt ein geaendertes Array als Ganzes', () => {
    const entwurf = effektiveKonfiguration(FIRMA, {});
    entwurf['honorar'] = { stuetzstellen: [{ summe: 2_000_000, hMin: 0.015 }], gMin: 0.85 };
    expect(bildeDelta(entwurf, FIRMA)).toEqual({
      honorar: { stuetzstellen: [{ summe: 2_000_000, hMin: 0.015 }] },
    });
  });

  it('haelt `meta` und `api` aus dem Delta heraus, auch wenn sie bearbeitet wurden', () => {
    // Beide sind projektbezogen gesperrt (GESPERRTE_PFADE); `mergeKonfiguration` wuerde
    // sie mit CFG_MERGE_LOCKED_PATH zurueckweisen. Der Editor darf sie deshalb gar nicht
    // erst mitsenden — sonst scheiterte jedes Speichern an einem Wert, den der
    // Vermarkter nur angezeigt bekam.
    const entwurf = effektiveKonfiguration(FIRMA, {});
    entwurf['meta'] = { version: '9.9.9' };
    entwurf['api'] = { baseUrl: 'https://boese.test', timeoutMs: 1 };
    expect(bildeDelta(entwurf, FIRMA)).toEqual({});
  });

  it('sperrt einen gleichnamigen Schluessel in der Tiefe NICHT', () => {
    const firma = { aufwandfaktoren: { lage: { meta: 'PriceHubble', gewicht: 0.3 } } };
    const entwurf = { aufwandfaktoren: { lage: { meta: 'manuell', gewicht: 0.3 } } };
    expect(bildeDelta(entwurf, firma))
      .toEqual({ aufwandfaktoren: { lage: { meta: 'manuell' } } });
  });

  it('nimmt einen im Firmenstand unbekannten Schluessel als Ganzes auf', () => {
    // Rein konfigurativ ergaenzter Aufwandfaktor (offene Wurzel im Kern-Merge).
    const firma = { aufwandfaktoren: { lage: { gewicht: 0.3 } } };
    const entwurf = { aufwandfaktoren: { lage: { gewicht: 0.3 }, laerm: { gewicht: 0.2 } } };
    expect(bildeDelta(entwurf, firma)).toEqual({ aufwandfaktoren: { laerm: { gewicht: 0.2 } } });
  });

  it('meldet einen im Entwurf fehlenden Firmenschluessel nicht als Abweichung', () => {
    // Ein Merge, der Werte nur ueberlagert, hat keine Form fuer «dieser Schluessel soll
    // hier fehlen». Der Entwurf gilt an dieser Stelle als unveraendert.
    const entwurf = { flaeche: { alpha: 0.5 } };
    expect(bildeDelta(entwurf, { flaeche: { alpha: 0.5 }, preisanpassung: { zMax: 0.25 } }))
      .toEqual({});
  });

  it('faellt fuer einen leer gewordenen Teilbaum nicht auf eine wirkungslose Wurzel zurueck', () => {
    const entwurf = effektiveKonfiguration(FIRMA, { flaeche: { alpha: 0.6 } });
    entwurf['flaeche'] = { alpha: 0.5 }; // wieder auf den Firmenwert gesetzt
    expect(bildeDelta(entwurf, FIRMA)).toEqual({});
    expect(Object.hasOwn(bildeDelta(entwurf, FIRMA), 'flaeche')).toBe(false);
  });
});

describe('Rundlauf zwischen Anzeige- und Speicherrichtung', () => {
  it('gibt ein eingelegtes Delta unveraendert zurueck', () => {
    const delta = {
      flaeche: { alpha: 0.6 },
      honorar: { stuetzstellen: [{ summe: 3_000_000, hMin: 0.01 }] },
    };
    expect(bildeDelta(effektiveKonfiguration(FIRMA, delta), FIRMA)).toEqual(delta);
  });

  it('gibt auch ein leeres Delta unveraendert zurueck', () => {
    expect(bildeDelta(effektiveKonfiguration(FIRMA, {}), FIRMA)).toEqual({});
  });
});
