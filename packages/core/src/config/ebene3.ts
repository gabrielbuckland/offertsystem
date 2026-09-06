// eq:aufwandindikator (Gewichtssumme), eq:honorar_mapping (Stufenordnung, g),
// eq:degression_stufe, eq:netto_degression, eq:normalisierung (Zielintervall der
// Strategien). Ebene 3: fachliche Invarianten, ohne Projektdaten (I-21).
import { pruefeNettoDegression, pruefeStufenDegression } from './degression.js';
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import { ABLEITUNGS_NAMEN, BEZEICHNER_MUSTER, LAGESCORE_NAMEN, type RohKonfiguration } from './schema.js';
import { normalisiereBereiche, pruefeBereiche } from '../modell/bereichsregel.js';

// Toleranz der Summenbedingung, Bestandteil der Invariantendefinition I-12.
export const GEWICHTSSUMME_TOLERANZ = 1e-9;

function pruefeGewichtssumme(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const eintraege = Object.entries(konfiguration.aufwandfaktoren);
  const summe = eintraege.reduce((wert, [, faktor]) => wert + faktor.gewicht, 0);
  if (eintraege.length === 0 || Math.abs(summe - 1) > GEWICHTSSUMME_TOLERANZ) {
    return [fehler('CFG_WEIGHTS_SUM', 'aufwandfaktoren', {
      anzahl: eintraege.length,
      summe,
      toleranz: GEWICHTSSUMME_TOLERANZ,
      einzelbeitraege: eintraege.map(([name, f]) => `${name} ${f.gewicht.toFixed(3)}`).join(', '),
      formel: 'eq:aufwandindikator',
    })];
  }
  return [];
}

function pruefeStuetzstellenordnung(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const stuetzstellen = konfiguration.honorar.stuetzstellen;
  if (stuetzstellen.length < 2) {
    return [fehler('CFG_TIER_OPEN', 'honorar.stuetzstellen', {
      anzahl: stuetzstellen.length,
      bedingung: 'mindestens zwei Stuetzstellen; die oberste Stufe braucht eine abschliessende',
      formel: 'eq:honorar_mapping',
    })];
  }
  const befunde: KonfigurationsFehler[] = [];
  for (let k = 1; k < stuetzstellen.length; k += 1) {
    const links = stuetzstellen[k - 1];
    const rechts = stuetzstellen[k];
    if (links === undefined || rechts === undefined) continue;
    if (!(rechts.v > links.v)) {
      befunde.push(fehler('CFG_TIER_ORDER', `honorar.stuetzstellen[${k}].v`, {
        stufe: k - 1,
        vorher: links.v,
        nachher: rechts.v,
        bedingung: 'streng aufsteigend; sonst Stufenbreite 0 und Division durch null',
        formel: 'eq:honorar_mapping',
      }));
    }
  }
  return befunde;
}

function pruefeSkalierungsordnung(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const { gMin, gMax } = konfiguration.honorar.skalierung;
  if (gMin > gMax || !(gMin <= 1 && gMax >= 1)) {
    return [fehler('CFG_G_ORDER', 'honorar.skalierung', {
      gMin,
      gMax,
      bedingung: '0 < gMin <= 1 <= gMax; ohne die 1 im Bildbereich gaebe es kein neutrales Aufwandniveau',
      formel: 'eq:honorar_mapping',
    })];
  }
  return [];
}

function pruefeStrategien(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];
  for (const [name, faktor] of Object.entries(konfiguration.aufwandfaktoren)) {
    if (faktor.strategie !== 'zscore') continue;
    const verteilung = faktor.referenzverteilung;
    if (verteilung === undefined || !(verteilung.kappungSigma > 0)) {
      befunde.push(fehler('CFG_ZSCORE_CAP', `aufwandfaktoren.${name}`, {
        faktor: name,
        bedingung: 'referenzverteilung.kappungSigma > 0',
        formel: 'eq:normalisierung',
      }));
    }
  }
  return befunde;
}

function pruefeFaktorquellen(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];
  for (const [name, faktor] of Object.entries(konfiguration.aufwandfaktoren)) {
    const schluessel = faktor.quellSchluessel;
    const aufloesbar =
      faktor.quelle === 'lagescore' ? (LAGESCORE_NAMEN as readonly string[]).includes(schluessel)
      : faktor.quelle === 'abgeleitet' ? (ABLEITUNGS_NAMEN as readonly string[]).includes(schluessel)
      : BEZEICHNER_MUSTER.test(schluessel);
    if (!aufloesbar) {
      befunde.push(fehler('CFG_SOURCE_UNRESOLVED', `aufwandfaktoren.${name}.quellSchluessel`, {
        faktor: name,
        quelle: faktor.quelle,
        quellSchluessel: schluessel,
        verfuegbar: faktor.quelle === 'lagescore' ? LAGESCORE_NAMEN.join(', ')
          : faktor.quelle === 'abgeleitet' ? ABLEITUNGS_NAMEN.join(', ')
          : 'Bezeichner nach dem Muster ^[a-z][a-zA-Z0-9_]*$',
      }));
    }
  }
  return befunde;
}

function pruefeAnpassungsVorlagen(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];
  const { zMin, zMax, begruendungMinLaenge } = konfiguration.preisanpassung;
  const gesehen = new Set<string>();
  konfiguration.anpassungsVorlagen.forEach((vorlage, index) => {
    const gruende: string[] = [];
    if (vorlage.vorgabefaktor < zMin || vorlage.vorgabefaktor > zMax) {
      gruende.push(`vorgabefaktor ${vorlage.vorgabefaktor} ausserhalb [${zMin}, ${zMax}]`);
    }
    if (vorlage.begruendungVorschlag.length < begruendungMinLaenge) {
      gruende.push(`begruendungVorschlag kuerzer als ${begruendungMinLaenge} Zeichen`);
    }
    if (gesehen.has(vorlage.id)) gruende.push(`id '${vorlage.id}' ist doppelt vergeben`);
    gesehen.add(vorlage.id);
    if (gruende.length > 0) {
      befunde.push(fehler('CFG_TEMPLATE_BOUNDS', `anpassungsVorlagen[${index}]`, {
        index,
        bezeichnung: vorlage.bezeichnung,
        bedingung: gruende.join('; '),
      }));
    }
  });
  return befunde;
}

// Die Oberflaeche verhindert eine Kollision bei Neuanlage, kann eine bereits gespeicherte
// Konfiguration aber nicht rueckwirkend heilen. Ohne diese Pruefung schreiben zwei
// Tabellenspalten denselben merkmalswerte-Schluessel und React saehe doppelte Keys.
function pruefeMerkmale(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];
  const gesehen = new Set<string>();
  konfiguration.merkmale.forEach((merkmal, index) => {
    if (gesehen.has(merkmal.id)) {
      befunde.push(fehler('CFG_MERKMAL_DUPLICATE', `merkmale[${index}]`, {
        index,
        id: merkmal.id,
        bedingung: `id '${merkmal.id}' ist doppelt vergeben`,
      }));
    }
    gesehen.add(merkmal.id);
  });
  return befunde;
}

// Ebene 3 und nicht 2: blickt ueber das Feld hinaus (Merkmalsliste, z-Grenzen,
// Erfassungsform). Wertschranke vorverlegt: eine Staffel mit unzulaessigem Zuschlag ist
// schon beim Laden falsch, nicht erst wenn eine Einheit in den Bereich faellt.
function pruefeBereichsregeln(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];
  const { zMin, zMax } = konfiguration.preisanpassung;
  const bekannteMerkmale = new Set(konfiguration.merkmale.map((m) => m.id));

  konfiguration.anpassungsVorlagen.forEach((vorlage, index) => {
    const regel = vorlage.regel;
    if (regel === undefined) return;

    const gruende: string[] = [...pruefeBereiche(normalisiereBereiche(regel.bereiche))];

    if (!bekannteMerkmale.has(regel.merkmal)) {
      gruende.push(`Merkmal '${regel.merkmal}' ist nicht deklariert.`);
    }
    if (vorlage.vorgabefaktor !== 0) {
      gruende.push('Regel und Vorgabewert stehen nebeneinander; der Vorgabewert haette keine Bedeutung.');
    }
    for (const [i, b] of regel.bereiche.entries()) {
      if (vorlage.erfassungsform === 'relativ' && (b.wert < zMin || b.wert > zMax)) {
        gruende.push(`Bereich ${i}: Wert ${b.wert} ausserhalb [${zMin}, ${zMax}].`);
      }
      if (vorlage.erfassungsform === 'absolut' && !Number.isInteger(b.wert)) {
        gruende.push(`Bereich ${i}: absolute Werte sind ganzzahlige Rappen.`);
      }
    }

    if (gruende.length > 0) {
      befunde.push(fehler('CFG_BEREICHSREGEL', `anpassungsVorlagen[${index}].regel`, {
        index,
        bezeichnung: vorlage.bezeichnung,
        bedingung: gruende.join('; '),
      }));
    }
  });
  return befunde;
}

export function pruefeEbene3(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [
    ...pruefeGewichtssumme(konfiguration),
    ...pruefeSkalierungsordnung(konfiguration),
    ...pruefeStrategien(konfiguration),
    ...pruefeFaktorquellen(konfiguration),
    ...pruefeAnpassungsVorlagen(konfiguration),
    ...pruefeMerkmale(konfiguration),
    ...pruefeBereichsregeln(konfiguration),
  ];

  const ordnung = pruefeStuetzstellenordnung(konfiguration);
  befunde.push(...ordnung);
  // Die Degressionspruefungen setzen eine geordnete Stuetzstellenfolge voraus;
  // ohne sie waeren ihre Meldungen Folgefehler und wuerden den Bediener in die Irre fuehren.
  if (ordnung.length === 0) {
    befunde.push(...pruefeStufenDegression(konfiguration.honorar.stuetzstellen));
    befunde.push(...pruefeNettoDegression(konfiguration));
  }

  return befunde;
}
