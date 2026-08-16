/**
 * Keine Formel. Reine Funktion Offer -> HTML (Spec 05 §5).
 *
 * Ohne Zustand, ohne Datenabruf, ohne Effekte: Dieselbe Komponente traegt die
 * Bildschirmdarstellung UND den PDF-Druck (AK-2.1). Ein zweiter Renderpfad koennte
 * abweichen, ohne dass ein Test es saehe — und die Zusage «PDF und HTML zeigen
 * dieselben Zahlen» waere dann nicht belegbar, sondern nur behauptet.
 *
 * Kein einzelner Faktorbezeichner steht im Markup: Die Faktortabelle iteriert ueber
 * `aggregates.effortFactors` (I-13).
 */
import {
  formatiereAggregat,
  formatiereBetrag,
  formatiereDatum,
  formatiereFlaeche,
  formatiereProzent,
  formatiereScore,
  formatiereZimmerzahl,
} from '../format/de-ch.js';
import type { Offer, TierTrace } from '../model/offer.js';
import { HerkunftsBlock, HerkunftsWert } from './HerkunftsWert.js';

function DossierParameterTabelle(
  { parameter }: { parameter: Offer['derivation']['apartmentTypes'][number]['dossierParameters'] },
) {
  const zeilen: readonly (readonly [string, string])[] = [
    ['Innenfläche', formatiereFlaeche(parameter.flaecheInnen)],
    ['Aussenfläche', formatiereFlaeche(parameter.flaecheAussen)],
    ['Stockwerk', String(parameter.stockwerk)],
    ['Energielabel', parameter.energielabel],
    ['Anzahl Badezimmer', String(parameter.anzahlBadezimmer)],
    ['Lift', parameter.lift ? 'ja' : 'nein'],
    ['Baujahr', String(parameter.baujahr)],
    ['Heizungsart', parameter.heizungsart],
  ];
  return (
    <table className="dossier-parameter">
      <tbody>
        {zeilen.map(([bezeichnung, wert]) => (
          <tr key={bezeichnung}><th scope="row">{bezeichnung}</th><td>{wert}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Gibt die Stufenwahl vollstaendig aus: k, die Stufengrenzen, die vier Stuetzwerte, den
 * Interpolationsanteil und die ungerundeten Basen. Damit ist die Interpolation allein
 * aus der Darstellung nachrechenbar (AK-1.9, US-12).
 */
function StufenHerleitung(
  { tier, basis }: { tier: TierTrace; basis: { min: number; max: number } },
) {
  const zeilen: readonly (readonly [string, string])[] = [
    ['Stufenindex k', String(tier.k)],
    ['Stufenuntergrenze V_k^min', formatiereAggregat(tier.vMin)],
    ['Stufenobergrenze V_k^max', formatiereAggregat(tier.vMax)],
    ['H_min^(k)', formatiereAggregat(tier.hMinK)],
    ['H_min^(k+1)', formatiereAggregat(tier.hMinK1)],
    ['H_max^(k)', formatiereAggregat(tier.hMaxK)],
    ['H_max^(k+1)', formatiereAggregat(tier.hMaxK1)],
    ['Interpolationsanteil t', formatiereScore(tier.interpolationsAnteil)],
    ['H_min(V) ungerundet', formatiereBetrag(basis.min)],
    ['H_max(V) ungerundet', formatiereBetrag(basis.max)],
  ];
  return (
    <table className="stufen-herleitung">
      <tbody>
        {zeilen.map(([bezeichnung, wert]) => (
          <tr key={bezeichnung}><th scope="row">{bezeichnung}</th><td>{wert}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/** Flacher Pfadaufbau der eingebetteten Konfigurationskopie (E-26). */
function flacheEintraege(wert: unknown, praefix = ''): readonly (readonly [string, string])[] {
  if (Array.isArray(wert)) {
    return wert.flatMap((eintrag, i) => flacheEintraege(eintrag, `${praefix}[${i}]`));
  }
  if (typeof wert === 'object' && wert !== null) {
    return Object.entries(wert).flatMap(([schluessel, inhalt]) =>
      flacheEintraege(inhalt, praefix === '' ? schluessel : `${praefix}.${schluessel}`));
  }
  return [[praefix, String(wert)]];
}

export function OfferteDokument({ offerte }: { offerte: Offer }) {
  const a = offerte.aggregates;
  return (
    <article className="offerte" data-druck-bereit="true">
      <header className="offerte__kopf">
        <h1>Offerte {offerte.metadata.referenznummer}</h1>
        <p>Erstellt am {formatiereDatum(offerte.metadata.erstelltAm)}</p>
        <p>{offerte.customer.name}</p>
        <p>
          {offerte.property.adresse.strasse} {offerte.property.adresse.hausnummer},{' '}
          {offerte.property.adresse.plz} {offerte.property.adresse.ort}
        </p>
      </header>

      <HerkunftsBlock klasse="pricehubble" titel="Bewertungsgrundlage">
        {offerte.derivation.apartmentTypes.map((t) => (
          <div key={t.typeId} className="typ">
            <h4>{formatiereZimmerzahl(t.roomCount)} Zimmer</h4>
            <DossierParameterTabelle parameter={t.dossierParameters} />
            <HerkunftsWert wert={{ value: t.referenceValuation.value.marktwert,
                                   provenance: 'pricehubble' }}
                           beschriftung="Referenz-Marktwert"
                           formatiere={formatiereAggregat} />
            <p className="anzeigeinformation">
              Konfidenzbereich{' '}
              {formatiereAggregat(t.referenceValuation.value.konfidenzbereich.von)} bis{' '}
              {formatiereAggregat(t.referenceValuation.value.konfidenzbereich.bis)},{' '}
              Konfidenzklasse {t.referenceValuation.value.konfidenzklasse},{' '}
              Bewertungsdatum {formatiereDatum(t.referenceValuation.value.bewertungsdatum)}
              {' '}— reine Anzeigeinformation, ohne rechnerische Wirkung.
            </p>
          </div>
        ))}
        <ul className="lagescores">
          {offerte.property.lagescores.map((s) => (
            <li key={s.value.name} data-herkunft="pricehubble">
              {s.value.name}: {formatiereScore(s.value.score)}
            </li>
          ))}
        </ul>
      </HerkunftsBlock>

      <HerkunftsBlock klasse="local-derivation" titel="Preisableitung">
        <p>Verwendetes α = {formatiereScore(offerte.derivation.alpha)} (eq:flaeche)</p>
        <table className="typen">
          <thead><tr><th>Wohnungstyp</th><th>Gewichtete Referenzfläche</th>
                     <th>Quadratmeterpreis (eq:qm_preis)</th></tr></thead>
          <tbody>
            {offerte.derivation.apartmentTypes.map((t) => (
              <tr key={t.typeId}>
                <td>{formatiereZimmerzahl(t.roomCount)} Zimmer</td>
                <td>{formatiereFlaeche(t.referenceArea.value)}</td>
                <td>{formatiereBetrag(t.pricePerSqm.value)} / m²</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="einheiten">
          <thead><tr><th>Einheit</th><th>Gewichtete Fläche</th><th>Basispreis</th>
                     <th>Anpassungen</th><th>z_j</th><th>Wohnungspreis</th></tr></thead>
          <tbody>
            {offerte.derivation.units.map((u) => (
              <tr key={u.unitNumber} className="einheit-zeile">
                <td>{u.unitNumber}</td>
                <td>{formatiereFlaeche(u.weightedArea.value)}</td>
                <td>{formatiereBetrag(u.basePrice.value)}</td>
                <td>
                  <ul>
                    {u.adjustments.map((adj, i) => (
                      <li key={`${u.unitNumber}-${i}`} data-herkunft="marketer-adjustment">
                        {formatiereProzent(adj.value.factor)}
                        {adj.value.enteredAs === 'amount' && adj.value.enteredAmount !== undefined
                          ? ` (erfasst als ${formatiereBetrag(adj.value.enteredAmount)})` : ''}
                        {' — '}{adj.value.justification}
                      </li>
                    ))}
                  </ul>
                </td>
                <td data-herkunft="marketer-adjustment">
                  {formatiereProzent(u.adjustmentSum.value)}
                </td>
                <td>{formatiereBetrag(u.unitPrice.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HerkunftsBlock>

      <HerkunftsBlock klasse="local-calculation" titel="Aggregierte Werte">
        <HerkunftsWert wert={a.totalSalesValue}
                       beschriftung="Verkaufssumme V (eq:verkaufssumme)"
                       formatiere={formatiereAggregat} />
        <table className="faktoren">
          <thead><tr><th>Aufwandfaktor</th><th>Quelle</th><th>Rohwert</th><th>Grenzen</th>
                     <th>x̂_d</th><th>gekappt</th><th>w_d</th><th>w_d · x̂_d</th></tr></thead>
          <tbody>
            {a.effortFactors.map((f) => (
              <tr key={f.id}>
                <td>{f.bezeichnung}</td><td>{f.quelle}</td>
                <td>{formatiereScore(f.rawValue)}</td>
                <td>{formatiereScore(f.grenzeMin)} … {formatiereScore(f.grenzeMax)}</td>
                <td>{formatiereScore(f.normalised)}</td>
                <td>{f.gekappt ? 'ja' : 'nein'}</td>
                <td>{formatiereScore(f.weight)}</td>
                <td>{formatiereScore(f.beitrag)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={6}>Σ w_d</td>
                     <td colSpan={2}>{formatiereScore(a.gewichtssumme)}</td></tr></tfoot>
        </table>
        <p className="einheitenzahl">Einheitenzahl m = {a.einheitenzahl}</p>
        <HerkunftsWert wert={a.effortIndicator}
                       beschriftung="Aufwandindikator D (eq:aufwandindikator)"
                       formatiere={formatiereScore} />
        <StufenHerleitung tier={a.feeTier.value} basis={a.feeBasis.value} />
        <HerkunftsWert wert={a.scalingFactor}
                       beschriftung="Skalierungsfaktor g(D)" formatiere={formatiereScore} />
        <HerkunftsWert wert={a.feeRange}
                       beschriftung="Honorarrange (eq:honorar_mapping)"
                       formatiere={(r) => `${formatiereAggregat(r.min)} – ${formatiereAggregat(r.max)}`} />
      </HerkunftsBlock>

      <section className="offerte__grundlagen" data-herkunft="local-calculation">
        <h3>Berechnungsgrundlagen</h3>
        <p>Konfigurationsversion {offerte.metadata.konfigVersion}</p>
        <p>Prüfsumme {offerte.metadata.konfigPruefsumme}</p>
        <table className="bewertungsversion">
          <thead><tr><th>Wohnungstyp</th><th>Bewertungsdatum</th><th>Konfidenzklasse</th></tr></thead>
          <tbody>
            {offerte.metadata.bewertungsversion.map((b) => (
              <tr key={b.typeId}>
                <td>{b.typeId}</td>
                <td>{formatiereDatum(b.bewertungsdatum)}</td>
                <td>{b.konfidenzklasse}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="konfigurationsabdruck">
          <tbody>
            {flacheEintraege(offerte.metadata.konfigurationsAbdruck).map(([pfad, wert]) => (
              <tr key={pfad}><th scope="row">{pfad}</th><td>{wert}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}
