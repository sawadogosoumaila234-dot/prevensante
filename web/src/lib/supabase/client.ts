/**
 * Client Supabase — initialisation tolérante.
 *
 * L'application doit rester utilisable sans projet Supabase configuré :
 * si les variables d'environnement manquent, `supabase` vaut `null` et la
 * couche `lib/api.ts` bascule sur le jeu de données de démonstration.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

/** Vrai lorsque le projet Supabase est configure. */
export const supabaseConfigure = Boolean(supabase);

/** Message d'erreur normalisé pour l'interface (anglais). */
export function messageErreur(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return 'An unexpected error occurred.';
}
