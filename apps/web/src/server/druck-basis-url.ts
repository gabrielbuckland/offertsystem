export function druckBasisUrl(
  anfrageUrl: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const uebersteuerung = env['APP_BASE_URL'];
  if (uebersteuerung !== undefined && uebersteuerung !== '') return uebersteuerung;
  return new URL(anfrageUrl).origin;
}
