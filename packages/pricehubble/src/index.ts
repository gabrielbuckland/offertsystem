/**
 * Oeffentlicher Einstiegspunkt des PriceHubble-Adapters.
 * Der Adapter implementiert den vom Kern definierten ValuationProvider-Port
 * (Dependency Inversion, I-23).
 */
export const PAKET_NAME = '@offert/pricehubble';

export { createValuationProvider } from './provider/factory.js';
export { MockValuationProvider } from './provider/mockValuationProvider.js';
export { PriceHubbleAdapter } from './provider/priceHubbleAdapter.js';
export { KonfigurationsFehler } from './config/konfigurationsFehler.js';
export type {
  ApiKonfiguration,
  AdapterUmgebung,
  ProviderSchalter,
} from './config/apiKonfiguration.js';
