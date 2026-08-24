import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ladeProjekt, legeProjektAn, listeProjekte, speichereProjekt,
} from '../../src/server/projekt-ablage.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };
const verzeichnis = () => mkdtemp(join(tmpdir(), 'projekte-'));

describe('Projektablage', () => {
  it('legt ein Projekt mit erzeugter Kennung an', async () => {
    const v = await verzeichnis();
    const p = await legeProjektAn(ADRESSE, v);
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.einheiten).toHaveLength(0);
    expect(await ladeProjekt(p.id, v)).toEqual(p);
  });

  it('ueberschreibt beim Speichern denselben Stand, statt eine zweite Datei anzulegen', async () => {
    const v = await verzeichnis();
    const p = await legeProjektAn(ADRESSE, v);
    await speichereProjekt({ ...p, aufwandfaktoren: { innenausbau_qualitaet: 3 } }, v);
    expect((await readdir(v)).filter((d) => d.endsWith('.json'))).toHaveLength(1);
    expect((await ladeProjekt(p.id, v)).aufwandfaktoren).toEqual({ innenausbau_qualitaet: 3 });
  });

  it('fuehrt geaendertAm nach, laesst erstelltAm unangetastet', async () => {
    const v = await verzeichnis();
    const p = await legeProjektAn(ADRESSE, v);
    await speichereProjekt(p, v);
    const danach = await ladeProjekt(p.id, v);
    expect(danach.meta.erstelltAm).toBe(p.meta.erstelltAm);
    expect(danach.meta.geaendertAm >= p.meta.geaendertAm).toBe(true);
  });

  it('kennzeichnet ein schemawidriges Artefakt, statt es teilweise darzustellen', async () => {
    const v = await verzeichnis();
    await writeFile(join(v, 'kaputt.json'), '{"schemaVersion":1}\n', 'utf8');
    const liste = await listeProjekte(v);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.fehlerhaft).toBe(true);
  });

  it('sortiert die Liste nach Aenderungsdatum absteigend', async () => {
    const v = await verzeichnis();
    const a = await legeProjektAn(ADRESSE, v);
    const b = await legeProjektAn({ ...ADRESSE, hausnummer: '2' }, v);
    await speichereProjekt({ ...a, meta: { ...a.meta, geaendertAm: '2099-01-01T00:00:00.000Z' } }, v);
    const liste = await listeProjekte(v);
    expect(liste.map((e) => e.id)).toEqual([a.id, b.id]);
  });
});
