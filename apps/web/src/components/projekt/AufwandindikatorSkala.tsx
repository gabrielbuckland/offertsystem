// I-15/I-16: monotone Zuordnung 0 (gering) bis 1 (hoch). E-04: D kann ausserhalb [0,1]
// liegen — nur der Fuellstand wird fuers Zeichnen begrenzt, nicht der Zahlwert.
export function AufwandindikatorSkala({ wert }: { readonly wert: number }) {
  const anteil = Math.min(1, Math.max(0, wert));
  return (
    <div className="mt-1 w-full max-w-56">
      <div className="h-1 rounded-full bg-primary/15">
        <div
          className="h-1 rounded-full bg-primary"
          style={{ width: `${String(Math.round(anteil * 100))}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] leading-3 text-muted-foreground">
        <span>gering</span>
        <span>hoch</span>
      </div>
    </div>
  );
}
