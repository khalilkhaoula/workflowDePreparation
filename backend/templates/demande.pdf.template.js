function escapeHtml(str) {
  if (str === undefined || str === null) return '—';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderOptionsRows(options) {
  if (!options || options.length === 0) {
    return '<tr><td colspan="3" class="empty">Aucune option planifiée pour l\'instant.</td></tr>';
  }
  return options.map(opt => `
    <tr>
      <td class="opt">${escapeHtml(opt.label)}</td>
      <td class="pieces">${escapeHtml((opt.pieces || []).join(', '))}</td>
      <td class="time"><span class="time-badge">${escapeHtml(opt.duration)}h</span></td>
    </tr>
  `).join('');
}

function buildDemandeHtml(d) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(d.reference)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
  :root {
    --charcoal-dark:#35383b; --ink:#1d1e20; --orange:#f2941e; --orange-dark:#d97b0f;
    --bg:#f6f5f3; --paper:#ffffff; --line:#e3e1dd; --muted:#8a8d90; --charcoal:#53575c;
  }
  * { box-sizing: border-box; }
  @page { size: A4; margin: 10mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header {
    display:flex; align-items:center; justify-content:space-between;
    padding-bottom:18px; margin-bottom:6px; border-bottom:1px solid var(--line);
  }
  .header .brand {
    font-family:'Manrope',sans-serif; font-weight:700; font-size:.68rem;
    letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin:0 0 6px;
  }
  .header h1 {
    font-family:'Manrope',sans-serif; font-weight:800; font-size:1.35rem;
    text-transform:uppercase; letter-spacing:.4px; margin:0; color:var(--ink);
    position:relative; padding-left:14px;
  }
  .header h1::before {
    content:''; position:absolute; left:0; top:50%; transform:translateY(-50%);
    width:4px; height:20px; border-radius:3px; background:var(--orange);
  }

  .section {
    background:var(--bg); border-radius:12px; padding:16px 20px; margin-top:14px;
  }
  .section-title {
    display:flex; align-items:center; gap:8px;
    font-family:'Manrope',sans-serif; font-weight:700; font-size:.72rem;
    text-transform:uppercase; letter-spacing:.5px; color:var(--muted); margin:0 0 12px;
  }
  .section-title::before {
    content:''; width:3px; height:13px; border-radius:2px; background:var(--orange);
  }

  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; }
  .item { display:flex; flex-direction:column; gap:3px; }
  .item.span { grid-column:1/-1; }
  .label { font-size:.66rem; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); font-weight:600; }
  .value { font-size:.86rem; font-weight:600; color:var(--ink); }

  .desc { background:var(--bg); border-radius:12px; padding:14px 20px; margin-top:14px; }
  .desc p { margin:6px 0 0; font-size:.84rem; line-height:1.5; color:var(--ink); }

  table { width:100%; border-collapse:collapse; font-size:.8rem; margin-top:4px; }
  th {
    text-align:left; font-family:'Manrope',sans-serif; font-size:.66rem; font-weight:700;
    text-transform:uppercase; letter-spacing:.3px; color:var(--muted);
    padding:8px 8px; border-bottom:1px solid var(--line); background:#fbfaf9;
  }
  td { padding:9px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .opt { font-weight:700; width:32%; color:var(--ink); }
  .time { width:50px; text-align:right; }
  .empty { text-align:center; color:var(--muted); padding:12px 0; }

  .time-badge {
    background:rgba(242,148,30,.1); color:var(--orange-dark);
    padding:3px 10px; border-radius:20px; font-size:.72rem; font-weight:700;
  }

  .footer { margin-top:22px; font-size:.68rem; color:var(--muted); text-align:center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <p class="brand">Forges de Bazas</p>
      <h1>${escapeHtml(d.reference)}</h1>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Partie commerciale</h2>
    <div class="grid">
      <div class="item"><span class="label">Référence</span><span class="value">${escapeHtml(d.reference)}</span></div>
      <div class="item"><span class="label">Type d'intervention</span><span class="value">${escapeHtml(d.typeIntervention)}</span></div>
      <div class="item"><span class="label">Marque</span><span class="value">${escapeHtml(d.marque)}</span></div>
      <div class="item"><span class="label">Piping</span><span class="value">${escapeHtml(d.piping)}</span></div>
      <div class="item"><span class="label">N° de série</span><span class="value">${escapeHtml(d.numSerie)}</span></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Service spécifique</h2>
    <div class="grid">
      <div class="item"><span class="label">Nom du client</span><span class="value">${escapeHtml(d.client)}</span></div>
      <div class="item"><span class="label">Contact</span><span class="value">${escapeHtml(d.contact)}</span></div>
      <div class="item span"><span class="label">Lieu de livraison</span><span class="value">${escapeHtml(d.lieu)}</span></div>
      <div class="item"><span class="label">Date de livraison</span><span class="value">${escapeHtml(d.dateLivraison)}</span></div>
      <div class="item"><span class="label">Mode de livraison</span><span class="value">${escapeHtml(d.modeLivraison)}</span></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Priorité &amp; statut</h2>
    <div class="grid">
      <div class="item"><span class="label">Priorité</span><span class="value">${escapeHtml(d.priorite)}</span></div>
      <div class="item"><span class="label">Statut</span><span class="value">${escapeHtml(d.statut)}</span></div>
    </div>
  </div>

  <div class="desc">
    <span class="label">Remarque</span>
    <p>${escapeHtml(d.remarque)}</p>
  </div>

  <div class="section">
    <h2 class="section-title">Options &amp; pièces nécessaires</h2>
    <table>
      <thead><tr><th>Option</th><th>Pièces</th><th>Temps</th></tr></thead>
      <tbody>${renderOptionsRows(d.options)}</tbody>
    </table>
  </div>

  <p class="footer">Généré le ${new Date().toLocaleDateString('fr-FR')} — Forges de Bazas</p>
</body>
</html>`;
}
module.exports = { buildDemandeHtml };
