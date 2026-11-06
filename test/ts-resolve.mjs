// Resolution des imports sans extension, pour les modules TypeScript du front.
//
// Vite les resout ; Node, pour un test de comportement, a besoin d'une aide.
// Ce crochet ne s'applique qu'aux specifiers relatifs : les paquets npm
// (`react`, `@supabase/supabase-js`) restent resolus normalement.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.jsx'];

/** Fichier existe-t-il derriere cette URL ? */
function existe(url) {
  try {
    return existsSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  const relatif = specifier.startsWith('./') || specifier.startsWith('../');
  const sansExtension = !/\.[cm]?[jt]sx?$/.test(specifier);

  if (relatif && sansExtension && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    for (const extension of EXTENSIONS) {
      const candidat = new URL(base.href + extension);
      if (existe(candidat)) return nextResolve(candidat.href, context);
    }
    for (const extension of EXTENSIONS) {
      const candidat = new URL(`${base.href}/index${extension}`);
      if (existe(candidat)) return nextResolve(candidat.href, context);
    }
  }

  return nextResolve(specifier, context);
}
