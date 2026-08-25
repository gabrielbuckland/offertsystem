/** Leerzustand mit Handlungsaufforderung (Spec §3) statt einzeiliger Feststellung. */
export function LeererZustand({ titel, beschreibung, aktion }: {
  readonly titel: string;
  readonly beschreibung: string;
  readonly aktion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{titel}</p>
      <p className="text-sm text-muted-foreground">{beschreibung}</p>
      {aktion !== undefined && <div className="mt-2">{aktion}</div>}
    </div>
  );
}
