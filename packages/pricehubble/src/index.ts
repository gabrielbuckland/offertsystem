/**
 * Oeffentlicher Einstiegspunkt des PriceHubble-Adapters.
 * Der Adapter implementiert den vom Kern definierten ValuationProvider-Port
 * (Dependency Inversion, I-23).
 */
export const PAKET_NAME = '@offert/pricehubble';

export { createValuationProvider } from './provider/factory.js';
export { MockValuationProvider } from './provider/mock-valuation-provider.js';
export { PriceHubbleAdapter } from './provider/pricehubble-adapter.js';
export { KonfigurationsFehler } from './config/konfigurations-fehler.js';
export type {
  ApiKonfiguration,
  AdapterUmgebung,
  ProviderSchalter,
} from './config/api-konfiguration.js';
