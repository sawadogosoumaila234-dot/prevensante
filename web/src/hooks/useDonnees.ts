/**
 * Accès aux données.
 *
 * Les hooks interrogent Supabase lorsque le projet est configuré, et se replient
 * sur le jeu de démonstration sinon. La forme des objets returned est identique
 * dans les deux cas, ce qui permet de brancher la production sans toucher aux
 * composants.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ACTIONS, NOTIFICATIONS, SIGNALEMENTS } from '../data/demo';
import type { ActionCorrective, Notification, Signalement } from '../data/types';

interface Etat<T> {
  donnees: T;
  chargement: boolean;
  erreur: string | null;
}

/** Signalements — source : table `app.signalements` (jointure `app.sites`). */
export function useSignalements(): Etat<Signalement[]> & { recharger: () => void } {
  const [etat, setEtat] = useState<Etat<Signalement[]>>({
    donnees: SIGNALEMENTS,
    chargement: false,
    erreur: null,
  });

  const charger = useCallback(async () => {
    if (!supabase) return;
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    const { data, error } = await supabase
      .from('app_signalements')
      .select('*, app_sites(nom)')
      .order('declare_at', { ascending: false })
      .limit(200);
    if (error) {
      setEtat((e) => ({ ...e, chargement: false, erreur: error.message }));
      return;
    }
    const lignes = (data ?? []) as unknown as Signalement[];
    setEtat({ donnees: lignes.length ? lignes : SIGNALEMENTS, chargement: false, erreur: null });
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  return { ...etat, recharger: charger };
}

/** Actions correctives — table `app.actions_correctives`. */
export function useActions(): Etat<ActionCorrective[]> {
  const [etat, setEtat] = useState<Etat<ActionCorrective[]>>({
    donnees: ACTIONS,
    chargement: false,
    erreur: null,
  });

  useEffect(() => {
    if (!supabase) return;
    let annule = false;
    (async () => {
      setEtat((e) => ({ ...e, chargement: true }));
      const { data, error } = await supabase
        .from('app_actions_correctives')
        .select('*, app_sites(nom)')
        .order('echeance_at', { ascending: true })
        .limit(200);
      if (annule) return;
      if (error) {
        setEtat((e) => ({ ...e, chargement: false, erreur: error.message }));
        return;
      }
      const lignes = (data ?? []) as unknown as ActionCorrective[];
      setEtat({ donnees: lignes.length ? lignes : ACTIONS, chargement: false, erreur: null });
    })();
    return () => {
      annule = true;
    };
  }, []);

  return etat;
}

/** Notifications — table `app.notifications`. */
export function useNotifications(): Etat<Notification[]> {
  const [etat, setEtat] = useState<Etat<Notification[]>>({
    donnees: NOTIFICATIONS,
    chargement: false,
    erreur: null,
  });

  useEffect(() => {
    if (!supabase) return;
    let annule = false;
    (async () => {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (annule) return;
      if (error) {
        setEtat((e) => ({ ...e, erreur: error.message }));
        return;
      }
      const lignes = (data ?? []) as unknown as Notification[];
      setEtat({ donnees: lignes.length ? lignes : NOTIFICATIONS, chargement: false, erreur: null });
    })();
    return () => {
      annule = true;
    };
  }, []);

  return etat;
}

/** Filtre les signalements selon un ensemble de critères de vue. */
export function useFiltreSignalements(
  signalements: Signalement[],
  critere: 'all' | 'danger' | 'incident' | 'accident' | 'prio' | 'open' | 'closed',
): Signalement[] {
  return useMemo(() => {
    switch (critere) {
      case 'danger':
        return signalements.filter((s) => s.type_evenement === 'danger');
      case 'incident':
        return signalements.filter((s) => s.type_evenement === 'incident');
      case 'accident':
        return signalements.filter((s) => s.type_evenement === 'accident');
      case 'prio':
        return signalements.filter((s) => s.priorite === 'critique' || s.priorite === 'elevee');
      case 'open':
        return signalements.filter((s) => s.statut !== 'clos' && s.statut !== 'rejete');
      case 'closed':
        return signalements.filter((s) => s.statut === 'clos');
      default:
        return signalements;
    }
  }, [signalements, critere]);
}

/** Filtre les actions selon un ensemble de critères de vue. */
export function useFiltreActions(
  actions: ActionCorrective[],
  critere: 'all' | 'a_faire' | 'en_cours' | 'a_verifier' | 'cloturee' | 'late',
): ActionCorrective[] {
  return useMemo(() => {
    switch (critere) {
      case 'a_faire':
        return actions.filter((a) => a.statut === 'a_faire');
      case 'en_cours':
        return actions.filter((a) => a.statut === 'en_cours');
      case 'a_verifier':
        return actions.filter((a) => a.statut === 'a_verifier');
      case 'cloturee':
        return actions.filter((a) => a.statut === 'cloturee');
      case 'late':
        return actions.filter((a) => a.en_retard);
      default:
        return actions;
    }
  }, [actions, critere]);
}
