/**
 * Keine Formel. Neubau-Standardvorlage des Offerttexts (Spec 2026-08-27 §5).
 *
 * Inhaltlich abgeleitet aus der realen Primus-Vermarktungsofferte
 * (bachelorarbeit/assets/Offerte Beispiel.docx), umgebaut von Umnutzung/Mieterverkauf
 * auf Erstvermarktung Neubau: Phase I Vermarktung ab Plan, Phase II Restvermarktung
 * nach Fertigstellung; Verkaufsunterlagen neubau-spezifisch. Die Vorlage ist
 * Ausgangspunkt, kein Fixum — der Vermarkter passt sie global (Einstellungen) oder je
 * Projekt an.
 */
import type { OffertDokument } from './dokument-schema.js';

export const VORLAGE_VERSION = '1';

type Inline = { type: 'text'; text: string } | { type: 'platzhalter'; attrs: { id: string } };

const t = (text: string): Inline => ({ type: 'text', text });
const ph = (id: string): Inline => ({ type: 'platzhalter', attrs: { id } });
const p = (...inline: Inline[]) => ({ type: 'paragraph' as const, content: inline });
const h1 = (text: string) =>
  ({ type: 'heading' as const, attrs: { level: 1 as const }, content: [t(text)] });
const h2 = (text: string) =>
  ({ type: 'heading' as const, attrs: { level: 2 as const }, content: [t(text)] });
const liste = (...eintraege: string[]) => ({
  type: 'bulletList' as const,
  content: eintraege.map((e) => ({ type: 'listItem' as const, content: [p(t(e))] })),
});

export function standardVorlage(): OffertDokument {
  return {
    type: 'doc',
    content: [
      h1('Ausgangslage'),
      p(t('Die Primus Property AG wurde von '), ph('auftraggeber'),
        t(' betreffend das Vermarktungsmandat für das Neubauprojekt an der '),
        ph('adresse'), t(' angefragt.')),
      p(t('Beim Vermarktungsobjekt handelt es sich um einen Neubau mit '),
        ph('anzahlEinheiten'), t(' Eigentumswohnungen in '), ph('anzahlWohnungstypen'),
        t(' Wohnungstypen. Ziel ist der vollständige Verkauf der Wohnungen im '
          + 'Stockwerkeigentum, mit einer möglichst hohen Vorverkaufsquote bereits '
          + 'ab Plan.')),
      h1('Konzeptioneller Ansatz'),
      h2('Phase I: Vermarktung ab Plan'),
      p(t('In einer ersten Phase werden die Wohnungen ab Plan vermarktet. Entscheidend '
        + 'sind vollständige, professionell aufbereitete Verkaufsunterlagen, damit '
        + 'Kaufinteressenten ohne Besichtigung eine fundierte Kaufentscheidung '
        + 'treffen können:')),
      liste(
        'Objektbeschrieb und Baubeschrieb',
        'Grundrisspläne mit präzisen Flächenangaben (HNF/NNF/AF)',
        'Visualisierungen der Wohnungen und der Umgebung',
        'Preisliste und Verfügbarkeitsübersicht',
        'Beschrieb des Ausbau- und Sonderwunschprozesses',
        'Entwurf der Stockwerkeigentümerreglemente mit Aufteilungsplänen',
        'Finanzierungsvorschlag einer regional ansässigen Bank',
      ),
      h2('Phase II: Restvermarktung nach Fertigstellung'),
      p(t('Nach Bezugsbereitschaft werden die verbleibenden Wohnungen mit '
        + 'Besichtigungen vor Ort vermarktet. Die Verkaufsunterlagen werden um '
        + 'Objektfotografie ergänzt; Lagequalität und Marktumfeld von '),
        ph('ort'), t(' werden in der Vermarktung aktiv herausgestellt.')),
      h2('Reporting'),
      liste(
        'Monatliches, schriftliches Reporting über Vermarktungsstand und Interessenten',
        'Überwachung der eingesetzten Marktbearbeitungsinstrumente inkl. Budget',
        'Jour fixe mit der Auftraggeberschaft, wenn gewünscht',
      ),
      h1('Pricing'),
      p(t('Die Wohnungspreise stützen sich auf eine Referenzbewertung je Wohnungstyp '
        + 'und werden je Wohnung über begründete Zu- und Abschläge differenziert. '
        + 'Es resultieren die folgenden Angebotspreise:')),
      { type: 'platzhalterTabelle' },
      p(t('Die Verkaufssumme über alle Wohnungen beträgt '), ph('verkaufssumme'), t('.')),
      h1('Dienstleistungs- und Honorarangebot'),
      h2('Leistungen'),
      liste(
        'Kickoff-Meeting mit der Auftraggeberschaft und Festlegung der Angebotspreise',
        'Aufbereitung der vollständigen Verkaufsunterlagen je Wohnung',
        'Publikation auf einschlägigen Plattformen und Interessentenbetreuung',
        'Beratungsgespräche, Preisverhandlungen und Reservationsvereinbarungen',
        'Unterstützung der Käuferschaft bei der Finanzierung',
        'Briefing des Notars und Koordination der öffentlichen Beurkundungen',
      ),
      h2('Honorar'),
      // Prozentsatz UND Frankenbetrag nebeneinander (Nachtrag Spec 2026-08-29): Der
      // gerundete Prozentsatz allein liesse sich vom Eigentuemer nicht verlustfrei auf
      // den massgebenden Betrag zurueckrechnen. Klammerform statt Nebensatz, damit der
      // Satz auch dann aufgeht, wenn `honorar` mangels Verkaufssumme «–» ist — der
      // Frankenbetrag steht unabhaengig davon als konkrete Zahl daneben.
      p(t('Gestützt auf den ermittelten Vermarktungsaufwand offerieren wir unsere '
        + 'Dienstleistungen mit einem Honorar von '), ph('honorar'),
        t(' der Verkaufssumme ('), ph('honorarBetrag'),
        t('). Sämtliche Angaben verstehen sich exklusive MwSt.; Drittkosten für '
          + 'Werbemassnahmen und Publikationen werden nach Aufwand und vorgängiger '
          + 'Freigabe verrechnet.')),
      p(t('Sehr gerne würden wir die offerierten Dienstleistungen für Sie ausführen. '
        + 'Wir sichern Ihnen eine kompetente, innovative und engagierte '
        + 'Vermarktungstätigkeit zu.')),
      p(t('Freundliche Grüsse'), ),
      p(t('PRIMUS PROPERTY AG')),
    ],
  };
}
