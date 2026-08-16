/**
 * Meldungen werden AM FELD gerendert, nicht als Sammelliste am Formularkopf
 * (US-01, AK-3.5): Eine Sammelliste zwingt zum Suchen und verliert die Zuordnung,
 * sobald mehrere Felder betroffen sind.
 */
import type { Feldmeldung } from '../server/feldmeldungen.js';

export function FeldMeldung(
  { feldpfad, meldungen }: { feldpfad: string; meldungen: readonly Feldmeldung[] },
) {
  const treffer = meldungen.filter((m) => m.feldpfad === feldpfad);
  if (treffer.length === 0) return null;
  return (
    <ul className="feldmeldung" role="alert" data-feld={feldpfad}>
      {treffer.map((m) => <li key={m.text}>{m.text}</li>)}
    </ul>
  );
}
