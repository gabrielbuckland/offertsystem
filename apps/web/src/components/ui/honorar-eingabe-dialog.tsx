'use client';

/**
 * Eingabemodal fuer den gewaehlten Honorarbetrag vor dem Erzeugen der Offerte (Spec
 * 2026-08-29): Die Honorarrange ist ein INTERNES Instrument, der Eigentuemer sieht in
 * der Offerte einen einzigen Betrag. Natives `<dialog>` mit `showModal()` wie
 * `RechenwegDialog` — keine Dialog-Primitive/Radix im Projekt.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from './button.js';
import { Hinweis } from './hinweis.js';
import {
  formatiereHonorarAlsProzent, frankenEingabeZuRappen, honorarAbweichung, honorarSperrgrund,
} from './honorar-eingabe-logik.js';
import { Input } from './input.js';
import { Label } from './label.js';

export interface HonorarEingabeDialogProps {
  readonly offen: boolean;
  readonly honorarMin: number;
  readonly honorarMax: number;
  /** Bezugsgroesse der Prozentanzeige (Spec 2026-08-29); `undefined`, solange die
   *  Berechnung (noch) keine Verkaufssumme liefert — die Anzeige faellt dann auf `–` zurueck. */
  readonly verkaufssumme: number | undefined;
  readonly schliesse: () => void;
  readonly bestaetige: (gewaehltesHonorar: number) => void;
}

export function HonorarEingabeDialog(
  { offen, honorarMin, honorarMax, verkaufssumme, schliesse, bestaetige }: HonorarEingabeDialogProps,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [eingabe, setzeEingabe] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (offen && !dialog.open) {
      // Feld startet LEER (Nachtrag Spec 2026-08-29): keine Vorbelegung mit dem
      // Range-Mittelwert mehr — ein automatisch gesetzter Wert liefe als Entscheidung
      // des Vermarkters durch, obwohl ihn das System gesetzt hat (Automation Bias,
      // dieselbe Begruendung wie bei Zu-/Abschlagsvorlagen, §5.4/§6.8 der Arbeit).
      setzeEingabe('');
      dialog.showModal();
    }
    if (!offen && dialog.open) dialog.close();
  }, [offen]);

  const betrag = frankenEingabeZuRappen(eingabe);
  const abweichung = betrag === undefined
    ? undefined
    : honorarAbweichung(betrag, { min: honorarMin, max: honorarMax });
  const eingabeProzentText = betrag === undefined
    ? undefined
    : formatiereHonorarAlsProzent(betrag, verkaufssumme);
  const sperrgrund = honorarSperrgrund(eingabe, betrag);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Honorarbetrag"
      onClose={schliesse}
      // `m-auto` gegen Tailwinds Preflight-`margin: 0` (siehe Referenzobjekte.tsx).
      className="m-auto w-[min(28rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-background p-0 backdrop:bg-foreground/40"
    >
      {offen && (
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Honorarbetrag für die Offerte</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Empfohlen: {formatiereHonorarAlsProzent(honorarMin, verkaufssumme)} –{' '}
              {formatiereHonorarAlsProzent(honorarMax, verkaufssumme)} der Verkaufssumme.
              Die Offerte weist gegenüber dem Eigentümer einen einzigen Betrag aus, nicht
              die Range.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="honorar-eingabe">Honorar (CHF)</Label>
            <Input
              id="honorar-eingabe"
              type="number"
              step="0.01"
              value={eingabe}
              onChange={(e) => setzeEingabe(e.target.value)}
            />
            {eingabeProzentText !== undefined && (
              <p className="text-sm text-muted-foreground">
                Entspricht {eingabeProzentText} der Verkaufssumme.
              </p>
            )}
          </div>
          {abweichung !== undefined && abweichung !== 'im-bereich' && (
            <Hinweis art="warnung">
              {abweichung === 'unter-range'
                ? 'Der Betrag liegt unter der empfohlenen Range.'
                : 'Der Betrag liegt über der empfohlenen Range.'}
            </Hinweis>
          )}
          {/* Keine stumme Deaktivierung (Nachtrag Spec 2026-08-29): der Vermarkter sieht,
              warum «Offerte erzeugen» gesperrt ist, statt nur einen inaktiven Knopf. */}
          {sperrgrund !== undefined && (
            <Hinweis art="info">{sperrgrund}</Hinweis>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={schliesse}>Abbrechen</Button>
            <Button
              type="button"
              disabled={sperrgrund !== undefined}
              onClick={() => { if (betrag !== undefined) bestaetige(betrag); }}
            >
              Offerte erzeugen
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
