import { useQuery } from '@tanstack/react-query';
import { listNotifications } from '../api';
import type { Notification } from '../../data/types';

/**
 * Notifications de l'utilisateur connecte et nombre de non-lus.
 *
 * La cle de cache est volontairement celle de l'ecran des notifications
 * (`['notifications', userId]`) : la cloche et la liste partagent une seule
 * requete, et le marquage « lu » — qui invalide `['notifications']` — met
 * les deux a jour d'un coup.
 *
 * Le rafraichissement periodique n'est pas un detail : une escalade critique
 * est creee en base par le triage d'un evenement, sur un autre poste. Sans
 * cette interrogation periodique, le compteur resterait a zero jusqu'au
 * rechargement de la page, et l'alerte critique ne serait vue qu'en ouvrant
 * l'ecran des notifications.
 */
export function useUnreadNotifications(userId: string | undefined) {
  const { data } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => listNotifications(userId ?? ''),
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const notifications: Notification[] = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return { notifications, unreadCount };
}

/**
 * Libelle court du compteur : au-dela de 99, on affiche « 99+ » plutot
 * qu'un nombre a trois chiffres qui deforme la pastille.
 */
export function formatUnreadCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}
