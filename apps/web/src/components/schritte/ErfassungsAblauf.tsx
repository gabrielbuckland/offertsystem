'use client';

/**
 * Haelt den Ablaufzustand und rendert den aktiven Schritt. Die gesamte Uebergangslogik
 * liegt im reinen Reduzierer `reduziere`; diese Komponente traegt nur die Bindung an
 * React und den Abruf ueber die Route.
 */
import { useReducer, useState } from 'react';
import type { Konfiguration } from '@offert/core';
import type { Faktorformular } from '../../server/faktorformular.js';
import type { Anpassungsvorlage } from '../../server/anpassungsvorlagen.js';
import { reduziere, SCHRITTE, type AblaufZustand } from './ablauf-zustand.js';
import { Schritt1Liegenschaft } from './Schritt1Liegenschaft.js';
import { Schritt2Wohnungstypen } from './Schritt2Wohnungstypen.js';
import { Schritt3Bewertungsabruf } from './Schritt3Bewertungsabruf.js';
import { Schritt4Einheiten } from './Schritt4Einheiten.js';
import { Schritt5Anpassungen } from './Schritt5Anpassungen.js';
import { Schritt6Aufwandfaktoren } from './Schritt6Aufwandfaktoren.js';

export interface ErfassungsAblaufProps {
  readonly anfangszustand: AblaufZustand;
  readonly formular: Faktorformular;
  readonly vorlagen: readonly Anpassungsvorlage[];
  readonly konfiguration: Konfiguration;
}

export function ErfassungsAblauf({ anfangszustand, formular, vorlagen }: ErfassungsAblaufProps) {
  const [zustand, sende] = useReducer(reduziere, anfangszustand);
  const [offertId, setzeOffertId] = useState<string | undefined>(undefined);

  async function sendeOfferte(): Promise<void> {
    const antwort = await fetch('/api/offerte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kunde: zustand.kunde,
        liegenschaft: zustand.liegenschaft,
        wohnungstypen: zustand.wohnungstypen,
        einheiten: zustand.einheiten,
        aufwandfaktoren: zustand.aufwandfaktoren,
      }),
    });
    const koerper = (await antwort.json()) as { offertId?: string };
    if (antwort.status === 201 && koerper.offertId !== undefined) {
      setzeOffertId(koerper.offertId);
    }
  }

  const setze = (pfad: string, wert: unknown): void => sende({ art: 'setze', pfad, wert });

  return (
    <div className="erfassung">
      <ol className="schrittleiste">
        {SCHRITTE.map((s) => (
          <li key={s.nummer} aria-current={s.nummer === zustand.aktiverSchritt ? 'step' : undefined}>
            {s.nummer}. {s.titel}
          </li>
        ))}
      </ol>

      {zustand.blockade !== undefined && <p role="alert" className="blockade">{zustand.blockade}</p>}
      {zustand.hinweis !== undefined && <p role="status" className="hinweis">{zustand.hinweis}</p>}

      {zustand.aktiverSchritt === 1 && (
        <Schritt1Liegenschaft kunde={zustand.kunde} liegenschaft={zustand.liegenschaft}
                              meldungen={zustand.meldungen} setze={setze} />
      )}
      {zustand.aktiverSchritt === 2 && (
        <Schritt2Wohnungstypen wohnungstypen={zustand.wohnungstypen}
                               meldungen={zustand.meldungen} setze={setze}
                               ergaenze={() => sende({ art: 'typHinzu' })}
                               entferne={(index) => sende({ art: 'typEntfernen', index })} />
      )}
      {zustand.aktiverSchritt === 3 && (
        <Schritt3Bewertungsabruf zustand={zustand} rufeAb={() => undefined} />
      )}
      {zustand.aktiverSchritt === 4 && (
        <Schritt4Einheiten einheiten={zustand.einheiten} wohnungstypen={zustand.wohnungstypen}
                           meldungen={zustand.meldungen} setze={setze}
                           ergaenze={() => sende({ art: 'einheitHinzu' })}
                           entferne={(index) => sende({ art: 'einheitEntfernen', index })} />
      )}
      {zustand.aktiverSchritt === 5 && (
        <Schritt5Anpassungen
          einheiten={zustand.einheiten.map((e) => ({
            wohnungsnummer: String(e['wohnungsnummer']),
            anpassungen: (e['anpassungen'] ?? []) as readonly { faktor: number; begruendung: string }[],
          }))}
          vorlagen={vorlagen}
          meldungen={zustand.meldungen}
          uebernimm={() => undefined}
          aendere={() => undefined}
          entferne={() => undefined}
          ergaenze={() => undefined} />
      )}
      {zustand.aktiverSchritt === 6 && (
        <Schritt6Aufwandfaktoren formular={formular} werte={zustand.aufwandfaktoren}
                                 rohwerte={{}} meldungen={zustand.meldungen}
                                 aendere={(id, wert) => setze(`aufwandfaktoren.${id}`, wert)} />
      )}
      {zustand.aktiverSchritt === 7 && (
        <section>
          <h2>Ergebnis</h2>
          {offertId === undefined ? (
            <button type="button" className="bedienelement" onClick={() => void sendeOfferte()}>
              Offerte erzeugen
            </button>
          ) : (
            <a href={`/offerte/${offertId}`}>Zur erzeugten Offerte</a>
          )}
        </section>
      )}

      <nav className="bedienelement">
        <button type="button" onClick={() => sende({ art: 'zurueck' })}>Zurück</button>
        <button type="button" onClick={() => sende({ art: 'weiter' })}>Weiter</button>
      </nav>
    </div>
  );
}
