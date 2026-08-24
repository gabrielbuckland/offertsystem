/**
 * Keine Formel. Dateibasierte Ablage der Projekte (Arbeitsstaende).
 *
 * Bewusster Unterschied zur Offertenablage: Projekte sind VERAENDERLICH, Offerten bleiben
 * append-only. Die Offerte ist das Nachweisartefakt, das belegt, was zum Zeitpunkt der
 * Erzeugung galt; ein Projekt ist der Arbeitsstand davor. Waeren beide veraenderlich,
 * verlaere die Reproduzierbarkeitsaussage aus US-13 ihren Traeger.
 *
 * Der Dateiname ist die Kennung, nicht die Adresse: Ein Projekt wird umbenannt, wenn sich
 * die Adresse korrigiert, und ein wandernder Dateiname verlaere die Zuordnung.
 *
 * Kein DBMS und kein ORM (AK-4.5).
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { projektSchema, SCHEMA_VERSION, type Projekt } from './projekt-schema.js';

export interface ProjektEintrag {
  readonly id: string;
  readonly adresse: string;
  readonly geaendertAm: string;
  readonly anzahlEinheiten: number;
  readonly fehlerhaft: boolean;
  readonly datei: string;
}

type Adresse = Projekt['adresse'];

// Monoton statt eines blossen `new Date().toISOString()`: Zwei Aufrufe kurz
// hintereinander (etwa `legeProjektAn` gefolgt von einem sofortigen `speichereProjekt`)
// koennen auf dieselbe Millisekunde fallen. `geaendertAm` traegt aber die Sortierung
// der Projektuebersicht (Produkteigenschaft) — ein Gleichstand darf die Reihenfolge
// nicht dem Dateisystem ueberlassen.
let letzterZeitpunkt = 0;

function jetzt(): string {
  letzterZeitpunkt = Math.max(Date.now(), letzterZeitpunkt + 1);
  return new Date(letzterZeitpunkt).toISOString();
}

async function schreibeAtomar(ziel: string, inhalt: string): Promise<void> {
  const temp = `${ziel}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, inhalt, 'utf8');
  try {
    await fs.rename(temp, ziel);
  } catch (fehler) {
    await fs.rm(temp, { force: true });
    throw fehler;
  }
}

export async function speichereProjekt(projekt: Projekt, verzeichnis: string): Promise<void> {
  const geprueft = projektSchema.parse({
    ...projekt,
    meta: { ...projekt.meta, geaendertAm: jetzt() },
  });
  await fs.mkdir(verzeichnis, { recursive: true });
  await schreibeAtomar(
    join(verzeichnis, `${geprueft.id}.json`),
    `${JSON.stringify(geprueft, null, 2)}\n`,
  );
}

export async function legeProjektAn(adresse: Adresse, verzeichnis: string): Promise<Projekt> {
  const zeitpunkt = jetzt();
  const projekt = projektSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id: randomUUID(),
    adresse,
    referenzobjekte: [],
    anpassungsSpalten: [],
    einheiten: [],
    aufwandfaktoren: {},
    meta: { erstelltAm: zeitpunkt, geaendertAm: zeitpunkt },
  });
  await fs.mkdir(verzeichnis, { recursive: true });
  await schreibeAtomar(
    join(verzeichnis, `${projekt.id}.json`),
    `${JSON.stringify(projekt, null, 2)}\n`,
  );
  return projekt;
}

export async function ladeProjekt(id: string, verzeichnis: string): Promise<Projekt> {
  const roh: unknown = JSON.parse(
    await fs.readFile(join(verzeichnis, `${id}.json`), 'utf8'),
  );
  return projektSchema.parse(roh); // wirft bei Verletzung — I-24
}

export async function listeProjekte(verzeichnis: string): Promise<readonly ProjektEintrag[]> {
  const dateien = (await fs.readdir(verzeichnis).catch(() => [] as string[]))
    .filter((d) => d.endsWith('.json'));
  const liste: ProjektEintrag[] = [];
  for (const datei of dateien) {
    const inhalt = await fs.readFile(join(verzeichnis, datei), 'utf8');
    // `JSON.parse` gehoert in denselben Fehlerpfad wie `safeParse`: Ein Datei-Fragment
    // mit kaputter JSON-Syntax ist ebenso ein schemawidriges Artefakt wie eines mit
    // gueltiger Syntax und fehlenden Feldern — I-24 kennzeichnet es, statt die ganze
    // Liste abbrechen zu lassen.
    let roh: unknown;
    try {
      roh = JSON.parse(inhalt);
    } catch {
      liste.push({
        id: datei.replace(/\.json$/, ''), adresse: '—', geaendertAm: '',
        anzahlEinheiten: 0, fehlerhaft: true, datei,
      });
      continue;
    }
    const ergebnis = projektSchema.safeParse(roh);
    if (!ergebnis.success) {
      liste.push({
        id: datei.replace(/\.json$/, ''), adresse: '—', geaendertAm: '',
        anzahlEinheiten: 0, fehlerhaft: true, datei,
      });
      continue;
    }
    const p = ergebnis.data;
    liste.push({
      id: p.id,
      adresse: `${p.adresse.strasse} ${p.adresse.hausnummer}, ${p.adresse.plz} ${p.adresse.ort}`,
      geaendertAm: p.meta.geaendertAm,
      anzahlEinheiten: p.einheiten.length,
      fehlerhaft: false,
      datei,
    });
  }
  return liste.sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
}
