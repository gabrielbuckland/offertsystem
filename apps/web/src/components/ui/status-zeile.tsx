// CSS-Spinner statt Bibliothek; role="status" meldet den Zustand dem Screenreader,
// ohne wie ein Fehler zu unterbrechen.
export function StatusZeile({ text }: { readonly text: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
      {text}
    </span>
  );
}
