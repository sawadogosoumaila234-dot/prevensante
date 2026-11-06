// Enregistre le crochet de resolution TypeScript pour toute la session Node.
//
// Invoque via `node --import ./test/register-ts.mjs --test` (voir le script
// « test » du package racine).
import { register } from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
