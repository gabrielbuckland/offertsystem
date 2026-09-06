export interface AbrufReferenzobjekt {
  readonly id: string;
  readonly bewertung?: unknown;
}

// Bei nur einem Referenzobjekt keine "uebrigen" Bewertungen erfinden.
export function abrufWarnungstext(
  fehlgeschlagenerTyp: string | undefined,
  referenzobjekte: readonly AbrufReferenzobjekt[],
): string {
  const basis = `Für den Referenzobjekttyp ${fehlgeschlagenerTyp ?? '—'} liegt keine Bewertung vor.`;
  const uebrige = referenzobjekte.some(
    (r) => r.id !== fehlgeschlagenerTyp && r.bewertung !== undefined,
  );
  return uebrige ? `${basis} Die übrigen Bewertungen wurden übernommen.` : basis;
}
