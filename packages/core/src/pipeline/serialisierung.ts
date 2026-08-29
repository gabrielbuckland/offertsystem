// Keine Formel. Umschluesselung zwischen EingangsArgumente und einer JSON-faehigen Form
// (PE-08). Sie rechnet nicht und rundet nicht; jede Zahl geht unveraendert durch.
// Zweck: Der Reproduzierbarkeitsnachweis (AK-4.4, US-13, I-14) speichert die Eingabe und
// rechnet sie spaeter erneut. ReadonlyMap ueberlebt JSON nicht, und `Liegenschaft` darf nur
// ueber die Eingabeschicht entstehen (I-02) — beides loest ausschliesslich diese Datei.
import { z } from 'zod';
import { gewicht, rappen, score } from '../domain/geld.js';
import { faktorId, lagescoreName, wohnungstypId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import {
  validiereLiegenschaftEingabe, type EingabeFehler,
} from '../eingabe/validiere.js';
import { normalisiereBereiche } from '../modell/bereichsregel.js';
import type {
  FaktorParameter, Konfiguration, Stuetzstelle,
} from '../config/typen.js';
import type { LagescoreMeta, Lagescores, Referenzbewertung } from '../ports/valuation-provider.js';
import type { EingangsArgumente } from './stufe1-eingabe.js';

/** Erhoehen, sobald sich die Form aendert; alte Staende sind dann sichtbar unlesbar. */
export const SERIALISIERUNGS_VERSION = 1;

function strukturFehler(feld: string, hinweis: string): readonly EingabeFehler[] {
  return [{ feld, code: 'SERIALISIERUNG_UNLESBAR', parameter: { hinweis } }];
}

/** Paare in Codepoint-Ordnung — die Ausgabe darf nicht von der Einfuegereihenfolge abhaengen. */
function paare<W>(m: ReadonlyMap<string, W>): readonly (readonly [string, W])[] {
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function serialisiereKonfiguration(k: Konfiguration): unknown {
  return {
    meta: k.meta,
    flaeche: k.flaeche,
    preisanpassung: k.preisanpassung,
    anpassungsVorlagen: k.anpassungsVorlagen,
    merkmale: k.merkmale,
    faktoren: paare(k.faktoren).map(([id, p]) => [id, p]),
    honorar: {
      stuetzstellen: k.honorar.stuetzstellen.map((s) => ({ v: s.v, hMin: s.hMin, hMax: s.hMax })),
      skalierung: k.honorar.skalierung,
    },
    ...(k.konfigPruefsumme === undefined ? {} : { konfigPruefsumme: k.konfigPruefsumme }),
  };
}

const SkalaSchema = z.object({
  form: z.literal('ordinal'),
  stufen: z.array(z.object({ wert: z.number(), bezeichnung: z.string() })),
});

// Rein strukturelle Pruefung. Die drei fachlichen Pruefebenen sind beim Laden gelaufen,
// und die Identitaet der Kopie belegt `metadata.konfigPruefsumme` (PE-04).
const KonfigurationsKopieSchema = z.object({
  meta: z.object({
    schemaVersion: z.number(), konfigVersion: z.string(),
    gueltigAb: z.string(), beschreibung: z.string(),
  }),
  flaeche: z.object({ alpha: z.number() }),
  preisanpassung: z.object({
    zMin: z.number(), zMax: z.number(),
    begruendungPflicht: z.literal(true), begruendungMinLaenge: z.number(),
  }),
  anpassungsVorlagen: z.array(z.object({
    id: z.string(), bezeichnung: z.string(),
    vorgabefaktor: z.number(),
    // Vorgabe 'relativ' haelt aeltere serialisierte Eingaenge lesbar (I-14 unberuehrt:
    // sie tragen ohnehin keine Regel, also keine Doppeldeutigkeit).
    erfassungsform: z.enum(['relativ', 'absolut']).default('relativ'),
    begruendungVorschlag: z.string(),
    regel: z.object({
      merkmal: z.string(),
      bereiche: z.array(z.object({ unter: z.number().optional(), wert: z.number() })),
    }).optional(),
  })),
  // Vorgabe leer haelt aeltere serialisierte Eingaenge ohne Merkmale lesbar.
  merkmale: z.array(z.object({
    id: z.string(), bezeichnung: z.string(), form: z.literal('zahl'),
  })).default([]),
  faktoren: z.array(z.tuple([z.string(), z.object({
    grenzeMin: z.number(), grenzeMax: z.number(), gewicht: z.number(),
    strategie: z.enum(['min-max', 'z-score']),
    quelle: z.enum(['lagescore', 'manuell', 'abgeleitet']),
    quellSchluessel: z.string(), bezeichnung: z.string(),
    referenzverteilung: z.object({
      mittelwert: z.number(), standardabweichung: z.number(), kappungSigma: z.number(),
    }).optional(),
    skala: SkalaSchema.optional(),
  })])),
  honorar: z.object({
    stuetzstellen: z.array(z.object({ v: z.number(), hMin: z.number(), hMax: z.number() })),
    skalierung: z.object({ form: z.literal('linear'), gMin: z.number(), gMax: z.number() }),
  }),
  konfigPruefsumme: z.string().optional(),
});

export function deserialisiereKonfiguration(
  roh: unknown,
): Result<Konfiguration, readonly EingabeFehler[]> {
  const geparst = KonfigurationsKopieSchema.safeParse(roh);
  if (!geparst.success) {
    return fehlschlag(geparst.error.issues.map((i) => ({
      feld: i.path.join('.'), code: 'SERIALISIERUNG_UNLESBAR',
      parameter: { hinweis: i.code },
    })));
  }
  const k = geparst.data;
  const faktoren = new Map<ReturnType<typeof faktorId>, FaktorParameter>();
  for (const [id, p] of k.faktoren) {
    if (p.gewicht < 0 || p.gewicht > 1) {
      return fehlschlag(strukturFehler(`faktoren.${id}.gewicht`, 'ausserhalb_null_eins'));
    }
    faktoren.set(faktorId(id), {
      grenzeMin: p.grenzeMin, grenzeMax: p.grenzeMax, gewicht: gewicht(p.gewicht),
      strategie: p.strategie, quelle: p.quelle, quellSchluessel: p.quellSchluessel,
      bezeichnung: p.bezeichnung,
      ...(p.referenzverteilung === undefined ? {} : { referenzverteilung: p.referenzverteilung }),
      ...(p.skala === undefined ? {} : { skala: p.skala }),
    });
  }
  const stuetzstellen: Stuetzstelle[] = [];
  for (const [i, s] of k.honorar.stuetzstellen.entries()) {
    if (!Number.isInteger(s.v) || !Number.isInteger(s.hMin) || !Number.isInteger(s.hMax)) {
      return fehlschlag(strukturFehler(`honorar.stuetzstellen[${i}]`, 'nicht_ganzzahlige_rappen'));
    }
    stuetzstellen.push({ v: rappen(s.v), hMin: rappen(s.hMin), hMax: rappen(s.hMax) });
  }
  // exactOptionalPropertyTypes: `regel` darf im Kerntyp nicht als explizites `undefined`
  // auftreten, nur als fehlender Schluessel (analog abbildung.ts).
  const anpassungsVorlagen = k.anpassungsVorlagen.map((vorlage) => {
    const { regel, ...rest } = vorlage;
    if (regel === undefined) return rest;
    return { ...rest, regel: { merkmal: regel.merkmal, bereiche: normalisiereBereiche(regel.bereiche) } };
  });
  return ok({
    meta: k.meta, flaeche: k.flaeche, preisanpassung: k.preisanpassung,
    anpassungsVorlagen, merkmale: k.merkmale, faktoren,
    honorar: { stuetzstellen, skalierung: k.honorar.skalierung },
    ...(k.konfigPruefsumme === undefined ? {} : { konfigPruefsumme: k.konfigPruefsumme }),
  });
}

export function serialisiereEingang(e: EingangsArgumente): unknown {
  return {
    version: SERIALISIERUNGS_VERSION,
    // Ohne die Gueltigkeitsmarke: Sie ist ein Symbol und entsteht beim Einlesen neu (I-02).
    liegenschaft: {
      id: e.liegenschaft.id, adresse: e.liegenschaft.adresse,
      wohnungstypen: e.liegenschaft.wohnungstypen, einheiten: e.liegenschaft.einheiten,
    },
    bewertungen: e.bewertungen,
    bewertungsbuendelVollstaendig: e.bewertungsbuendelVollstaendig,
    lagescores: {
      werte: paare(e.lagescores.werte),
      meta: paare(e.lagescores.meta),
      abrufdatum: e.lagescores.abrufdatum,
      anbieter: e.lagescores.anbieter,
    },
    vermarkterFaktoren: { werte: paare(e.vermarkterFaktoren.werte) },
    // Bedingter Spread statt `undefined`-Schluessel: Fehlend heisst «keine
    // Uebersteuerung», und die serialisierte Form soll das genauso tragen.
    ...(e.aufwandindikatorUebersteuerung === undefined
      ? {}
      : { aufwandindikatorUebersteuerung: e.aufwandindikatorUebersteuerung }),
    konfiguration: serialisiereKonfiguration(e.konfiguration),
    zeitstempel: e.zeitstempel,
  };
}

const EingangSchema = z.object({
  version: z.literal(SERIALISIERUNGS_VERSION),
  liegenschaft: z.unknown(),
  bewertungen: z.array(z.unknown()),
  bewertungsbuendelVollstaendig: z.boolean(),
  lagescores: z.object({
    werte: z.array(z.tuple([z.string(), z.number()])),
    meta: z.array(z.tuple([z.string(), z.object({
      originalScore: z.number(), isOverridden: z.boolean(),
    })])),
    abrufdatum: z.string(),
    anbieter: z.string(),
  }),
  vermarkterFaktoren: z.object({ werte: z.array(z.tuple([z.string(), z.number()])) }),
  // Optional additiv — aeltere serialisierte Eingaenge ohne das Feld bleiben lesbar,
  // deshalb KEIN Versionssprung (SERIALISIERUNGS_VERSION unveraendert).
  aufwandindikatorUebersteuerung: z.number().min(0).max(1).optional(),
  konfiguration: z.unknown(),
  zeitstempel: z.string(),
});

export function deserialisiereEingang(
  roh: unknown,
): Result<EingangsArgumente, readonly EingabeFehler[]> {
  const huelle = EingangSchema.safeParse(roh);
  if (!huelle.success) {
    return fehlschlag(huelle.error.issues.map((i) => ({
      feld: i.path.join('.'), code: 'SERIALISIERUNG_UNLESBAR',
      parameter: { hinweis: i.code },
    })));
  }
  const d = huelle.data;

  const konfiguration = deserialisiereKonfiguration(d.konfiguration);
  if (!konfiguration.ok) return fehlschlag(konfiguration.fehler);

  // Einzige Konstruktionsstelle der Liegenschaft (I-02). Die Grenzen stammen aus der
  // eingebetteten Kopie, nicht aus der aktuell geladenen Konfiguration.
  const liegenschaft = validiereLiegenschaftEingabe(d.liegenschaft, {
    zMin: konfiguration.wert.preisanpassung.zMin,
    zMax: konfiguration.wert.preisanpassung.zMax,
    begruendungMinLaenge: konfiguration.wert.preisanpassung.begruendungMinLaenge,
  });
  if (!liegenschaft.ok) return fehlschlag(liegenschaft.fehler);

  const werte = new Map<ReturnType<typeof lagescoreName>, ReturnType<typeof score>>();
  const meta = new Map<ReturnType<typeof lagescoreName>, LagescoreMeta>();
  for (const [name, wert] of d.lagescores.werte) {
    if (wert < 0 || wert > 1) return fehlschlag(strukturFehler(`lagescores.${name}`, 'kein_score'));
    werte.set(lagescoreName(name), score(wert));
  }
  for (const [name, m] of d.lagescores.meta) {
    if (m.originalScore < 0 || m.originalScore > 1) {
      return fehlschlag(strukturFehler(`lagescores.meta.${name}`, 'kein_score'));
    }
    meta.set(lagescoreName(name),
      { originalScore: score(m.originalScore), isOverridden: m.isOverridden });
  }
  const lagescores: Lagescores = {
    werte, meta, abrufdatum: d.lagescores.abrufdatum, anbieter: d.lagescores.anbieter,
  };

  const rohfaktoren = new Map(
    d.vermarkterFaktoren.werte.map(([id, w]) => [faktorId(id), w] as const));

  return ok({
    liegenschaft: liegenschaft.wert,
    // Die Bewertungen sind reine Daten; ihre Marken entstehen ueber die Bezeichner.
    bewertungen: d.bewertungen.map((b) => {
      const rohB = b as Referenzbewertung & { wohnungstypId: string; marktwert: number };
      return { ...rohB, wohnungstypId: wohnungstypId(rohB.wohnungstypId),
        marktwert: rappen(rohB.marktwert) } as Referenzbewertung;
    }),
    bewertungsbuendelVollstaendig: d.bewertungsbuendelVollstaendig,
    lagescores,
    vermarkterFaktoren: { werte: rohfaktoren },
    ...(d.aufwandindikatorUebersteuerung === undefined
      ? {}
      : { aufwandindikatorUebersteuerung: d.aufwandindikatorUebersteuerung }),
    konfiguration: konfiguration.wert,
    zeitstempel: d.zeitstempel,
  });
}
