// Getrennt von index.ts: druckeOfferte zieht playwright in den Graphen; ueber den
// Paketindex landete es im Browser-Bundle und der Next-Build scheiterte.
export { druckeOfferte } from './pdf/drucke-offerte.js';
