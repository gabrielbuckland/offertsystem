// Dateibasierte JSON-Ablage der Offerten (E-14, Brief §5.2). Ablageort kommt aus der
// Umgebung via `holeLaufzeit()` (PE-24), kein Vorgabewert hier. Atomar und append-only:
// Artefakte werden nur angelegt, nie ueberschrieben (Reproduzierbarkeit, US-13). Kein
// DBMS/ORM (AK-4.5): ein Schreiber, keine Nebenlaeufigkeit, keine Abfragen ausser Auflisten.
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
// Modulpfad statt Paketindex: Der Index re-exportiert auch React-Komponenten (.tsx), fuer
// die Node kein Type-Stripping leistet (PE-09); dieser Pfad wird unter Node ausgefuehrt.
import { offerSchema, type Offer } from '@offert/offer';

export interface ListenEintrag {
  readonly offertId: string;
  // Ungesetzt im Fehlerzweig (I-24): Ein unlesbares Artefakt hat keine verlaessliche
  // Projektkennung — sie stammt aus demselben geparsten `metadata`-Block wie die
  // uebrigen Felder unten.
  readonly projektId?: string | undefined;

  readonly liegenschaft: string;
  readonly erstelltAm: string;
  readonly verkaufssumme?: number | undefined;
  // Interne Empfehlung (Herleitung), bleibt gefuehrt fuer Altartefakte ohne gewaehlten
  // Betrag und als Vergleichswert in dieser Uebersichtsliste (siehe `honorar` unten).
  readonly honorarMin?: number | undefined;
  readonly honorarMax?: number | undefined;
  // Der vom Vermarkter gewaehlte, der Offerte zugrundeliegende Betrag (Spec 2026-08-29).
  // Ungesetzt bei einem Altartefakt ohne `aggregates.gewaehltesHonorar` — die Anzeige
  // faellt dann auf die Range zurueck (`ProjektOfferten.tsx`).
  readonly honorar?: number | undefined;
  // SHA-256 der Konfiguration, aus der die Offerte entstand (metadata.konfigPruefsumme).
  // Ungesetzt im Fehlerzweig aus demselben Grund wie `projektId`.
  readonly konfigPruefsumme?: string | undefined;
  readonly fehlerhaft: boolean;
  readonly datei: string;
}

function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Zeitstempel voran, damit die lexikografische Sortierung der chronologischen entspricht.
 * Der Dateiname ist Bequemlichkeit, kein Datentraeger: Alle darin enthaltenen Angaben
 * stehen auch im Dokument. Die Referenznummer entfaellt als Namensbestandteil (Spec 05
 * §2/§8): Ein Projekt identifiziert sich ueber Adresse und Datum, und die ersten acht
 * Zeichen der `offertId` genuegen, um mehrere Offerten desselben Projekts am selben Tag
 * zu unterscheiden.
 */
export function dateinameFuer(offerte: Offer): string {
  const stempel = offerte.metadata.erstelltAm.slice(0, 16).replace(/[-:]/g, '')
    .replace(/^(\d{8})T(\d{4})$/, (_, d: string, t: string) =>
      `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t}`);
  const kurz = normalisiere(offerte.property.adresse.strasse);
  return `${stempel}_${kurz}_${offerte.metadata.offertId.slice(0, 8)}.json`;
}

export async function legeOfferteAb(offerte: Offer, verzeichnis: string): Promise<string> {
  const geprueft = offerSchema.parse(offerte);
  await fs.mkdir(verzeichnis, { recursive: true });
  const ziel = join(verzeichnis, dateinameFuer(geprueft));
  if (await fs.access(ziel).then(() => true, () => false)) {
    throw new Error(`Offerte bereits vorhanden: ${ziel}`);
  }
  // Erst vollstaendig schreiben, dann verknuepfen: Ein Abbruch hinterlaesst die
  // Temporaerdatei, nie ein halb geschriebenes Artefakt unter dem Zielnamen.
  const temp = join(verzeichnis, `.${randomUUID()}.tmp`);
  await fs.writeFile(temp, `${JSON.stringify(geprueft, null, 2)}\n`, 'utf8');
  try {
    await fs.rename(temp, ziel);
  } catch (fehler) {
    await fs.rm(temp, { force: true });
    throw fehler;
  }
  return ziel;
}

async function leseDateien(verzeichnis: string): Promise<string[]> {
  const eintraege = await fs.readdir(verzeichnis).catch(() => [] as string[]);
  return eintraege.filter((d) => d.endsWith('.json') && d !== 'index.json').sort().reverse();
}

export async function ladeOfferte(offertId: string, verzeichnis: string): Promise<Offer> {
  for (const datei of await leseDateien(verzeichnis)) {
    const roh: unknown = JSON.parse(await fs.readFile(join(verzeichnis, datei), 'utf8'));
    const geprueft = offerSchema.parse(roh); // wirft bei Verletzung — I-24, NFA-10
    if (geprueft.metadata.offertId === offertId) return geprueft;
  }
  throw new Error(`Offerte ${offertId} nicht gefunden`);
}

/** Eine fehlerhafte Offerte wird gekennzeichnet, nicht teilweise dargestellt (I-24). */
export async function listeOfferten(verzeichnis: string): Promise<readonly ListenEintrag[]> {
  const liste: ListenEintrag[] = [];
  for (const datei of await leseDateien(verzeichnis)) {
    const inhalt = await fs.readFile(join(verzeichnis, datei), 'utf8');
    const ergebnis = offerSchema.safeParse(JSON.parse(inhalt));
    if (!ergebnis.success) {
      liste.push({
        offertId: datei, liegenschaft: '—',
        erstelltAm: datei.slice(0, 16), fehlerhaft: true, datei,
      });
      continue;
    }
    const o = ergebnis.data;
    liste.push({
      offertId: o.metadata.offertId,
      projektId: o.metadata.projektId,
      liegenschaft: `${o.property.adresse.strasse} ${o.property.adresse.hausnummer}, `
        + `${o.property.adresse.plz} ${o.property.adresse.ort}`,
      erstelltAm: o.metadata.erstelltAm,
      verkaufssumme: o.aggregates.totalSalesValue.value,
      honorarMin: o.aggregates.feeRange.value.min,
      honorarMax: o.aggregates.feeRange.value.max,
      ...(o.aggregates.gewaehltesHonorar === undefined ? {}
        : { honorar: o.aggregates.gewaehltesHonorar.value }),
      konfigPruefsumme: o.metadata.konfigPruefsumme,
      fehlerhaft: false,
      datei,
    });
  }
  return liste;
}
