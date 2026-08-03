let pendingImage = null;
const API_BASE = '/api';
function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let addedOptions = [];
let sousOptionsEnCours = [];

document.getElementById('enginImageUrl').addEventListener('input', (e) => {
  const preview = document.getElementById('imagePreview');
  if (e.target.value) { preview.src = e.target.value; preview.style.display = ''; }
  else preview.style.display = 'none';
});

async function chargerSuggestions() {
  const [options, pieces] = await Promise.all([
    fetch(`${API_BASE}/engins/options-existantes`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API_BASE}/engins/pieces-existantes`, { headers: authHeaders() }).then(r => r.json()),
  ]);
  document.getElementById('optionsCatalogueList').innerHTML = options.map(o => `<option value="${o}">`).join('');
  document.getElementById('piecesCatalogueList').innerHTML = pieces.map(p => `<option value="${p}">`).join('');
}

document.getElementById('newOptLabel').addEventListener('blur', async () => {
  const nomOption = document.getElementById('newOptLabel').value.trim();
  if (!nomOption) return;
  const res = await fetch(`${API_BASE}/engins/sous-options-existantes?nomOption=${encodeURIComponent(nomOption)}`, { headers: authHeaders() });
  const sousOptions = await res.json();
  document.getElementById('sousOptionsCatalogueList').innerHTML = sousOptions.map(s => `<option value="${s}">`).join('');
});

function addPieceTag(tagList, value) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = value;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '×';
  remove.addEventListener('click', () => tag.remove());
  tag.appendChild(remove);
  tagList.appendChild(tag);
}
function tagValues(tagList) {
  return Array.from(tagList.querySelectorAll('.tag')).map(t => t.textContent.replace('×', '').trim());
}

document.getElementById('newSousOptPieceInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    e.preventDefault();
    addPieceTag(document.getElementById('newSousOptPieces'), e.target.value.trim());
    e.target.value = '';
  }
});

document.getElementById('addSousOptBtn').addEventListener('click', () => {
  const nom = document.getElementById('newSousOptLabel').value.trim();
  const duration = Number(document.getElementById('newSousOptDuration').value) || 0;
  const pieces = tagValues(document.getElementById('newSousOptPieces'));
  if (!nom) return;

  sousOptionsEnCours.push({ nom, duration, pieces });

  document.getElementById('newSousOptLabel').value = '';
  document.getElementById('newSousOptDuration').value = '';
  document.getElementById('newSousOptPieces').innerHTML = '';

  renderSousOptionsEnCours();
  majExclusivitePieces();
});

function renderSousOptionsEnCours() {
  document.getElementById('addedSousOptionsList').innerHTML = sousOptionsEnCours.map((s, i) => `
    <div class="added-option-row">
      <div class="added-option-main">
        <span class="added-option-label">${s.nom}</span>
        <span class="time-badge">${s.duration}h</span>
      </div>
      <div class="added-option-pieces">${s.pieces.map(p => `<span class="piece-chip">${p}</span>`).join('') || '—'}</div>
      <button type="button" class="btn-remove-row" data-i="${i}">Supprimer</button>
    </div>
  `).join('');
  document.querySelectorAll('#addedSousOptionsList .btn-remove-row').forEach(btn => {
    btn.addEventListener('click', () => {
      sousOptionsEnCours.splice(Number(btn.dataset.i), 1);
      renderSousOptionsEnCours();
      majExclusivitePieces();
    });
  });
}

function majExclusivitePieces() {
  const bloc = document.getElementById('optionPiecesBlock');
  const input = document.getElementById('newOptPieceInput');
  const actif = sousOptionsEnCours.length === 0;
  bloc.style.opacity = actif ? '1' : '0.4';
  input.disabled = !actif;
  if (!actif) document.getElementById('newOptPieces').innerHTML = '';
}

document.getElementById('addOptionBtn').addEventListener('click', () => {
  const nom = document.getElementById('newOptLabel').value.trim();
  const duration = Number(document.getElementById('newOptDuration').value) || 0;

  const pieces = sousOptionsEnCours.length === 0 ? tagValues(document.getElementById('newOptPieces')) : [];
  if (!nom) { document.getElementById('newOptLabel').focus(); return; }

  addedOptions.push({ nom, duration, pieces, sousOptions: [...sousOptionsEnCours] });

  document.getElementById('newOptLabel').value = '';
  document.getElementById('newOptDuration').value = '1';
  document.getElementById('newOptPieces').innerHTML = '';
  sousOptionsEnCours = [];
  renderSousOptionsEnCours();
  majExclusivitePieces();
  renderAddedOptions();
});

function renderAddedOptions() {
  document.getElementById('addedOptionsList').innerHTML = addedOptions.map((opt, i) => `
    <div class="added-option-row">
      <div class="added-option-main">
        <span class="added-option-label">${opt.nom}</span>
        <span class="time-badge">${opt.duration}h</span>
      </div>
      ${opt.sousOptions.length ? `<div class="added-option-pieces">${opt.sousOptions.map(s => `<span class="piece-chip">${s.nom} (${s.duration}h)</span>`).join('')}</div>` : ''}
      <div class="added-option-pieces">${opt.pieces.map(p => `<span class="piece-chip">${p}</span>`).join('')}</div>
      <button type="button" class="btn-remove-row" data-index="${i}">Supprimer</button>
    </div>
  `).join('');

  document.querySelectorAll('.btn-remove-row').forEach(btn => {
    btn.addEventListener('click', () => { addedOptions.splice(Number(btn.dataset.index), 1); renderAddedOptions(); });
  });
}

document.getElementById('enginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    nom: document.getElementById('enginName').value.trim(),
    marque: document.getElementById('enginMarque').value.trim(),
    modele: document.getElementById('enginModele').value.trim(),
    piping: document.getElementById('enginPiping').value,   
    mat: document.getElementById('enginMat').value,        
    capacite: document.getElementById('enginCapacite').value.trim(),
    vitesse: document.getElementById('enginVitesse').value.trim(),
    hauteurLevage: document.getElementById('enginHauteur').value.trim(),
    imageUrl: document.getElementById('enginImageUrl').value.trim(),
    options: addedOptions,
  };

  const res = await fetch(`${API_BASE}/engins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }

  window.location.href = 'engins.html';
});

document.addEventListener('DOMContentLoaded', chargerSuggestions);
