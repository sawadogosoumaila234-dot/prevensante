// Test fonctionnel du schéma PrevEnSanté dans PGlite (PostgreSQL en WASM).
//
// C'est le pendant SQL de la suite E2E navigateur (`web/e2e`) : les deux
// vérifient la même règle d'accès aux données, l'un côté base, l'un côté IHM.
//
//   1. application des migrations versionnées (`supabase/migrations`) ;
//   2. attribution des droits « Supabase-like » aux rôles anon / authenticated ;
//   3. exécution de `supabase/tests/rls.sql` — RLS par rôle, déclencheurs de
//      garde-fou, isolement strict du schéma medical ;
//   4. contrôles complémentaires exigés par le PV de recette mais absents de
//      `rls.sql` : format de la référence, refus serveur d'une description
//      vide (23514), passage obligatoire par « to_verify », interdiction de
//      vérifier sa propre action, périmètre du tableau de bord, escalade et
//      notification d'un danger critique classé au triage.
//
// Aucun conteneur, aucune instance Supabase : tout tourne en local.
//
// Sortie : 0 si l'ensemble des contrôles passe, 1 sinon.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  demarrerPGlite,
  appliquerMigrations,
  accorderDroits,
  decouper,
  DOSSIER_TESTS,
} from './pglite-prelude.mjs';

// ── Identifiants du jeu de démonstration (supabase/migrations/0016_seed.sql) ──
const HSE = 'a0000000-0000-4000-8000-000000000001';
const ADMIN = 'a0000000-0000-4000-8000-000000000003';
const SALARIE_A = 'a0000000-0000-4000-8000-000000000004';
const ENCADREMENT = 'a0000000-0000-4000-8000-000000000006';
const SITE_A = '22222222-2222-4222-8222-222222222222';
const ZONE_A = '33333333-3333-4333-8333-333333333331';
const ACTION_ENCOURS = 'bbbbbbbb-0000-4000-8000-000000000001';
const ACTION_A_VERIFIER = 'bbbbbbbb-0000-4000-8000-000000000003';

const db = await demarrerPGlite({ pgtap: false });

// ── 1. Migrations ─────────────────────────────────────────────────────────────
console.log('=== 1. Application des migrations ===');
const migrations = await appliquerMigrations(db, {
  onInstruction: ({ type, fichier, n }) => {
    if (type === 'ignore') {
      console.log(`  [ignore] ${fichier} #${n} — extension absente de PGlite`);
    }
  },
});
console.log(
  `  ${migrations.ok} instruction(s) appliquee(s), ${migrations.echecs.length} echec(s), ` +
    `${migrations.ignorees.length} extension(s) ignoree(s)`,
);
if (migrations.echecs.length > 0) {
  for (const e of migrations.echecs) {
    console.error(`  [ECHEC] ${e.fichier} #${e.n} : ${e.msg}`);
  }
  process.exit(1);
}

// ── 2. Droits « Supabase-like » ───────────────────────────────────────────────
console.log('\n=== 2. Droits des roles ===');
await accorderDroits(db);
console.log('  anon / authenticated / service_role : droits accordes sur public.');

// ── 3. Suite RLS de reference ─────────────────────────────────────────────────
console.log('\n=== 3. supabase/tests/rls.sql ===');
const fichierRls = join(DOSSIER_TESTS, 'rls.sql');
const instructions = decouper(readFileSync(fichierRls, 'utf8'));
console.log(`  ${instructions.length} instruction(s) a executer`);

let erreurFatale = null;
for (const [i, instr] of instructions.entries()) {
  try {
    // db.exec() decoupe sur « ; » et ne respecte pas les corps $...$ :
    // les blocs DO passent par db.query() (une seule instruction).
    if (/^\s*do\b/i.test(instr)) await db.query(instr);
    else await db.exec(instr);
  } catch (e) {
    // Le dernier bloc de rls.sql est un bilan : il leve une exception
    // volontaire quand un test a echoue. On la rattrape, on revert la
    // transaction et on lit les resultats, qui sont deja ecrits.
    if (i === instructions.length - 1) {
      console.log(`  bilan : ${String(e.message).split('\n')[0]}`);
      try {
        await db.exec('rollback');
      } catch {
        /* session deja propre */
      }
      break;
    }
    erreurFatale = { n: i + 1, message: String(e.message).split('\n')[0] };
    break;
  }
}
if (erreurFatale) {
  console.error(`  [ECHEC EXECUTION] instruction #${erreurFatale.n} : ${erreurFatale.message}`);
  process.exit(1);
}

// ── 4. Controles complementaires ──────────────────────────────────────────────
// Ces controles sont exiges par le PV de recette (CR02, CR04) mais ne sont
// pas couverts par rls.sql : ils sont verifies ici, dans la meme session.

/** Execute une instruction comme un utilisateur authentifie et capture l'erreur. */
async function executerComme(sub, sql) {
  await db.exec('begin');
  try {
    await db.exec('set local role authenticated');
    await db.exec(`set local request.jwt.claims = '{"sub":"${sub}"}'`);
    const resultat = await db.query(sql);
    await db.exec('reset role');
    await db.exec('commit');
    return { ok: true, lignes: resultat.rows };
  } catch (e) {
    try {
      await db.exec('rollback');
    } catch {
      /* session deja propre */
    }
    return { ok: false, code: codeSqlstate(e), message: String(e.message).split('\n')[0] };
  }
}

/** SQLSTATE d'une erreur PGlite (23514 pour une violation de contrainte). */
function codeSqlstate(e) {
  if (!e) return null;
  if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
  if (typeof e.sqlstate === 'string' && /^[0-9A-Z]{5}$/.test(e.sqlstate)) return e.sqlstate;
  const message = String(e.message || '');
  const trouve = message.match(/(?:code|SQLSTATE)\s*[:=]\s*([0-9A-Z]{5})/i);
  return trouve ? trouve[1] : null;
}

const controles = [];

async function enregistrer(nom, ok, detail = '') {
  controles.push({ nom, ok: !!ok, detail });
  console.log(`  [${ok ? 'OK' : 'KO'}] ${nom}${detail ? ' — ' + detail : ''}`);
  await db.query('insert into pg_temp.rls_results (test_name, ok, detail) values ($1, $2, $3)', [
    nom,
    !!ok,
    detail || null,
  ]);
}

console.log('\n=== 4. Controles complementaires (PV de recette) ===');

// C01 — la reference est generee automatiquement au format PES-AAAA-NNNNN
const rapporter = `(public.submit_safety_event(
     'danger'::public.event_kind, '${SITE_A}'::uuid, '${ZONE_A}'::uuid, null, now(),
     'Sack fell from the pallet and blocked the marked pedestrian aisle.',
     'Manual handling of sacks on the production line',
     'Isolated the aisle and placed a warning sign.'))`;
const premiere = await executerComme(SALARIE_A, `select ${rapporter}->>'reference' as reference`);
const seconde = await executerComme(SALARIE_A, `select ${rapporter}->>'reference' as reference`);
const ref1 = premiere.ok ? premiere.lignes[0]?.reference : null;
const ref2 = seconde.ok ? seconde.lignes[0]?.reference : null;
await enregistrer(
  'C01 reference generee automatiquement au format PES-AAAA-NNNNN',
  premiere.ok &&
    seconde.ok &&
    /^PES-\d{4}-\d{5}$/.test(ref1 || '') &&
    /^PES-\d{4}-\d{5}$/.test(ref2 || '') &&
    ref1 !== ref2,
  premiere.ok ? `${ref1} puis ${ref2}` : premiere.message,
);

// C02 — une description vide est refusee par la base (23514)
const vide = await executerComme(
  SALARIE_A,
  `select ${rapporter.replace(
    'Sack fell from the pallet and blocked the marked pedestrian aisle.',
    '   ',
  )}->>'reference' as reference`,
);
await enregistrer(
  'C02 description vide refusee par la base (SQLSTATE 23514)',
  !vide.ok && vide.code === '23514' && /description/i.test(vide.message || ''),
  vide.ok ? 'aucune exception levee' : `${vide.code} ${vide.message}`,
);

// C03 — une action ne peut pas etre close sans passer par « to_verify »
const clotureDirecte = await executerComme(
  HSE,
  `update public.corrective_actions
      set status = 'closed',
          closed_at = now(),
          closed_by = '${HSE}'::uuid,
          closure_evidence_path = 'action-evidence/${ACTION_ENCOURS}/v1/preuve.pdf',
          closure_note = 'Capteur remplace',
          verified_by = '${HSE}'::uuid,
          verified_at = now()
    where id = '${ACTION_ENCOURS}'::uuid`,
);
await enregistrer(
  'C03 cloture directe refusee sans le statut « to_verify » (SQLSTATE 23514)',
  !clotureDirecte.ok &&
    clotureDirecte.code === '23514' &&
    /to_verify/i.test(clotureDirecte.message || ''),
  clotureDirecte.ok ? 'aucune exception levee' : `${clotureDirecte.code} ${clotureDirecte.message}`,
);

// C04 — l'actionnaire ne peut pas verifier sa propre action
const autoVerification = await executerComme(
  HSE,
  `update public.corrective_actions
      set status = 'closed',
          closed_at = now(),
          closed_by = '${HSE}'::uuid,
          closure_evidence_path = 'action-evidence/${ACTION_A_VERIFIER}/v1/preuve.pdf',
          closure_note = 'Aspiration installee',
          verified_by = '${ENCADREMENT}'::uuid,
          verified_at = now()
    where id = '${ACTION_A_VERIFIER}'::uuid`,
);
await enregistrer(
  'C04 auto-verification refusee (SQLSTATE 23514)',
  !autoVerification.ok &&
    autoVerification.code === '23514' &&
    /own owner/i.test(autoVerification.message || ''),
  autoVerification.ok ? 'aucune exception levee' : `${autoVerification.code} ${autoVerification.message}`,
);

// C05 — les compteurs du tableau de bord respectent le perimetre RLS
// (`v_dashboard_kpi` est `security_invoker` : c'est la politique RLS de
// `safety_events` qui filtre les lignes, pas la vue).
const kpi = await executerComme(
  SALARIE_A,
  `select count(*)::int as total,
          count(*) filter (where site_id <> '${SITE_A}'::uuid)::int as hors_perimetre
     from public.v_dashboard_kpi`,
);
await enregistrer(
  'C05 v_dashboard_kpi limite au perimetre de l utilisateur',
  kpi.ok && kpi.lignes[0]?.total > 0 && kpi.lignes[0]?.hors_perimetre === 0,
  kpi.ok
    ? `${kpi.lignes[0].total} ligne(s), ${kpi.lignes[0].hors_perimetre} hors perimetre`
    : kpi.message,
);

// C06 — un danger classe « critical » au triage escalade ET notifie le HSE
//
// C'est le chemin de production : la severite n'est pas connue a la
// declaration (elle vaut 'medium' par defaut), elle est posee au triage par
// le HSE. L'escalade doit donc partir du triage, et non seulement d'une
// insertion directe en 'critical' — sans quoi aucun danger grave n'escalade
// jamais dans le flux reel.
const CATEGORIE_CRITIQUE = '55555555-5555-4555-8555-555555555552';

const declaration = await executerComme(
  SALARIE_A,
  `select (public.submit_safety_event(
       'danger'::public.event_kind, '${SITE_A}'::uuid, '${ZONE_A}'::uuid, null, now(),
       'Drilling machine guard removed during the maintenance of the gallery conveyor.',
       'Maintenance of the gallery conveyor CV-12',
       'Machine stopped and tagged out.'))->>'id' as id`,
);

let c06Ok = false;
let c06Detail = declaration.ok ? '' : declaration.message;
let evenementId = null;

if (declaration.ok) {
  evenementId = declaration.lignes[0].id;

  // Tant que l'evenement n'est pas classe, aucune escalade ne doit exister.
  const avantTriage = await executerComme(
    HSE,
    `select count(*)::int as total
       from public.escalations
      where event_id = '${evenementId}'::uuid`,
  );

  // Le triage est l'instant ou la severite devient 'critical'.
  const triage = await executerComme(
    HSE,
    `select public.triage_safety_event(
        '${evenementId}'::uuid,
        '${CATEGORIE_CRITIQUE}'::uuid,
        'critical'::public.severity_level,
        'Danger critique confirme : carter de protection absent.')`,
  );

  const apres = await executerComme(
    HSE,
    `select
       (select count(*)::int from public.escalations
         where event_id = '${evenementId}'::uuid
           and notified_user_id = '${HSE}'::uuid) as escalades,
       (select count(*)::int from public.notifications
         where event_id = '${evenementId}'::uuid
           and user_id = '${HSE}'::uuid
           and kind = 'critical_escalation'
           and read_at is null) as notifications,
       (select status from public.safety_events
         where id = '${evenementId}'::uuid) as statut`,
  );

  if (!triage.ok) {
    c06Detail = triage.message;
  } else if (!apres.ok) {
    c06Detail = apres.message;
  } else {
    const a = apres.lignes[0];
    c06Ok =
      avantTriage.ok &&
      avantTriage.lignes[0].total === 0 &&
      a.escalades === 1 &&
      a.notifications === 1 &&
      a.statut === 'escalated';
    c06Detail = `${a.statut}, ${a.escalades} escalade(s), ${a.notifications} notification(s) non lue(s)`;
  }
}
await enregistrer(
  'C06 un danger classe critique au triage escalade et notifie le HSE',
  c06Ok,
  c06Detail,
);

// C07 — un re-triage ne duplique ni l'escalade, ni la notification, ni les
// messages en file d'attente
// L'e-mail est emis par destinataire (HSE, direction de site, administrateur)
// : ce qui doit etre invariant, c'est le nombre de lignes avant et apres le
// re-triage, pas un total absolu.
const avantReTriage = await executerComme(
  HSE,
  `select
     (select count(*)::int from public.escalations
       where event_id = '${evenementId}'::uuid) as escalades,
     (select count(*)::int from public.notifications
       where event_id = '${evenementId}'::uuid
         and kind = 'critical_escalation') as notifications,
     (select status from public.safety_events
       where id = '${evenementId}'::uuid) as statut`,
);
const emailsAvantReTriage = await executerComme(
  ADMIN,
  `select count(*)::int as total
     from public.email_outbox
    where template = 'critical_event_hse'
      and payload->>'event_id' = '${evenementId}'::text`,
);

const reTriage = await executerComme(
  HSE,
  `select public.triage_safety_event(
      '${evenementId}'::uuid,
      '${CATEGORIE_CRITIQUE}'::uuid,
      'critical'::public.severity_level,
      'Re-classification : la criticite est confirmee.')`,
);

const apresReTriage = await executerComme(
  HSE,
  `select
     (select count(*)::int from public.escalations
       where event_id = '${evenementId}'::uuid) as escalades,
     (select count(*)::int from public.notifications
       where event_id = '${evenementId}'::uuid
         and kind = 'critical_escalation') as notifications,
     (select status from public.safety_events
       where id = '${evenementId}'::uuid) as statut`,
);
// Les files d'attente ne sont lisibles que par un administrateur.
const emailsApresReTriage = await executerComme(
  ADMIN,
  `select count(*)::int as total
     from public.email_outbox
    where template = 'critical_event_hse'
      and payload->>'event_id' = '${evenementId}'::text`,
);

const avant = avantReTriage.ok ? avantReTriage.lignes[0] : null;
const apres = apresReTriage.ok ? apresReTriage.lignes[0] : null;
const emailsAvant = emailsAvantReTriage.ok ? emailsAvantReTriage.lignes[0].total : null;
const emailsApres = emailsApresReTriage.ok ? emailsApresReTriage.lignes[0].total : null;

await enregistrer(
  'C07 un re-triage ne duplique ni escalade ni notification ni envoi',
  reTriage.ok &&
    avant !== null &&
    apres !== null &&
    emailsAvant !== null &&
    emailsApres !== null &&
    avant.escalades === 1 &&
    apres.escalades === avant.escalades &&
    avant.notifications === 1 &&
    apres.notifications === avant.notifications &&
    emailsApres === emailsAvant &&
    apres.statut === 'escalated',
  !reTriage.ok
    ? reTriage.message
    : !apresReTriage.ok
      ? apresReTriage.message
      : !emailsApresReTriage.ok
        ? emailsApresReTriage.message
        : `escalade(s) ${avant.escalades} -> ${apres.escalades}, notification(s) ${avant.notifications} -> ${apres.notifications}, e-mail(s) ${emailsAvant} -> ${emailsApres}, statut ${apres.statut}`,
);

// ── 5. Bilan ──────────────────────────────────────────────────────────────────
const bilan = await db.query(
  'select count(*)::int as total, count(*) filter (where ok)::int as reussis from pg_temp.rls_results',
);
const { total, reussis } = bilan.rows[0];
const echecs = await db.query(
  'select test_name, detail from pg_temp.rls_results where not ok order by id',
);

console.log('\n=== Bilan ===');
console.log(`  ${total} controle(s) execute(s) — ${reussis} reussi(s), ${total - reussis} echec(s)`);
for (const e of echecs.rows) {
  console.error(`  [ECHEC] ${e.test_name}${e.detail ? ' — ' + e.detail : ''}`);
}

if (total - reussis > 0) {
  console.error('\nTest fonctionnel : ECHEC');
  process.exit(1);
}
console.log('\nTest fonctionnel : OK');
process.exit(0);
