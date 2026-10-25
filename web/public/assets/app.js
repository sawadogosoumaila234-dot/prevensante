/* PrevEnSanté — couche de données et rendu partagée entre les pages */

const REPORTS = [
  { id: 'SIG-2026-048', type: 'danger', title: 'Sol huileux près du concasseur', cat: 'Environnement', site: 'Mine de Poura', zone: 'Concasseur primaire', date: '25 oct. 10:12', status: 'progress', stext: 'En cours', late: false, prio: true,
    desc: "Fuite d'huile du circuit de lubrification sur la passerelle est du concasseur primaire. Sol glissant sur environ 3 m, balisage provisoire en place.",
    actions: 2, photos: 1 },
  { id: 'SIG-2026-047', type: 'incident', title: 'Presque chute d\'un bloc depuis le front', cat: 'Chute d\'objet', site: 'Mine de Poura', zone: 'Front de taille — galerie 3', date: '24 oct. 15:40', status: 'todo', stext: 'À faire', late: false, prio: true,
    desc: "Bloc détaché en bord de front de taille, approximately 15 kg, détecté par le chef d'équipe avant passage de la chargeuse. Zone Restricted immédiatement.",
    actions: 1, photos: 2 },
  { id: 'SIG-2026-045', type: 'accident', title: 'Main pincée lors de la maintenance', cat: 'Mécanique', site: 'Cimenterie de Kossodo', zone: 'Atelier maintenance', date: '22 oct. 08:30', status: 'verify', stext: 'À vérifier', late: false, prio: false,
    desc: "Main coincée dans le réducteur du convoyeur n°2 lors du remplacement de la garniture. Consignation non appliquée avant intervention. Arrêt de travail de 6 jours.",
    actions: 3, photos: 3 },
  { id: 'SIG-2026-041', type: 'danger', title: 'Câble électrique dénudé sur convoyeur', cat: 'Électrique', site: 'Usine agro', zone: 'Ligne de production 2', date: '18 oct. 11:05', status: 'closed', stext: 'Clôturé', late: false, prio: false,
    desc: 'Gaineuscée sur une section de 40 cm. Consignation immédiate et remplacement du câble par l\'équipe électrique.',
    actions: 1, photos: 1 },
  { id: 'SIG-2026-039', type: 'incident', title: 'Fuite de produit chimique — bidon 200 L', cat: 'Chimique', site: 'Carrière de Bobo', zone: 'Zone de stockage', date: '15 oct. 14:20', status: 'progress', stext: 'En cours', late: true, prio: false,
    desc: 'Fuite au niveau du bouchon d\'un bidon d\'acide dilué. Solution de neutralisation appliquée, quantification des pertes en cours.',
    actions: 2, photos: 1 },
  { id: 'SIG-2026-036', type: 'danger', title: 'Engin de levage sans contrôle périodique', cat: 'Mécanique', site: 'Entrepôt logistique', zone: 'Quai de chargement', date: '10 oct. 09:00', status: 'todo', stext: 'À faire', late: true, prio: false,
    desc: 'Le certificat de contrôle périodique du chariot élévateur n°4 a expiré le 30 septembre. Chargeur immobilisé dans l\'intervalle.',
    actions: 1, photos: 0 },
  { id: 'SIG-2026-030', type: 'accident', title: 'Chute depuis un échafaudage (2 m)', cat: 'Chute de hauteur', site: 'BTP — Ouaga', zone: 'Chantier A', date: '03 oct. 16:10', status: 'closed', stext: 'Clôturé', late: false, prio: false,
    desc: 'Chute de 2 m depuis un plancher d\'échafaudage non sécurisé. Absence de garde-corps sur un tronçon de 4 m. Arrêt de travail de 12 jours.',
    actions: 4, photos: 3 },
  { id: 'SIG-2026-028', type: 'danger', title: 'Éclairage défaillant en galerie 4', cat: 'Environnement', site: 'Mine de Poura', zone: 'Galerie 4 — niveau -120', date: '28 sept. 22:05', status: 'closed', stext: 'Clôturé', late: false, prio: false,
    desc: 'Six luminaires hors service sur la section de circulation principale. Éclairage de secours fonctionnel.',
    actions: 1, photos: 1 },
];

const ACTIONS = [
  { t: 'Installer un bac de rétention sous le bidon 200 L', st: 'progress', stext: 'En cours', resp: 'M. Kaboré', due: '28 oct.', late: false, pct: 60, ref: 'SIG-2026-039', site: 'Carrière de Bobo' },
  { t: 'Contrôle périodique de l\'engin de levage n°4', st: 'todo', stext: 'À faire', resp: 'Service maintenance', due: '20 oct.', late: true, pct: 0, ref: 'SIG-2026-036', site: 'Entrepôt logistique' },
  { t: 'Remplacer le câble dénudé du convoyeur 2', st: 'closed', stext: 'Clôturée', resp: 'Équipe élec.', due: '19 oct.', late: false, pct: 100, ref: 'SIG-2026-041', site: 'Usine agro' },
  { t: 'Formation EPI antidérapant — équipe B', st: 'verify', stext: 'À vérifier', resp: 'Resp. HSE', due: '30 oct.', late: false, pct: 90, ref: 'SIG-2026-048', site: 'Mine de Poura' },
  { t: 'Audit garde-corps chantier A', st: 'todo', stext: 'À faire', resp: 'Resp. HSE', due: '12 oct.', late: true, pct: 0, ref: 'SIG-2026-030', site: 'BTP — Ouaga' },
  { t: 'Mise à jour du plan de consignation concasseur', st: 'progress', stext: 'En cours', resp: 'M. Traoré', due: '02 nov.', late: false, pct: 35, ref: 'SIG-2026-048', site: 'Mine de Poura' },
  { t: 'Revue du plan de déblaiement — front de taille', st: 'todo', stext: 'À faire', resp: 'Resp. HSE', due: '31 oct.', late: false, pct: 0, ref: 'SIG-2026-047', site: 'Mine de Poura' },
  { t: 'Consignation LOTO — procedure convoyeur 2', st: 'verify', stext: 'À vérifier', resp: 'Resp. maintenance', due: '29 oct.', late: false, pct: 85, ref: 'SIG-2026-045', site: 'Cimenterie de Kossodo' },
];

const NOTIFS = [
  { em: '⚠️', t: 'Nouveau signalement SIG-2026-048', d: 'Sol huileux — Mine de Poura', time: 'il y a 12 min', unread: true },
  { em: '🔴', t: 'Action en retard', d: 'Contrôle engin de levage n°4 — échéance 20 oct.', time: 'il y a 2 h', unread: true },
  { em: '🚑', t: 'Accident à qualifier', d: 'Main pincée — Cimenterie de Kossodo', time: 'il y a 5 h', unread: true },
  { em: '✅', t: 'Action clôturée', d: 'Câble convoyeur 2 remplacé', time: 'hier', unread: false },
  { em: '🤖', t: 'Assistant IA', d: '3 nouvelles consignes ajoutées au corpus', time: 'hier', unread: false },
  { em: '📅', t: 'Échéance proche', d: 'Formation EPI antidérapant — 30 oct.', time: 'il y a 2 j', unread: false },
];

const CATS = [
  { label: 'Mécanique', val: 14, color: '#3f51b5' },
  { label: 'Chute', val: 11, color: '#fbc02d' },
  { label: 'Électrique', val: 8, color: '#2563eb' },
  { label: 'Chimique', val: 6, color: '#7c3aed' },
  { label: 'Environnement', val: 5, color: '#d97706' },
  { label: 'Incendie', val: 4, color: '#dc2626' },
];

const MONTHS = [
  { m: 'Jan', v: 34 }, { m: 'Fév', v: 47 }, { m: 'Mar', v: 26 }, { m: 'Avr', v: 61 },
  { m: 'Mai', v: 42 }, { m: 'Juin', v: 54 }, { m: 'Juil', v: 73 }, { m: 'Aoû', v: 49 },
  { m: 'Sep', v: 63 }, { m: 'Oct', v: 82 },
];

const SITES = [
  { name: 'Mine de Poura — Zone Nord', sector: 'Mines et carrières', open: 11, late: 1, users: 42, zones: 7 },
  { name: 'Cimenterie de Kossodo', sector: 'Cimenteries', open: 7, late: 0, users: 31, zones: 6 },
  { name: 'Carrière de Bobo', sector: 'Mines et carrières', open: 5, late: 1, users: 24, zones: 4 },
  { name: 'Usine agro — Bobo-Dioulasso', sector: 'Usines de production', open: 9, late: 0, users: 38, zones: 5 },
  { name: 'Entrepôt logistique — Ouaga', sector: 'Logistique', open: 6, late: 2, users: 19, zones: 3 },
  { name: 'Chantier BTP — Ouaga', sector: 'Bâtiment', open: 4, late: 1, users: 22, zones: 4 },
];

const AI_REPLIES = [
  { cat: 'Chute de hauteur', txt: 'Risque identifié : chute depuis une hauteur non protégée.<br><br><b>Conseils immédiats :</b><br>1. Vérifier la présence et l\'état des garde-corps.<br>2. Contrôler les EPI antichute (harnais, ligne de vie).<br>3. Baliser la zone et interdire l\'accès non sécurisé.' },
  { cat: 'Électrique', txt: 'Risque identifié : contact ou arc électrique.<br><br><b>Conseils immédiats :</b><br>1. Consigner l\'équipement avant intervention.<br>2. Vérifier l\'absence de tension (VAT).<br>3. Utiliser les EPI isolants adaptés.' },
  { cat: 'Mécanique', txt: 'Risque identifié : écrasement ou happement par un organe en mouvement.<br><br><b>Conseils immédiats :</b><br>1. Consigner et cadenasser la machine.<br>2. Vérifier protecteurs et carters.<br>3. Respecter la procédure de consignation LOTO.' },
  { cat: 'Chimique', txt: 'Risque identifié : contact ou inhalation de produit chimique.<br><br><b>Conseils immédiats :</b><br>1. Porter masque et gants de protection adaptés.<br>2. Évacuer et aérer la zone.<br>3. Vérifier la présence d\'un bac de rétention.' },
];

/* ── Rendu ─────────────────────────────────────────────── */
function reportHTML(r) {
  const ic = { danger: '⚠️', incident: '⚡', accident: '🚑' }[r.type] || '⚠️';
  return `<div class="item">
    <div class="ic ${r.type}">${ic}</div>
    <div class="body">
      <div class="row1"><span class="title">${r.title}</span><span class="id">${r.id}</span></div>
      <div class="meta">${r.site} · ${r.zone} · ${r.date}</div>
      ${r.desc ? `<div class="desc">${r.desc}</div>` : ''}
      <div class="tags">
        <span class="chip cat">${r.cat}</span>
        <span class="chip ${r.status}">${r.stext}</span>
        ${r.late ? '<span class="chip late">En retard</span>' : ''}
        ${r.prio ? '<span class="chip prio">Prioritaire</span>' : ''}
      </div>
    </div>
  </div>`;
}

function actionHTML(a) {
  const tags = `<span class="chip ${a.st}">${a.stext}</span>` + (a.late ? '<span class="chip late">En retard</span>' : '');
  return `<div class="action-card${a.late ? ' late' : ''}">
    <div class="top"><span class="t">${a.t}</span>${tags}</div>
    <div class="who">
      <span>👤 ${a.resp}</span>
      <span>📅 ${a.due}</span>
      <span>🏢 ${a.site}</span>
      <span>🔗 ${a.ref}</span>
    </div>
    <div class="progress"><div class="fill" style="width:${a.pct}%"></div></div>
  </div>`;
}

function notifHTML(n) {
  return `<div class="item">
    <div class="ic ${n.unread ? 'incident' : 'neutral'}">${n.em}</div>
    <div class="body">
      <div class="row1"><span class="title">${n.t}</span></div>
      <div class="desc">${n.d}</div>
      <div class="meta">${n.time}${n.unread ? ' · <b style="color:var(--danger)">non lue</b>' : ''}</div>
    </div>
  </div>`;
}

function barsHTML(list, max) {
  const m = max || Math.max(...list.map(c => c.val));
  return list.map(c => `
    <div class="bar-row">
      <span class="lb">${c.label}</span>
      <span class="track"><i style="width:${(c.val / m * 100).toFixed(1)}%;background:${c.color}"></i></span>
      <span class="vv">${c.val}</span>
    </div>`).join('');
}

function chartHTML(list) {
  const m = Math.max(...list.map(d => d.v));
  return list.map(d => `
    <div class="col">
      <div class="b" style="height:${(d.v / m * 100).toFixed(1)}%"></div>
      <div class="x">${d.m}</div>
    </div>`).join('');
}

/* ── Interactions ──────────────────────────────────────── */
function bindFilters(id, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => {
    const f = e.target.closest('.filter');
    if (!f) return;
    el.querySelectorAll('.filter').forEach(x => x.classList.remove('active'));
    f.classList.add('active');
    const key = f.dataset.f;
    if (kind === 'reports') {
      const list = key === 'all' ? REPORTS
        : key === 'open' ? REPORTS.filter(r => r.status !== 'closed')
        : key === 'closed' ? REPORTS.filter(r => r.status === 'closed')
        : key === 'prio' ? REPORTS.filter(r => r.prio)
        : REPORTS.filter(r => r.type === key);
      const target = document.getElementById('all-reports');
      if (target) target.innerHTML = list.length ? list.map(reportHTML).join('') : '<div class="empty"><span class="em">📭</span>Aucun signalement pour ce filtre.</div>';
    } else {
      const list = key === 'all' ? ACTIONS
        : key === 'late' ? ACTIONS.filter(a => a.late)
        : ACTIONS.filter(a => a.st === key);
      const target = document.getElementById('all-actions');
      if (target) target.innerHTML = list.length ? list.map(actionHTML).join('') : '<div class="empty"><span class="em">✅</span>Aucune action pour ce filtre.</div>';
    }
  });
}

function bindSegment(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });
}

function bindTypePicker(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => {
    const c = e.target.closest('.type-card');
    if (!c) return;
    el.querySelectorAll('.type-card').forEach(x => x.classList.remove('sel'));
    c.classList.add('sel');
  });
}

function fakeSubmit(btnId, target) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  setTimeout(() => {
    btn.textContent = '✅ Signalement créé — SIG-2026-049';
    btn.style.background = 'var(--ok)';
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
      btn.style.background = '';
      if (target) location.href = target;
    }, 1500);
  }, 800);
}

function aiSend() {
  const input = document.getElementById('aiText');
  const chat = document.getElementById('chat');
  if (!input || !chat) return;
  const v = input.value.trim();
  if (!v) return;
  chat.insertAdjacentHTML('beforeend', `<div class="msg user">${v.replace(/</g, '&lt;')}</div>`);
  input.value = '';
  chat.insertAdjacentHTML('beforeend', '<div class="msg ai"><div class="role">🤖 Analyse en cours…</div></div>');
  chat.scrollTop = chat.scrollHeight;
  setTimeout(() => {
    const last = chat.querySelector('.msg.ai:last-child');
    const r = AI_REPLIES[Math.floor(Math.random() * AI_REPLIES.length)];
    const ref = 'C-' + String(Math.floor(Math.random() * 200) + 10).padStart(3, '0');
    last.outerHTML = `<div class="msg ai">
      <div class="role">🤖 Proposition de catégorie</div>
      <b>${r.cat}</b>
      <div style="margin-top:8px">${r.txt}</div>
      <div class="refs">
        <div class="ref"><span>📄</span> Consigne ${ref} — document validé</div>
        <div class="ref"><span>⚠️</span> Limites : proposition automatique, à valider par un responsable HSE.</div>
      </div>
    </div>`;
    chat.scrollTop = chat.scrollHeight;
  }, 700);
}

function fillSitesRows() {
  const tb = document.getElementById('sites-rows');
  if (!tb) return;
  tb.innerHTML = SITES.map(s => `<tr>
      <td><b>${s.name}</b></td>
      <td>${s.sector}</td>
      <td>${s.open}</td>
      <td>${s.late ? `<span class="chip late">${s.late}</span>` : '<span class="chip closed">0</span>'}</td>
      <td>${s.users}</td>
      <td>${s.zones}</td>
    </tr>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const recent = document.getElementById('recent-reports');
  if (recent) recent.innerHTML = REPORTS.slice(0, 3).map(reportHTML).join('');
  const late = document.getElementById('late-actions');
  if (late) late.innerHTML = ACTIONS.filter(a => a.late).map(actionHTML).join('');
  const allR = document.getElementById('all-reports');
  if (allR) allR.innerHTML = REPORTS.map(reportHTML).join('');
  const allA = document.getElementById('all-actions');
  if (allA) allA.innerHTML = ACTIONS.map(actionHTML).join('');
  const notif = document.getElementById('notif-list');
  if (notif) notif.innerHTML = NOTIFS.map(notifHTML).join('');
  const chart = document.getElementById('monthly-chart');
  if (chart) chart.innerHTML = chartHTML(MONTHS);
  const bars = document.getElementById('cat-bars');
  if (bars) bars.innerHTML = barsHTML(CATS);
  fillSitesRows();

  bindFilters('reportFilters', 'reports');
  bindFilters('actionFilters', 'actions');
  bindSegment('roleSeg');
  bindSegment('periodSeg');
  bindTypePicker('typePicker');
  const ai = document.getElementById('aiText');
  if (ai) ai.addEventListener('keydown', e => { if (e.key === 'Enter') aiSend(); });
  document.querySelectorAll('[data-ai-question]').forEach(b => {
    b.addEventListener('click', () => {
      const input = document.getElementById('aiText');
      if (input) { input.value = b.dataset.aiQuestion; aiSend(); }
    });
  });
});
