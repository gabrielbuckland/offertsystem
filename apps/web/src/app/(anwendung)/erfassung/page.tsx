/**
 * Erfassungsseite. Konfiguration, Faktorformular und Vorlagen entstehen serverseitig aus
 * der einen Verdrahtung (PE-24) und werden dem Ablauf hineingereicht; die Seite haelt
 * selbst keinen Konfigurationszugriff.
 */
import { leseVorlagen } from '../../../server/anpassungsvorlagen.js';
import { baueFaktorformular } from '../../../server/faktorformular.js';
import { holeLaufzeit } from '../../../server/laufzeit.js';
import { ErfassungsAblauf } from '../../../components/schritte/ErfassungsAblauf.js';
import type { AblaufZustand } from '../../../components/schritte/ablauf-zustand.js';

export const dynamic = 'force-dynamic';

export default function ErfassungsSeite() {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    // I-24: Ohne gueltige Grundlage wird nicht erfasst und nicht gerechnet.
    return <main><h1>Erfassung nicht möglich</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  const konfiguration = laufzeit.wert.konfiguration;
  const anfangszustand: AblaufZustand = {
    aktiverSchritt: 1,
    konfiguration,
    projekt: { referenznummer: '' },
    liegenschaft: {
      adresse: { strasse: '', hausnummer: '', plz: '', ort: '' },
    },
    wohnungstypen: [],
    einheiten: [],
    aufwandfaktoren: {},
    meldungen: [],
  };
  return (
    <main>
      <h1>Neue Offerte erfassen</h1>
      <ErfassungsAblauf anfangszustand={anfangszustand}
                        formular={baueFaktorformular(konfiguration)}
                        vorlagen={leseVorlagen(konfiguration)}
                        konfiguration={konfiguration} />
    </main>
  );
}
