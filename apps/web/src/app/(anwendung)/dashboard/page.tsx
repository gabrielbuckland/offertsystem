import { OffertenListe } from '../../../components/OffertenListe.js';
import { verzeichnisAusLaufzeit } from '../../../server/laufzeit.js';
import { listeOfferten } from '../../../server/offerten-ablage.js';

export const dynamic = 'force-dynamic';

export default async function DashboardSeite() {
  // Der Ablageort wird ANGEZEIGT, nicht im Code benannt: Er stammt aus der Umgebung
  // (PE-24, E-14), und ein Literal hier waere ein zweiter Konfigurationsort.
  const verzeichnis = verzeichnisAusLaufzeit();
  const eintraege = await listeOfferten(verzeichnis);
  return (
    <main>
      <h1>Erzeugte Offerten</h1>
      <p>
        Ablage: <code>{verzeichnis}</code> — dateibasierte JSON-Artefakte, append-only.
      </p>
      <OffertenListe eintraege={eintraege} />
    </main>
  );
}
