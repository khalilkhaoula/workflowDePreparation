document.getElementById('sidebar').classList.toggle('open');

document.querySelectorAll('[data-search-target]').forEach(btn => {
  const targetSelector = btn.dataset.searchTarget;

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'topbar-search';
  input.placeholder = 'Rechercher…';
  input.hidden = true;
  btn.insertAdjacentElement('afterend', input);

  function filterItems(query) {
    const q = query.trim().toLowerCase();
    document.querySelectorAll(targetSelector).forEach(item => {
      const matches = !q || item.textContent.toLowerCase().includes(q);
      item.style.display = matches ? '' : 'none';
    });
  }

  btn.addEventListener('click', () => {
    input.hidden = !input.hidden;
    if (!input.hidden) {
      input.focus();
    } else {
      input.value = '';
      filterItems('');
    }
  });
input.addEventListener('input', () => filterItems(input.value));
input.addEventListener('input', () => {
  if (typeof applyFilter === 'function') applyFilter();
  else filterItems(input.value);
});
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      input.value = '';
      filterItems('');
      input.hidden = true;
      btn.focus();
    }
  });
});
/* ==========================================================================
   Nom / rôle réels de l'utilisateur connecté + badge de notifications réel.
   Fonctionne sur toute page ayant .user-name / .user-role / .badge-count.
   ========================================================================== */

const ROLE_LABELS = {
  'responsable commercial': 'Responsable commercial',
  'assistant commercial': 'Assistant commercial',
  'responsable technique': 'Responsable technique',
  'assistant technique': 'Assistant technique',
  'technicien': 'Technicien',
  'admin': 'Administrateur',
};

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function afficherUtilisateurConnecte() {
  const raw = localStorage.getItem('user');
  if (!raw) return;

  try {
    const user = JSON.parse(raw);
    const initiale = (user.prenom || '').charAt(0).toUpperCase();
    const nomAffiche = initiale ? `${initiale}. ${user.nom || ''}` : (user.nom || '—');

    document.querySelectorAll('.user-name').forEach(el => { el.textContent = nomAffiche; });
    document.querySelectorAll('.user-role').forEach(el => { el.textContent = ROLE_LABELS[user.role] || user.role || '—'; });
  } catch (err) {
    console.error('Erreur lecture utilisateur connecté:', err);
  }
}

async function majBadgeNotifications() {
  try {
    const res = await fetch('/api/notifications?limit=1', { headers: authHeaders() });
    if (!res.ok) return;
    const { nonLues } = await res.json();

    document.querySelectorAll('.badge-count').forEach(badge => {
      if (nonLues > 0) {
        badge.textContent = nonLues > 99 ? '99+' : String(nonLues);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    });
  } catch (err) {
    console.error('Erreur chargement du nombre de notifications:', err);
  }
}

function filtrerLiensSidebar() {
  const access = window.AccessControl;
  if (!access) return;
  const session = access.getSession();
  if (!session) return;

  document.querySelectorAll('.sidebar-nav a[href], .sidebar-footer a[href]').forEach(link => {
    const href = link.getAttribute('href').toLowerCase();
    const allowedRoles = access.PAGE_ACCESS[href];
    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      link.style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  afficherUtilisateurConnecte();
  filtrerLiensSidebar();
  majBadgeNotifications();
  setInterval(majBadgeNotifications, 15000);
});
