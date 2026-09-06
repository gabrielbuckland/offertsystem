// Keine Formel. Reine Funktion Offer -> kundengerichtetes HTML. Gerendert wird
// ausschliesslich das aufgeloeste Dokument, nicht die Vorlage und nicht der Rechenweg
// (Benutzerentscheid 2026-08-27). Kopfblock kommt aus dem Offert-Objekt, Fliesstext aus
// dem Dokument — der Vermarkter kann den Kopf nicht zertippen. Dieselbe Komponente traegt
// Bildschirm und PDF-Druck (AK-2.1); Bereitschaftssignal bleibt `data-druck-bereit`.
import type { ReactNode } from 'react';
import { formatiereDatum } from '../format/de-ch.js';
import type { Offer } from '../model/offer.js';
import type { AufgeloesterBlock, TextKnoten } from '../vorlage/dokument-schema.js';

function InlineText({ knoten }: { knoten: TextKnoten }) {
  const marks = knoten.marks ?? [];
  let inhalt: ReactNode = knoten.text;
  if (marks.some((m) => m.type === 'italic')) inhalt = <em>{inhalt}</em>;
  if (marks.some((m) => m.type === 'bold')) inhalt = <strong>{inhalt}</strong>;
  return <>{inhalt}</>;
}

function Inhalt({ inline }: { inline?: readonly TextKnoten[] | undefined }) {
  return <>{(inline ?? []).map((k, i) => <InlineText key={i} knoten={k} />)}</>;
}

function BlockKnoten({ knoten }: { knoten: AufgeloesterBlock }) {
  switch (knoten.type) {
    case 'paragraph':
      return <p><Inhalt inline={knoten.content} /></p>;
    case 'heading': {
      // Dokument-Ebene 1 wird zu h2: h1 ist der Offert-Titel im Kopfblock.
      const Tag = (['h2', 'h3', 'h4'] as const)[knoten.attrs.level - 1]!;
      return <Tag><Inhalt inline={knoten.content} /></Tag>;
    }
    case 'bulletList':
      return (
        <ul>
          {knoten.content.map((li, i) => (
            <li key={i}>
              {/* In <p> gewickelt: Schema laesst mehrere Absaetze je Listenpunkt zu. */}
              {li.content.map((p, j) => (
                <p key={j}><Inhalt inline={p.content} /></p>
              ))}
            </li>
          ))}
        </ul>
      );
    case 'orderedList':
      return (
        <ol>
          {knoten.content.map((li, i) => (
            <li key={i}>
              {li.content.map((p, j) => (
                <p key={j}><Inhalt inline={p.content} /></p>
              ))}
            </li>
          ))}
        </ol>
      );
    case 'preistabelle':
      return (
        <table className="preistabelle">
          <thead>
            <tr><th>Wohnung</th><th>Gewichtete Fläche</th><th>Angebotspreis</th></tr>
          </thead>
          <tbody>
            {knoten.attrs.zeilen.map((z) => (
              <tr key={z.einheit}>
                <td>{z.einheit}</td><td>{z.flaeche}</td><td>{z.preis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

export function VermarktungsOfferte({ offerte }: { offerte: Offer }) {
  const dokument = offerte.dokument;
  if (dokument === undefined) throw new Error('Offerte ohne Dokument');
  const adresse = offerte.property.adresse;
  return (
    <article className="vermarktungsofferte" data-druck-bereit="true">
      <header className="vermarktungsofferte__kopf">
        <h1>Vermarktungsofferte</h1>
        <p className="vermarktungsofferte__objekt">
          Überbauung {adresse.strasse} {adresse.hausnummer}, {adresse.plz} {adresse.ort}
        </p>
        <dl className="vermarktungsofferte__angaben">
          <dt>Stand</dt><dd>{formatiereDatum(offerte.metadata.erstelltAm)}</dd>
          {dokument.auftraggeber === undefined ? null : (
            <><dt>Auftraggeber</dt><dd>{dokument.auftraggeber}</dd></>
          )}
        </dl>
      </header>
      {dokument.inhalt.content.map((b, i) => <BlockKnoten key={i} knoten={b} />)}
    </article>
  );
}
