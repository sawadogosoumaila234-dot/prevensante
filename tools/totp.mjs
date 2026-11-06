// Utilitaires TOTP partages (RFC 6238).
//
// Un code TOTP est un HMAC-SHA1 du temps : il ne depend que du secret et de
// l'heure. Deux precautions s'imposent.
//
// 1. Le temps du serveur fait foi. Un poste dont l'horloge est decalee
//    produit des codes refuses, meme parfaitement calcules : l'ecart est
//    donc mesure sur l'en-tete `Date` du serveur et corrige a la volee.
// 2. Le calcul est auto-controle avant tout usage, contre les vecteurs de
//    test de la RFC 6238 : une erreur de decodage base32 produirait un code
//    faux, de facon parfaitement silencieuse.
import { createHmac } from 'node:crypto';

/** Decodage base32 (RFC 4648, sans remplissage) vers un tampon binaire. */
export function base32Decoder(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const propre = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valeur = 0;
  const sortie = [];
  for (const caractere of propre) {
    const index = alphabet.indexOf(caractere);
    if (index === -1) continue;
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      sortie.push((valeur >>> bits) & 0xff);
      // Sans ce masque, `valeur` continuerait de croitre et le decalage
      // deborderait au bout de quelques caracteres.
      valeur &= (1 << bits) - 1;
    }
  }
  return Buffer.from(sortie);
}

/** Code TOTP (HMAC-SHA1, fenetre de 30 s, 6 chiffres). */
export function codeTotp(secret, instant = Date.now()) {
  const compteur = Math.floor(instant / 1000 / 30);
  const tampon = Buffer.alloc(8);
  tampon.writeBigUInt64BE(BigInt(compteur));
  const hmac = createHmac('sha1', base32Decoder(secret)).update(tampon).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  const binaire =
    ((hmac[decalage] & 0x7f) << 24) |
    (hmac[decalage + 1] << 16) |
    (hmac[decalage + 2] << 8) |
    hmac[decalage + 3];
  return String(binaire % 1000000).padStart(6, '0');
}

/**
 * Auto-controle contre les vecteurs de test de la RFC 6238 (HMAC-SHA1,
 * 6 chiffres) : le secret de reference est la chaine ASCII
 * « 12345678901234567890 », encodee en base32.
 */
export function autoControleTotp() {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const reference = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ];
  for (const [instant, attendu] of reference) {
    const obtenu = codeTotp(secret, instant * 1000);
    if (obtenu !== attendu) {
      throw new Error(`auto-controle TOTP en echec : ${instant} -> ${obtenu} (attendu ${attendu})`);
    }
  }
}

/**
 * Ancre le temps sur celui du serveur.
 *
 * `mesurerEcart` interroge l'instance et rend l'ecart en millisecondes entre
 * son horloge et celle de la machine ; `tempsServeur` ajoute cet ecart a
 * l'heure courante.
 */
export async function mesurerEcart(url, cle) {
  const reponse = await fetch(`${url}/auth/v1/health`, { headers: { apikey: cle } });
  const date = reponse.headers.get('date');
  if (!date) throw new Error("le serveur n'a pas renvoye d'en-tete Date : impossible d'ancrer le temps");
  return new Date(date).getTime() - Date.now();
}

/** Instants candidats : celui du serveur, puis ses deux voisins. */
export function instantsCandidats(instant) {
  return [instant, instant - 30000, instant + 30000];
}
