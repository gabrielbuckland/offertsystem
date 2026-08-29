import { cn } from '../../lib/utils.js';

export type HinweisArt = 'fehler' | 'warnung' | 'info' | 'erfolg';

/**
 * Einziges Erscheinungsbild fuer Meldungen (Spec §3). Vereinheitlicht nur Rolle, Farbe
 * und Symbol; Texte kommen weiterhin aus der Uebersetzungsschicht, die Verankerung am
 * Feld bleibt Sache des Aufrufers.
 */
const ARTEN: Record<HinweisArt, { rolle: 'alert' | 'status'; klasse: string; symbol: string }> = {
  fehler:  { rolle: 'alert',  klasse: 'border-destructive/40 bg-destructive/5 text-destructive', symbol: '✕' },
  warnung: { rolle: 'status', klasse: 'border-amber-500/40 bg-amber-500/10 text-amber-800', symbol: '!' },
  info:    { rolle: 'status', klasse: 'border-border bg-muted text-foreground', symbol: 'i' },
  erfolg:  { rolle: 'status', klasse: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800', symbol: '✓' },
};

export function Hinweis({ art, children, className, rolle }: {
  readonly art: HinweisArt;
  readonly children: React.ReactNode;
  readonly className?: string;
  /**
   * Ueberschreibt die Standard-Rolle der Art: Ob eine Meldung unterbrechen muss, ist eine
   * Eigenschaft der SITUATION, nicht der Art (z. B. eine blockierende „warnung“, die
   * gestalterisch keine „fehler“-Rotfaerbung braucht).
   */
  readonly rolle?: 'alert' | 'status';
}) {
  const a = ARTEN[art];
  return (
    <div role={rolle ?? a.rolle}
         className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', a.klasse, className)}>
      <span aria-hidden="true" className="mt-0.5 font-semibold">{a.symbol}</span>
      <div>{children}</div>
    </div>
  );
}
