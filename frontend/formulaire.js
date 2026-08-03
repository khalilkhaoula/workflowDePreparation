
const STORAGE_KEY = 'demandeForm';
const API_BASE = '/api';
const ENGIN_FIELDS = ['marque', 'modele', 'mat', 'piping'];

let optionsCatalogue = [];

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function updateField(id, value) {
  const data = loadData();
  data[id] = value;
  saveData(data);
}
function updateFieldRaw(key, value) {
  const data = loadData();
  data[key] = value;
  saveData(data);
}

function hydrateFields() {
  const data = loadData();
  document.querySelectorAll('[data-field]').forEach(el => {
    const id = el.id;
    if (data[id] === undefined || data[id] === '') return;

    if (el.tagName === 'SELECT' && !Array.from(el.options).some(o => o.value === String(data[id]))) {
      el.appendChild(new Option(data[id], data[id]));
    }
    el.value = data[id];
  });

  if (data.reference) {
    const refDisplay = document.getElementById('refDisplay');
    if (refDisplay) refDisplay.textContent = `Référence : ${data.reference}`;
  }
}

function bindFields() {
  document.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', () => {
      updateField(el.id, el.value);
      if (ENGIN_FIELDS.includes(el.id)) onEnginFieldChange();
    });
  });
}

async function chargerSuggestionsLibre(id, endpoint, filterFields) {
  const input = document.getElementById(id);
  const datalist = document.getElementById(id + 'List');
  if (!input || !datalist) return;

  const params = new URLSearchParams();
  filterFields.forEach(f => {
    const v = document.getElementById(f)?.value;
    if (v) params.set(f, v);
  });

  const res = await fetch(`${API_BASE}/engins/${endpoint}?${params}`, { headers: authHeaders() });
  const values = await res.json();

  datalist.innerHTML = '';
  values.forEach(v => datalist.appendChild(new Option(v, v)));
}


async function chargerSuggestionsVerrouillee(id, endpoint, filterFields) {
  const select = document.getElementById(id);
  if (!select) return;
  const currentValue = select.value;

  const params = new URLSearchParams();
  filterFields.forEach(f => {
    const v = document.getElementById(f)?.value;
    if (v) params.set(f, v);
  });

  const res = await fetch(`${API_BASE}/engins/${endpoint}?${params}`, { headers: authHeaders() });
  const values = await res.json();

  select.innerHTML = '<option value="">Sélectionner…</option>';
  values.forEach(v => select.appendChild(new Option(v, v)));

  select.value = values.includes(currentValue) ? currentValue : '';
}

async function rafraichirCascade() {
  if (!document.getElementById('modele')) return;
  await chargerSuggestionsVerrouillee('modele', 'modeles', []);    
  await chargerSuggestionsLibre('mat', 'mats', ['modele']);
  await chargerSuggestionsLibre('piping', 'pipings', ['modele']);
}


async function onEnginFieldChange() {
  await rafraichirCascade();
  await majMarqueDepuisModele();   
  await genererChampsNumSerie();
  await chargerOptionsPourModele();
}

async function majMarqueDepuisModele() {
  const modele = document.getElementById('modele')?.value;
  const marqueInput = document.getElementById('marque');
  if (!marqueInput) return;
  if (!modele) { marqueInput.value = ''; return; }

  const res = await fetch(`${API_BASE}/engins/marque-par-modele/${encodeURIComponent(modele)}`, { headers: authHeaders() });
  const data = await res.json();
  marqueInput.value = data.marque || '';
  updateFieldRaw('marque', marqueInput.value);    
}


function getNumSeriesActuelles() {
  return Array.from(document.querySelectorAll('#numSerieContainer input'))
    .map(i => i.value).filter(Boolean);
}

async function genererChampsNumSerie() {
  const container = document.getElementById('numSerieContainer');
  if (!container) return;

  const nombre = parseInt(document.getElementById('nombreEngins')?.value) || 1;
  const dejaSaisis = loadData().numSeries || getNumSeriesActuelles();

  container.querySelectorAll('.num-serie-row').forEach(r => r.remove());

  for (let i = 0; i < nombre; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'num-serie-row';
    wrapper.innerHTML = `
      <input type="text" id="numSerie_${i}" list="numSerieList_${i}" placeholder="N° de série ${i + 1}" autocomplete="off">
      <datalist id="numSerieList_${i}"></datalist>`;
    container.appendChild(wrapper);

    await chargerSuggestionsLibre(`numSerie_${i}`, 'series', ['marque', 'modele', 'mat', 'piping']);

    const input = document.getElementById(`numSerie_${i}`);
    if (dejaSaisis[i]) input.value = dejaSaisis[i];
    input.addEventListener('change', persistNumSeries);
  }
  persistNumSeries();
}

function persistNumSeries() {
  updateFieldRaw('numSeries', getNumSeriesActuelles());
}

document.getElementById('nombreEngins')?.addEventListener('change', genererChampsNumSerie);

async function chargerOptionsPourModele() {
  const modele = document.getElementById('modele')?.value;
  const optionSelect = document.getElementById('optionSelect');
  const sousSelect = document.getElementById('sousOptionSelect');
  const hint = document.getElementById('optionsHint');
  if (!optionSelect || !sousSelect) return;

  optionSelect.innerHTML = '<option value="">Sélectionner une option…</option>';
  sousSelect.innerHTML = '<option value="">Sélectionner une sous-option…</option>';
  optionsCatalogue = [];

  if (!modele) { if (hint) hint.style.display = 'none'; return; }

  const res = await fetch(`${API_BASE}/options/par-modele/${encodeURIComponent(modele)}`, { headers: authHeaders() });
  optionsCatalogue = await res.json();

  if (hint) hint.style.display = optionsCatalogue.length ? 'none' : '';
  optionsCatalogue.forEach(o => optionSelect.appendChild(new Option(o.nom, o.id)));
}

document.getElementById('optionSelect')?.addEventListener('change', async () => {
  const sousSelect = document.getElementById('sousOptionSelect');
  sousSelect.innerHTML = '<option value="">Sélectionner une sous-option…</option>';
  const optionId = document.getElementById('optionSelect').value;
  if (!optionId) return;

  const res = await fetch(`${API_BASE}/options/${optionId}/sous-options`, { headers: authHeaders() });
  const sousOptions = await res.json();
  sousOptions.forEach(so => sousSelect.appendChild(new Option(so.nom, so.id)));
});

function ajouterOptionChoisie() {
  const optionSelect = document.getElementById('optionSelect');
  const sousSelect = document.getElementById('sousOptionSelect');
  const optionId = optionSelect.value;
  if (!optionId) return;

  const data = loadData();
  const options = data.options || [];

  if (options.some(o => String(o.optionId) === String(optionId))) {
    alert('Cette option est déjà ajoutée.');
    return;
  }

  options.push({
    optionId: Number(optionId),
    optionNom: optionSelect.options[optionSelect.selectedIndex].text,
    sousOptionId: sousSelect.value ? Number(sousSelect.value) : null,
    sousOptionNom: sousSelect.value ? sousSelect.options[sousSelect.selectedIndex].text : null,
  });
  data.options = options;
  saveData(data);
  renderOptionsAddedList();

  optionSelect.value = '';
  sousSelect.innerHTML = '<option value="">Sélectionner une sous-option…</option>';
}

function renderOptionsAddedList() {
  const options = loadData().options || [];
  const list = document.getElementById('optionsAddedList');
  if (!list) return;
  list.innerHTML = options.map((o, i) => `
    <div class="option-added-row">
      <span>${o.optionNom}${o.sousOptionNom ? ' — ' + o.sousOptionNom : ''}</span>
      <button type="button" onclick="supprimerOptionAjoutee(${i})">&times;</button>
    </div>`).join('');
}

function supprimerOptionAjoutee(index) {
  const options = loadData().options || [];
  options.splice(index, 1);
  updateFieldRaw('options', options);
  renderOptionsAddedList();
}

function renderFreeOption(nom) {
  const list = document.getElementById('freeOptionsList');
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.dataset.value = nom;
  tag.innerHTML = nom + ' <button type="button">&times;</button>';
  tag.querySelector('button').addEventListener('click', () => { tag.remove(); persistFreeOptions(); });
  list.appendChild(tag);
}
function persistFreeOptions() {
  const values = Array.from(document.querySelectorAll('#freeOptionsList .tag')).map(t => t.dataset.value);
  updateFieldRaw('freeOptions', values);
}
function addFreeOption() {
  const input = document.getElementById('freeOptionInput');
  const value = input.value.trim();
  if (!value) return;
  renderFreeOption(value);
  persistFreeOptions();
  input.value = '';
}
function restoreFreeOptions() {
  loadData().freeOptions?.forEach(renderFreeOption);
}


function buildPayload(envoyerMaintenant) {
  const data = loadData();
  return {
    modele: data.modele || '',
    mat: data.mat || '',
    piping: data.piping || '',
    numSeries: data.numSeries || [],
    nombreEngins: data.nombreEngins ? Number(data.nombreEngins) : 1,
    clientNom: data.nomClient || '',
    clientContact: data.contact || '',
    typeIntervention: data.typeIntervention || '',
    priorite: (data.priorite || 'Normale').toLowerCase(),
    dateLivraison: data.dateLivraison || null,
    lieuLivraison: data.lieuLivraison || null,
    modeLivraison: data.modeLivraison || null,
    remarque: data.remarques || '',
    options: (data.options || []).map(o => ({ optionId: o.optionId, sousOptionId: o.sousOptionId })),
    freeOptions: data.freeOptions || [],
    envoyerMaintenant,
  };
}

async function soumettre(envoyerMaintenant) {
  const data = loadData();
  const payload = buildPayload(envoyerMaintenant);

  if (!payload.modele || !payload.clientNom || !payload.typeIntervention) {
    alert('Veuillez au minimum renseigner le modèle, le client et le type d\'intervention.');
    return null;
  }

  const res = data.reference
    ? await fetch(`${API_BASE}/demandes/${data.reference}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload),
      })
    : await fetch(`${API_BASE}/demandes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload),
      });

  if (!res.ok) throw new Error((await res.json()).error || 'Erreur serveur');
  return res.json();
}

async function enregistrerDemande() {
  try {
    const result = await soumettre(false);
    if (!result) return;
    const data = loadData();
    data.reference = result.reference;
    saveData(data);
    const refDisplay = document.getElementById('refDisplay');
    if (refDisplay) refDisplay.textContent = `Référence : ${result.reference}`;

    const continuer = confirm(`Demande ${result.reference} enregistrée en brouillon. Voir la liste des demandes maintenant ? (Annuler pour continuer le formulaire)`);
    if (continuer) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = 'comercial.html';
    }
  } catch (err) {
    console.error(err);
    alert("Impossible d'enregistrer la demande : " + err.message);
  }
}

async function envoyerDemande() {
  try {
    const result = await soumettre(true);
    if (!result) return;
    alert('Demande envoyée au service technique.');
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = 'comercial.html';
  } catch (err) {
    console.error(err);
    alert("Impossible d'envoyer la demande : " + err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  hydrateFields();
  bindFields();
  await rafraichirCascade();
  await genererChampsNumSerie();
  await chargerOptionsPourModele();
  restoreFreeOptions();
  renderOptionsAddedList();
});
