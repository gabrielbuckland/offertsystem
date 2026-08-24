/**
 * ABWEICHUNG VOM PLAN, bewusst: Die erwarteten Dateinamen folgen dem hiesigen Fixture
 * (Muster Immobilien AG, Musterstrasse) statt dem im Plan notierten Beispiel
 * (Meier, Baumgartenweg). Geprueft wird die Bildungsregel, nicht ein Literal.
 */
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * `node:fs/promises` ist ein Modulnamensraum; seine Exporte sind nicht neu belegbar,
 * `vi.spyOn` scheitert daran. Statt dessen wird das Modul ersetzt und `rename` ueber
 * eine Schalterfunktion einmalig zum Scheitern gebracht — die Zusage «kein halb
 * geschriebenes Artefakt» ist nur mit einem echten Fehlschlag pruefbar.
 */
const renameBricht = { einmal: false };
vi.mock('node:fs/promises', async () => {
  const echt = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...echt,
    default: echt,
    rename: async (von: string, nach: string) => {
      if (renameBricht.einmal) {
        renameBricht.einmal = false;
        throw new Error('bruch');
      }
      return echt.rename(von, nach);
    },
  };
});
import {
  dateinameFuer,
  ladeOfferte,
  legeOfferteAb,
  listeOfferten,
} from '../../src/server/offerten-ablage.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

function verzeichnis(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'offerten-'));
}

describe('Dateinamenskonvention', () => {
  it('bildet den Dateinamen aus Zeitstempel, Kurzbezeichner und den ersten acht Zeichen der Offert-Kennung', () => {
    expect(dateinameFuer(baueBeispielOfferte())).toBe(
      '2026-08-16T1432_musterstrasse_A-2026-0.json');
  });

  it('normalisiert Umlaute und Grossschreibung im Kurzbezeichner', () => {
    const o = baueBeispielOfferte();
    o.property.adresse.strasse = 'Zürcherstrasse';
    expect(dateinameFuer(o)).toContain('_zuercherstrasse_');
  });
});

describe('Schreiben — atomar und append-only', () => {
  it('hinterlaesst keine halb geschriebene Datei, wenn das Schreiben scheitert', async () => {
    const ziel = await verzeichnis();
    renameBricht.einmal = true;
    await expect(legeOfferteAb(baueBeispielOfferte(), ziel)).rejects.toThrow();
    expect((await readdir(ziel)).filter((d) => d.endsWith('.json'))).toEqual([]);
  });

  it('ueberschreibt ein bestehendes Artefakt nicht', async () => {
    const ziel = await verzeichnis();
    const o = baueBeispielOfferte();
    await legeOfferteAb(o, ziel);
    await expect(legeOfferteAb(o, ziel)).rejects.toThrow(/bereits vorhanden/);
  });

  it('legt unformatierte Zahlen ab', async () => {
    const ziel = await verzeichnis();
    const pfad = await legeOfferteAb(baueBeispielOfferte(), ziel);
    const roh = JSON.parse(await readFile(pfad, 'utf8')) as {
      aggregates: { totalSalesValue: { value: unknown } };
    };
    expect(typeof roh.aggregates.totalSalesValue.value).toBe('number');
    expect(JSON.stringify(roh)).not.toContain('CHF');
  });
});

describe('Lesen und Auflisten', () => {
  it('weist ein Artefakt mit fehlender Herkunftsangabe zurueck', async () => {
    const ziel = await verzeichnis();
    const o = baueBeispielOfferte();
    const pfad = await legeOfferteAb(o, ziel);
    const kaputt = JSON.parse(await readFile(pfad, 'utf8')) as {
      aggregates: { feeRange: { provenance?: string } };
    };
    delete kaputt.aggregates.feeRange.provenance;
    await writeFile(pfad, JSON.stringify(kaputt), 'utf8');
    await expect(ladeOfferte(o.metadata.offertId, ziel)).rejects.toThrow();
    const liste = await listeOfferten(ziel);
    expect(liste[0]!.fehlerhaft).toBe(true);
    expect(liste[0]!.verkaufssumme).toBeUndefined();
  });

  it('sortiert die Liste chronologisch absteigend', async () => {
    const ziel = await verzeichnis();
    for (const stempel of ['2026-08-16T14:32', '2026-08-17T09:15', '2026-08-15T08:00']) {
      const o = baueBeispielOfferte();
      o.metadata.erstelltAm = `${stempel}:00.000Z`;
      o.metadata.offertId = stempel;
      await legeOfferteAb(o, ziel);
    }
    const liste = await listeOfferten(ziel);
    expect(liste.map((e) => e.erstelltAm.slice(0, 10)))
      .toEqual(['2026-08-17', '2026-08-16', '2026-08-15']);
  });

  it('findet eine abgelegte Offerte ueber ihre Kennung wieder', async () => {
    const ziel = await verzeichnis();
    const o = baueBeispielOfferte();
    await legeOfferteAb(o, ziel);
    const geladen = await ladeOfferte(o.metadata.offertId, ziel);
    expect(geladen.aggregates.feeRange.value).toEqual(o.aggregates.feeRange.value);
  });
});

describe('Ablageform', () => {
  it('setzt weder DBMS noch ORM ein (AK-4.5)', () => {
    const wurzel = new URL('../../../../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(wurzel, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const alle = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const verboten of ['prisma', 'drizzle-orm', 'better-sqlite3', 'pg', 'mongodb',
                            'typeorm', 'sequelize', 'mysql2']) {
      expect(alle[verboten]).toBeUndefined();
    }
  });
});
