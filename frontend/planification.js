const API_BASE = '/api';
function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MONTH_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) { return new Date(date.getTime() + n * DAY_MS); }

let refDate = new Date();
let selectedDate = null;
let tachesDuMois = [];
let pendingDemandeRef = localStorage.getItem('pendingDemandeRef');
let pendingDemandeDetail = null;

function renderPendingBanner() {
  const banner = document.getElementById('pendingBanner');
  const text = document.getElementById('pendingBannerText');
  if (pendingDemandeRef) {
    text.textContent = `Planification de ${pendingDemandeRef} — cliquez sur un jour pour choisir la date de début.`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

function cancelPendingDemande() {
  pendingDemandeRef = null;
  pendingDemandeDetail = null;
  localStorage.removeItem('pendingDemandeRef');
  renderPendingBanner();
}

async function chargerDemandeEnAttente() {
  if (!pendingDemandeRef) return;
  const res = await fetch(`${API_BASE}/demandes/${pendingDemandeRef}/detail`, { headers: authHeaders() });
  if (!res.ok) { cancelPendingDemande(); return; }
  pendingDemandeDetail = await res.json();
  renderPendingBanner();
}

async function chargerTechniciens() {
  const res = await fetch(`${API_BASE}/utilisateurs/techniciens`, { headers: authHeaders() });
  const techniciens = await res.json();
  document.getElementById('optTechnicien').innerHTML = techniciens.length
    ? techniciens.map(t => `<option value="${t.id}">${t.prenom} ${t.nom}</option>`).join('')
    : '<option value="">Aucun technicien actif</option>';
}
async function chargerTachesDuMois() {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const debut = toDateStr(new Date(year, month, 1));
  const fin = toDateStr(new Date(year, month + 1, 0));

  const res = await fetch(`${API_BASE}/demande-options/par-periode?debut=${debut}&fin=${fin}`, { headers: authHeaders() });
  tachesDuMois = await res.json();
}

function dayLoad(dateStr) {
  return tachesDuMois.filter(t => t.date_planifiee?.slice(0, 10) === dateStr).length;
}

async function renderMonth() {
  await chargerTachesDuMois();

  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  document.getElementById('navLabel').textContent = `${MONTH_LABELS[month]} ${year}`;
  document.getElementById('monthWeekdays').innerHTML = DAY_LABELS.map(l => `<div>${l}</div>`).join('');

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    if (i >= 35 && d.getMonth() !== month) break;
    cells.push(d);
  }

  const grid = document.getElementById('monthGrid');
  grid.innerHTML = cells.map(d => {
  const dateStr = toDateStr(d);
  const inMonth = d.getMonth() === month;
  const count = dayLoad(dateStr);
  const finsPrevues = finPrevueCe(dateStr);
return `<div class="month-cell ${inMonth ? '' : 'muted'} ${dateStr === toDateStr(new Date()) ? 'today' : ''}" data-date="${dateStr}">    <span class="cell-day">${d.getDate()}</span>
    ${finsPrevues.length ? `<span class="cell-deadline" title="Fin prévue : ${finsPrevues.map(f => f.reference).join(', ')}">🏁</span>` : ''}
    ${count > 0 ? `<span class="cell-load">${count} tâche${count > 1 ? 's' : ''}</span>` : ''}
  </div>`;
}).join('');

  grid.querySelectorAll('.month-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (pendingDemandeRef && pendingDemandeDetail) {
        openDay(cell.dataset.date);
        openOptionForm();
      } else {
        openDay(cell.dataset.date);
      }
    });
  });
}

function formatDayTitle(dateStr) {
  const d = new Date(dateStr);
  const dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

function openDay(dateStr) {
  selectedDate = dateStr;
  document.getElementById('dayTitle').textContent = formatDayTitle(dateStr);
  renderDayTasks();
  document.getElementById('optionForm').hidden = true;
  document.getElementById('showFormBtn').hidden = false;
  document.getElementById('dayOverlay').classList.add('active');
}

function closeDay() { document.getElementById('dayOverlay').classList.remove('active'); }

function renderDayTasks() {

  const dayTasks = tachesDuMois.filter(t => t.date_planifiee?.slice(0, 10) === selectedDate && t.statut !== 'termine');
  const list = document.getElementById('dayTaskList');

  if (dayTasks.length === 0) {
    list.innerHTML = '<p class="empty-state">Aucune option planifiée ce jour-là.</p>';
    return;
  }

  list.innerHTML = dayTasks.map(t => `
    <div class="day-task" data-id="${t.id}">
      <label class="day-task-checkbox">
        <input type="checkbox" data-option-id="${t.id}">
      </label>
      <div class="day-task-info">
        <span class="day-task-label">${t.nom_option}</span>
        <span class="day-task-meta">${t.reference} — ${t.engin_nom} — ${t.temps_main_oeuvre_h}h</span>
      </div>
      <button class="btn-icon btn-icon-danger" title="Retirer du planning" onclick="annulerPlanification(${t.id})">🗑</button>
    </div>
  `).join('');

  list.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => terminerOption(cb.dataset.optionId, cb));
  });
}

async function terminerOption(id, checkbox) {
  if (!checkbox.checked) { checkbox.checked = true; return; }
  const res = await fetch(`${API_BASE}/demande-options/${id}/terminer`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) { checkbox.checked = false; alert('Impossible de marquer cette option comme terminée.'); return; }

  const task = tachesDuMois.find(t => String(t.id) === String(id));
  if (task) task.statut = 'termine';
  renderDayTasks();
}
async function terminerOption(id, checkbox) {
  if (!checkbox.checked) { checkbox.checked = true; return; }
  const res = await fetch(`${API_BASE}/demande-options/${id}/terminer`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) { checkbox.checked = false; alert('Impossible de marquer cette option comme terminée.'); return; }
  const task = tachesDuMois.find(t => String(t.id) === String(id));
  if (task) task.statut = 'termine';
}

function openOptionForm() {
  const form = document.getElementById('optionForm');
  document.getElementById('optDemandeRef').value = pendingDemandeRef;

  const optionSelect = document.getElementById('optOption');
  const optionsNonPlanifiees = (pendingDemandeDetail.options || []).filter(o => o.statut !== 'termine');
  optionSelect.innerHTML = optionsNonPlanifiees.length
    ? optionsNonPlanifiees.map(o => `<option value="${o.demandeOptionId}">${o.label} (${o.duration}h/engin)</option>`).join('')
    : '<option value="">Aucune option à planifier</option>';

  document.getElementById('optHeureDebut').value = '';
  document.getElementById('optHeureFin').value = '';
  document.getElementById('optIsEnd').checked = false;

  form.hidden = false;
  document.getElementById('showFormBtn').hidden = true;
  majHeureFin();
  chargerTechniciens()
}

document.getElementById('optionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const demandeOptionId = document.getElementById('optOption').value;
  if (!demandeOptionId) return;

  const technicienId = document.getElementById('optTechnicien').value;   // ← vérifie que cette ligne existe bien

  const res = await fetch(`${API_BASE}/demande-options/${demandeOptionId}/planifier`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      technicienId: technicienId ,   // ← et que cette clé est bien présente ici
      datePlanifiee: selectedDate,
      heureDebut: document.getElementById('optHeureDebut').value,
      estDateFin: document.getElementById('optIsEnd').checked,
    }),
  });
  if (!res.ok) { alert('Erreur lors de la planification.'); return; }

  cancelPendingDemande();
  cancelForm();
  await renderMonth();
  openDay(selectedDate);
});
function cancelForm() {
  document.getElementById('optionForm').hidden = true;
  document.getElementById('showFormBtn').hidden = false;
}


document.getElementById('dayOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'dayOverlay') closeDay();
});
document.getElementById('showFormBtn').addEventListener('click', () => {
  if (pendingDemandeRef && pendingDemandeDetail) openOptionForm();
  else alert('Ouvrez d\'abord une demande à planifier depuis "Service technique".');
});

document.getElementById('prevBtn').addEventListener('click', () => {
  refDate = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  renderMonth();
});
document.getElementById('nextBtn').addEventListener('click', () => {
  refDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
  renderMonth();
});

(async function init() {
  await chargerTechniciens();
  await chargerDemandeEnAttente();
  await renderMonth();
  const params = new URLSearchParams(window.location.search);
  const dateCible = params.get('date');
  const optionCibleId = params.get('demandeOptionId');
  if (dateCible) {
    refDate = new Date(dateCible);
    await renderMonth();
    openDay(dateCible);
    if (optionCibleId) {
      setTimeout(() => {
        const row = document.querySelector(`.day-task input[data-option-id="${optionCibleId}"]`)?.closest('.day-task');
        row?.classList.add('highlighted');
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
})();

function addHoursToTime(heureDebut, heures) {
  const [h, m] = heureDebut.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(heures * 60);
  const finH = Math.floor((totalMinutes % (24 * 60)) / 60);
  const finM = totalMinutes % 60;
  const jours = Math.floor(totalMinutes / (24 * 60));
  const heureStr = `${String(finH).padStart(2, '0')}:${String(finM).padStart(2, '0')}`;
  return jours > 0 ? `${heureStr} (+${jours}j)` : heureStr;
}

function majHeureFin() {
  const optionSelect = document.getElementById('optOption');
  const heureDebut = document.getElementById('optHeureDebut').value;
  const finField = document.getElementById('optHeureFin');
  const selected = pendingDemandeDetail?.options?.find(o => String(o.demandeOptionId) === optionSelect.value);

  if (!heureDebut || !selected) { finField.value = ''; return; }
  const dureeTotale = selected.duration * (pendingDemandeDetail.nombreEngins || 1);
  finField.value = addHoursToTime(heureDebut, dureeTotale);
}

document.getElementById('optHeureDebut').addEventListener('input', majHeureFin);
document.getElementById('optOption').addEventListener('change', majHeureFin);

let finsPrevuesDuMois = [];

async function chargerTachesDuMois() {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const debut = toDateStr(new Date(year, month, 1));
  const fin = toDateStr(new Date(year, month + 1, 0));

  const res = await fetch(`${API_BASE}/demande-options/par-periode?debut=${debut}&fin=${fin}`, { headers: authHeaders() });
  const data = await res.json();
  tachesDuMois = data.taches;
  finsPrevuesDuMois = data.finsPrevues;
}

function finPrevueCe(dateStr) {
  return finsPrevuesDuMois.filter(f => f.date_fin_prevue?.slice(0, 10) === dateStr);
}

async function annulerPlanification(id) {
  if (!confirm('Retirer cette option du planning de ce jour ?')) return;
  const res = await fetch(`${API_BASE}/demande-options/${id}/annuler-planification`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) { alert((await res.json()).error); return; }
  await renderMonth();
  openDay(selectedDate);
}
