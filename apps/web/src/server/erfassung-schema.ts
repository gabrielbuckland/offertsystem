/**
 * Keine Formel. Erfassungsschema als FUNKTION der Konfiguration (US-01, I-01, I-06, I-07).
 *
 * Ein Artefakt fuer Typen und Laufzeitpruefung; keine zweite Regelmenge im Formular. Die
 * Grenzen fuer die Anpassungssumme stammen aus `preisanpassung`, nicht aus einem Literal:
 * Ein im Code gefuehrter Grenzwert waere ein zweiter Konfigurationsort und wuerde beim
 * naechsten Konfigwechsel stillschweigend danebenliegen.
 *
 * Die Aggregatregeln (Eindeutigkeit der Wohnungsnummer, genau ein Typ je Zimmerzahl)
 * stehen in `superRefine` auf Aggregatebene und nicht je Feld — eine Kollision ist eine
 * Aussage ueber die Menge, nicht ueber einen einzelnen Wert.
 */
import type { Konfiguration } from '@offert/core';
import { z } from 'zod';

/** Verbindliche Feldliste der Dossier-Parametrisierung (E-28); zehn Felder, nicht mehr. */
const dossierParameterSchema = z.object({
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

export function erfassungsSchema(k: Konfiguration) {
  const flaeche = z.number().positive();
  const anpassung = z.object({
    faktor: z.number().gt(-1), // I-06
    erfassungsform: z.enum(['relativ', 'absolut']),
    erfassterBetrag: z.number().int().optional(),
    begruendung: z.string().trim().min(k.preisanpassung.begruendungMinLaenge),
    vorlageId: z.string().optional(),
  }).strict();

  const einheit = z.object({
    wohnungsnummer: z.string().trim().min(1),
    wohnungstypId: z.string().min(1),
    flaecheInnen: flaeche,
    flaecheAussen: z.number().nonnegative(),
    stockwerk: z.number().int(),
    parkplaetze: z.number().int().nonnegative(),
    anpassungen: z.array(anpassung),
  }).strict().superRefine((e, ctx) => {
    const summe = e.anpassungen.reduce((s, a) => s + a.faktor, 0);
    if (summe < k.preisanpassung.zMin || summe > k.preisanpassung.zMax) { // I-07
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ['anpassungen'],
        params: { regel: 'Z_GRENZEN', z: summe,
                  min: k.preisanpassung.zMin, max: k.preisanpassung.zMax },
        message: 'Z_GRENZEN',
      });
    }
  });

  return z.object({
    kunde: z.object({
      name: z.string().trim().min(1),
      referenznummer: z.string().trim().min(1),
      kontakt: z.object({
        email: z.string().email().optional(),
        telefon: z.string().optional(),
        adresse: z.string().optional(),
      }).strict(),
    }).strict(),
    liegenschaft: z.object({
      adresse: z.object({
        strasse: z.string().trim().min(1),
        hausnummer: z.string().trim().min(1),
        plz: z.string().regex(/^\d{4}$/),
        ort: z.string().trim().min(1),
      }).strict(),
      baujahr: z.number().int(),
      grundstuecksflaeche: flaeche,
    }).strict(),
    wohnungstypen: z.array(z.object({
      id: z.string().min(1),
      zimmerzahl: z.number().min(1).max(12),
      parametrisierung: dossierParameterSchema, // E-28, zehn Felder
    }).strict()).min(1),
    einheiten: z.array(einheit).min(1),
    aufwandfaktoren: z.record(z.number()), // datengetrieben, Aufgabe 15
  }).strict().superRefine((e, ctx) => {
    // I-01: Eindeutigkeit auf Aggregatebene, nicht je Feld. Gemeldet wird an ALLEN
    // kollidierenden Einheiten — sonst muesste der Vermarkter raten, welche gemeint ist.
    const gesehen = new Map<string, number[]>();
    e.einheiten.forEach((u, i) => {
      const eintraege = gesehen.get(u.wohnungsnummer) ?? [];
      eintraege.push(i);
      gesehen.set(u.wohnungsnummer, eintraege);
    });
    for (const [nummer, indizes] of gesehen) {
      if (indizes.length > 1) {
        for (const i of indizes) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['einheiten', i, 'wohnungsnummer'],
            params: { regel: 'NUMMER_DOPPELT', nummer, indizes },
            message: 'NUMMER_DOPPELT',
          });
        }
      }
    }
    // US-02: genau ein Wohnungstyp je vorkommender Zimmerzahl.
    const zimmer = new Set<number>();
    e.wohnungstypen.forEach((t, i) => {
      if (zimmer.has(t.zimmerzahl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: ['wohnungstypen', i, 'zimmerzahl'],
          params: { regel: 'TYP_DOPPELT', zimmerzahl: t.zimmerzahl }, message: 'TYP_DOPPELT',
        });
      }
      zimmer.add(t.zimmerzahl);
    });
  });
}

export type Erfassung = z.infer<ReturnType<typeof erfassungsSchema>>;
