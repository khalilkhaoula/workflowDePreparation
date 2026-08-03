const API_BASE = ' http://localhost:3000/api';
function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let ENGINS = [];

function specBlocks(e) {
  const rows = [];
  if (e.marque) rows.push({ label: 'Marque', value: e.marque });
  if (e.modele) rows.push({ label: 'Modèle', value: e.modele });
  if (e.capacite) rows.push({ label: 'Capacité', value: e.capacite });
  if (e.vitesse) rows.push({ label: 'Vitesse', value: e.vitesse });
  if (e.hauteurLevage) rows.push({ label: 'Hauteur de levage', value: e.hauteurLevage });
  return rows.map(r => `<div class="spec-item"><dt>${r.label}</dt><dd>${r.value}</dd></div>`).join('');
}

async function chargerEngins() {
  const res = await fetch(`${API_BASE}/engins/catalogue`, { headers: authHeaders() });
  ENGINS = await res.json();
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('enginGrid');
  document.querySelector('.sub').textContent = `${ENGINS.length} modèle${ENGINS.length > 1 ? 's' : ''} référencé${ENGINS.length > 1 ? 's' : ''}. Sélectionnez une fiche pour voir le détail d'intervention.`;

  grid.innerHTML = ENGINS.map(e => `
    <div class="engin-card" data-id="${e.id}">
      <div class="engin-image" style="background-image: url('${e.imageUrl || ''}')">
        <img src="${e.imageUrl || ''}" alt="${e.nom}" style="display:none">
      </div>
      <div class="engin-body">
        <h3 class="engin-name">${e.nom}</h3>
        <dl class="spec-list">${specBlocks(e)}</dl>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.engin-card').forEach(card => {
    card.addEventListener('click', () => openDetail(Number(card.dataset.id)));
  });
}

function openDetail(id) {
  const e = ENGINS.find(x => x.id === id);
  if (!e) return;

  document.getElementById('detailSpecs').innerHTML = `<dl class="spec-list">${specBlocks(e)}</dl>`;

  document.getElementById('optionsSimpleList').innerHTML = e.options.map(opt => `
    <div class="option-simple-row">
      <span class="option-simple-dot"></span>
      <span class="option-simple-label">${opt.nom}${opt.sousOptions.length ? ` (${opt.sousOptions.map(s => s.nom).join(', ')})` : ''}</span>
    </div>
  `).join('') || '<p class="empty-state">Aucune option enregistrée.</p>';

  document.getElementById('piecesList').innerHTML = e.options.map(opt => `
    <div class="piece-row">
      <div class="pieces-list-items">${opt.pieces.map(p => `<span class="piece-item">${p}</span>`).join('') || '—'}</div>
    </div>
  `).join('');

  // frontend/engins.js — dans openDetail(), remplace le bloc timeList
document.getElementById('timeList').innerHTML = e.options.map(opt => `
  <div class="time-row">
    <span class="time-badge">${opt.duration}h</span>
  </div>
`).join('');

  document.getElementById('drawerOverlay').classList.add('active');
}

function lignesDetail(e) {
  const lignes = [];
  for (const opt of e.options) {
    if (opt.sousOptions.length > 0) {
      for (const s of opt.sousOptions) {
        lignes.push({ label: `${opt.nom} — ${s.nom}`, duration: s.duration, pieces: s.pieces });
      }
    } else {
      lignes.push({ label: opt.nom, duration: opt.duration, pieces: opt.pieces });
    }
  }
  return lignes;
}

function openDetail(id) {
  const e = ENGINS.find(x => x.id === id);
  if (!e) return;

  document.getElementById('detailSpecs').innerHTML = `<dl class="spec-list">${specBlocks(e)}</dl>`;

  const lignes = lignesDetail(e);

  document.getElementById('optionsSimpleList').innerHTML = lignes.map(l => `
    <div class="option-simple-row">
      <span class="option-simple-dot"></span>
      <span class="option-simple-label">${l.label}</span>
    </div>
  `).join('') || '<p class="empty-state">Aucune option enregistrée.</p>';

  document.getElementById('piecesList').innerHTML = lignes.map(l => `
    <div class="piece-row">
      <div class="pieces-list-items">${l.pieces.map(p => `<span class="piece-item">${p}</span>`).join('') || '—'}</div>
    </div>
  `).join('');

  document.getElementById('timeList').innerHTML = lignes.map(l => `
    <div class="time-row">
      <span class="time-badge">${l.duration}h</span>
    </div>
  `).join('');

  document.getElementById('drawerOverlay').classList.add('active');
}
function closeDetail() { document.getElementById('drawerOverlay').classList.remove('active'); }
document.getElementById('drawerOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'drawerOverlay') closeDetail();
});

document.addEventListener('DOMContentLoaded', chargerEngins);
