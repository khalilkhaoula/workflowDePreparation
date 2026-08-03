(function () {
const ROLE_HOME = {
    'responsable commercial': 'comercial.html',
    'assistant commercial': 'comercial.html',
    'responsable technique': 'Technique.html',
    'assistant technique': 'Technique.html',
    'technicien': 'Technicien.html',
    'admin': 'admin.html',
  };

  const ALL_ROLES = Object.keys(ROLE_HOME);

  const PAGE_ACCESS = {
    'comercial.html': ['responsable commercial', 'assistant commercial'],
    'fcomercial.html': ['responsable commercial', 'assistant commercial'],
    'fservice.html': ['responsable commercial', 'assistant commercial'],
    'fcompliment.html': ['responsable commercial', 'assistant commercial'],

    'technique.html': ['responsable technique', 'assistant technique'],
    'dashbord.html': ['responsable technique', 'assistant technique', 'admin'],
    'planification.html': ['responsable technique', 'assistant technique'],

    'technicien.html': ['technicien'],

    'admin.html': ['admin'],
    'engins.html': ['admin'],
    'ajouterengin.html': ['admin'],

    'compte.html': ALL_ROLES,
    'notifications.html': ALL_ROLES,
  };

  const PUBLIC_PAGES = ['login.html', ''];

  function currentPage() {
    const path = window.location.pathname;
    const file = path.substring(path.lastIndexOf('/') + 1);
    return file.toLowerCase() || 'login.html';
  }

  function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
  }

  function getSession() {
    const token = localStorage.getItem('authToken');
    const raw = localStorage.getItem('user');
    if (!token || !raw) return null;
    try {
      const user = JSON.parse(raw);
      if (!user || !user.role) return null;
      const original = user.role;
      user.role = normalizeRole(user.role);
      if (!ROLE_HOME[user.role]) {
        console.warn(
          `[access-control] Rôle non reconnu : "${original}". ` +
          `Valeurs attendues : ${Object.keys(ROLE_HOME).join(', ')}. ` +
          `Vérifiez la colonne "role" de ce compte dans la table utilisateurs.`
        );
        return null;
      }
      return { token, user };
    } catch (e) {
      return null;
    }
  }

  window.AccessControl = { ROLE_HOME, ALL_ROLES, PAGE_ACCESS, getSession };

  const page = currentPage();
  const session = getSession();

  if (PUBLIC_PAGES.includes(page)) {
    if (session && ROLE_HOME[session.user.role]) {
      window.location.replace(ROLE_HOME[session.user.role]);
    }
    return;
  }

  if (!session) {
    window.location.replace('logIn.html');
    return;
  }

  const allowedRoles = PAGE_ACCESS[page];
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    window.location.replace(ROLE_HOME[session.user.role] || 'logIn.html');
  }
})();