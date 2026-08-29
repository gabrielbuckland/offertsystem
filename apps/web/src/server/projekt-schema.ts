/**
 * Keine Formel. Schema des Projektartefakts (Arbeitsstand), nicht der Offerte.
 *
 * Abgrenzung zu `erfassungsSchema`: Dieses Schema beschreibt einen VERAENDERLICHEN
 * Zwischenstand und laesst deshalb Unvollstaendigkeit zu — ein neu angelegtes Projekt hat
 * weder Einheiten noch Bewertungen. Die Vollstaendigkeitsregeln der Berechnung greifen
 * erst bei der Projektion (`projektion.ts`); sie hier zu wiederholen haette einen zweiten
 * Regelort geschaffen.
 *
 * Aggregatregeln stehen in `superRefine`, weil eine Kollision eine Aussage ueber die
 * Menge ist und nicht ueber einen einzelnen Wert (I-01).
 */
import { z } from 'zod';
import { normalisiereBereiche, pruefeBereiche } from '@offert/core';
import { offertDokumentSchema } from '@offert/offer/src/vorlage/dokument-schema.js';

export const SCHEMA_VERSION = 1;

const parametrisierungSchema = z.object({
  flaecheInnen: z.number().positive(),
  flaecheAussen: z.number().nonnegative(),
  stockwerk: z.number().int(),
  energielabel: z.string(),
  zustandsbewertungen: z.record(z.string()),
  qualitaetsbewertungen: z.record(z.string()),
  anzahlBadezimmer: z.number().int().nonnegative(),
  lift: z.boolean(),
  baujahr: z.number().int(),
  heizungsart: z.string(),
}).strict();

const referenzobjektSchema = z.object({
  id: z.string().min(1),
  zimmerzahl: z.number().min(1).max(12),
  parametrisierung: parametrisierungSchema,
  bewertung: z.object({
    wert: z.number().int(),
    bewertungsdatum: z.string().min(1),
    konfidenzklasse: z.string().min(1),
  }).strict().optional(),
}).strict();

const bereichSchema = z.object({
  unter: z.number().optional(),
  wert: z.number(),
}).strict();

const bereichsregelSchema = z.object({
  merkmal: z.string().min(1),
  bereiche: z.array(bereichSchema),
}).strict().superRefine((r, ctx) => {
  // Dieselbe Definition wie in der Konfigurationspruefung: `pruefeBereiche` ist die
  // einzige Stelle, an der die Staffelinvarianten stehen (Kern, bereichsregel.ts).
  // `normalisiereBereiche` bringt die von Zod inferierte Optionalitaet (`unter?: number |
  // undefined`) auf die Domainform (`unter?: number`) — dasselbe Muster wie in
  // `config/ebene3.ts` im Kern.
  for (const grund of pruefeBereiche(normalisiereBereiche(r.bereiche))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['bereiche'],
      params: { regel: 'BEREICHE_UNGUELTIG' }, message: grund,
    });
  }
});

const merkmalSchema = z.object({
  id: z.string().min(1),
  bezeichnung: z.string().trim().min(1),
  form: z.literal('zahl'),
}).strict();

// Eigener Name fuer das reine Objektschema: Sobald `refine` angehaengt ist, wird daraus
// ein `ZodEffects`, auf dem `.omit()`/`.pick()`/`.partial()`/`.extend()` nicht mehr
// existieren. Der exportierte Name traegt die Pruefung, dieser bleibt frei fuer
// Objekt-Operationen, falls spaetere Tasks welche brauchen.
const anpassungsSpalteObjektSchema = z.object({
  id: z.string().min(1),
  bezeichnung: z.string().trim().min(1),
  erfassungsform: z.enum(['relativ', 'absolut']),
  // Optional, weil eine Spalte mit Regel keinen Vorgabewert traegt.
  vorgabewert: z.number().optional(),
  regel: bereichsregelSchema.optional(),
}).strict();

const anpassungsSpalteSchema = anpassungsSpalteObjektSchema.refine(
  (s) => !(s.regel !== undefined && s.vorgabewert !== undefined),
  { message: 'REGEL_UND_VORGABEWERT' },
);

const einheitSchema = z.object({
  id: z.string().min(1),
  wohnungsnummer: z.string().trim().min(1),
  referenzobjektId: z.string().min(1),
  flaecheInnen: z.number().nonnegative(),
  flaecheAussen: z.number().nonnegative(),
  // Bewusst KEIN `stockwerk`: Was eine Einheit gegenueber ihrem Referenzobjekt
  // unterscheidet, steht vollstaendig in `spaltenwerte` — der offenen, konfigurierbaren
  // Liste der Zu-/Abschlaege. `.strict()` weist ein Artefakt mit dem frueheren Feld
  // deshalb ab; abgelegte Projekte wurden einmalig bereinigt (siehe Worklog).
  spaltenwerte: z.record(z.number()),
  // Werte der Merkmale (`Projekt.merkmale`), auf denen eine Bereichsregel steht.
  // `.default({})` haelt bestehende Artefakte ohne dieses Feld gueltig (I-24).
  merkmalswerte: z.record(z.number()).default({}),
}).strict();

export const projektSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().uuid(),
  adresse: z.object({
    strasse: z.string().trim().min(1),
    hausnummer: z.string().trim().min(1),
    plz: z.string().regex(/^\d{4}$/),
    ort: z.string().trim().min(1),
  }).strict(),
  // Merkmal des GANZEN Neubau-Projekts, nicht je Referenzobjekt (Rueckmeldung
  // Auftraggeber) — optional, damit bereits abgelegte Projekte ohne dieses Feld
  // gueltig bleiben (I-24 gilt hier fuers Schema selbst: fehlend ist kein Fehler).
  // `Referenzobjekte.tsx` schreibt eine Aenderung in JEDES Referenzobjekt
  // (`parametrisierung.baujahr`) — dort steht das Feld weiterhin, weil
  // `RepraesentativeParametrisierung` (packages/core) es je Wohnungstyp fuehrt.
  baujahr: z.number().int().optional(),
  referenzobjekte: z.array(referenzobjektSchema),
  anpassungsSpalten: z.array(anpassungsSpalteSchema),
  merkmale: z.array(merkmalSchema).default([]),
  einheiten: z.array(einheitSchema),
  aufwandfaktoren: z.record(z.number()),
  // Vom Vermarkter gesetzter Aufwandindikator D (Rueckmeldung Auftraggeber 2026-08-28):
  // Die ANWESENHEIT entscheidet, nicht die Groesse (Muster `wirksamer-wert.ts`) — fehlt
  // das Feld, gilt der aus den Faktoren (PriceHubble-Lagescore, abgeleitete Groessen)
  // hergeleitete Wert. Die Bereichspruefung [0,1] liegt HIER, der Kern uebernimmt den
  // Wert unveraendert (Kommentar in stufe4-gewichtung.ts).
  aufwandindikatorUebersteuerung: z.number().min(0).max(1).optional(),
  /**
   * Ebene 2 des Zwei-Ebenen-Modells: die projektbezogenen Abweichungen von den
   * Firmenwerten — nur die tatsaechlich uebersteuerten Pfade (Delta), nicht die ganze
   * Konfiguration. Ein Projekt ohne dieses Feld rechnet mit den reinen Firmenwerten;
   * die Optionalitaet haelt die abgelegten Bestandsprojekte gueltig (I-24).
   *
   * BEWUSST NUR `record(unknown)` UND KEIN NACHBAU DER KONFIGURATIONSFORM: Welche
   * Pfade uebersteuerbar sind und welche Werte zulaessig, entscheidet allein
   * `mergeKonfiguration` samt Nachvalidierung im Ladepfad (PE-01). Ein `.strict()`
   * -Schema hier waere eine zweite Wahrheit darueber und liefe bei jeder
   * Konfigurationserweiterung aus dem Tritt.
   */
  einstellungen: z.record(z.unknown()).optional(),
  // Empfänger der Offerte (Spec 2026-08-27 §1). Optional: bestehende Projekte bleiben
  // gültig; der Platzhalter {auftraggeber} verlangt ihn erst beim Finalisieren.
  auftraggeber: z.string().trim().min(1).optional(),
  // Projektspezifische Kopie des Offerttexts. Fehlt sie, gilt beim Finalisieren die
  // globale Vorlage (vorlagen-ablage.ts) — gleiches Ergebnis, kein Sonderpfad.
  offertText: offertDokumentSchema.optional(),
  meta: z.object({
    erstelltAm: z.string().min(1),
    geaendertAm: z.string().min(1),
  }).strict(),
}).strict().superRefine((p, ctx) => {
  const bekannt = new Set(p.referenzobjekte.map((r) => r.id));
  p.einheiten.forEach((e, i) => {
    if (!bekannt.has(e.referenzobjektId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['einheiten', i, 'referenzobjektId'],
        params: { regel: 'REFERENZOBJEKT_UNBEKANNT' },
        message: 'REFERENZOBJEKT_UNBEKANNT',
      });
    }
  });

  const gesehen = new Map<string, number[]>();
  p.einheiten.forEach((e, i) => {
    gesehen.set(e.wohnungsnummer, [...(gesehen.get(e.wohnungsnummer) ?? []), i]);
  });
  for (const [nummer, indizes] of gesehen) {
    if (indizes.length > 1) {
      for (const i of indizes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['einheiten', i, 'wohnungsnummer'],
          params: { regel: 'NUMMER_DOPPELT', nummer },
          message: 'NUMMER_DOPPELT',
        });
      }
    }
  }

  // Die Kennung (`id`) ist der Schluessel fuer Basispreis und Anpassungen (projektion.ts)
  // und darf sich deshalb NICHT ueber die Wohnungsnummer hinweg mit der Nummernpruefung
  // begnuegen: Eine editierte Wohnungsnummer (Einheitentabelle) laesst die Kennung
  // unveraendert, ein Generatorlauf koennte trotzdem eine bereits vergebene Kennung
  // erneut zuteilen (siehe einheiten-generator.ts). Ohne diese eigene Regel wuerde eine
  // doppelte Kennung die Validierung unbemerkt passieren.
  const idGesehen = new Map<string, number[]>();
  p.einheiten.forEach((e, i) => {
    idGesehen.set(e.id, [...(idGesehen.get(e.id) ?? []), i]);
  });
  for (const [id, indizes] of idGesehen) {
    if (indizes.length > 1) {
      for (const i of indizes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['einheiten', i, 'id'],
          params: { regel: 'EINHEIT_ID_DOPPELT', id },
          message: 'EINHEIT_ID_DOPPELT',
        });
      }
    }
  }

  const bekannteMerkmale = new Set(p.merkmale.map((m) => m.id));
  p.anpassungsSpalten.forEach((s, i) => {
    if (s.regel !== undefined && !bekannteMerkmale.has(s.regel.merkmal)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anpassungsSpalten', i, 'regel', 'merkmal'],
        params: { regel: 'MERKMAL_UNBEKANNT', merkmal: s.regel.merkmal },
        message: 'MERKMAL_UNBEKANNT',
      });
    }
  });
});

export type Projekt = z.infer<typeof projektSchema>;
export type Referenzobjekt = z.infer<typeof referenzobjektSchema>;
export type AnpassungsSpalte = z.infer<typeof anpassungsSpalteSchema>;
export type ProjektEinheit = z.infer<typeof einheitSchema>;
export type Merkmal = z.infer<typeof merkmalSchema>;
export type Bereichsregel = z.infer<typeof bereichsregelSchema>;
