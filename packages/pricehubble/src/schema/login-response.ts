/** Keine Formel. Contract-Schema der Login-Antwort. */
import { z } from 'zod';

/**
 * Nur `access_token` ist belegt (Bruno-Post-Response-Skript). Ein `expires_in`
 * existiert im Beispiel nicht; der Adapter darf sich nicht darauf verlassen.
 */
export const LoginResponseSchema = z.object({ access_token: z.string().min(1) });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
