/**
 * Client Supabase — initialisation tolérante.
 *
 * L'application doit fonctionner en mode démonstration (sans projet Supabase
 * configuré) : si les variables d'environnement manquent, on expose un client
 * `null` et les hooks basculent sur les données de démonstration.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const supabaseConfigure = Boolean(supabase);

/** Message d'erreur normalisé pour l'interface. */
export function messageErreur(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return 'Erreur inconnue';
}
