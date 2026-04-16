

// ── Update check & run ────────────────────────────────────────────────────────

async function checkUpdate() {
  const badge  = document.getElementById('updateBadge');
  const meta   = document.getElementById('updateMeta');
  const commits = document.getElementById('updateCommits');
  const btn    = document.getElementById('updateBtn');
  const status = document.getElementById('updateStatus');

  badge.className = 'update-badge checking';
  badge.textContent = '⬤ Wird geprüft…';
  meta.textContent  = '';
  commits.innerHTML = '';

  try {
    const r = await fetch('api.php?action=check_update');
    const d = await r.json();

    if (d.error) throw new Error(d.error);

    meta.textContent = `Aktueller Stand: ${d.current_hash}  (${d.branch})` +
      (d.current_date ? `  ·  ${d.current_date.slice(0,10)}` : '');

    if (d.up_to_date) {
      badge.className   = 'update-badge current';
      badge.textContent = '✔ Aktuell';
      btn.disabled = true;
      status.textContent = '';
    } else {
      badge.className   = 'update-badge outdated';
      badge.textContent = `⬤ Nicht aktuell  (+${d.behind})`;
      btn.disabled = false;

      if (d.commits && d.commits.length) {
        commits.innerHTML = d.commits
          .map(c => `<span>▸ ${escHtml(c)}</span>`)
          .join('<br>');
        if (d.changelog_url) {
          commits.innerHTML += `<br><a href="${d.changelog_url}" target="_blank" rel="noopener">→ Alle Änderungen auf GitHub</a>`;
        }
      }
    }
  } catch (e) {
    badge.className   = 'update-badge error';
    badge.textContent = '✘ Fehler';
    meta.textContent  = e.message || 'Unbekannter Fehler';
    btn.disabled = false; // allow manual retry via update
  }
}

async function doUpdate() {
  const btn    = document.getElementById('updateBtn');
  const status = document.getElementById('updateStatus');
  const badge  = document.getElementById('updateBadge');

  btn.disabled = true;
  badge.className = 'update-badge checking';
  badge.textContent = '⬤ Wird aktualisiert…';
  status.textContent = '⏳ Update läuft…';

  try {
    const r = await fetch('api.php?action=do_update');
    const d = await r.json();

    if (d.ok) {
      status.textContent = `✔ Fertig  (${d.new_hash || 'OK'})`;
      await checkUpdate(); // refresh badge
    } else {
      status.textContent = `✘ Fehler (Code ${d.code})`;
      if (d.output) status.title = d.output;
      badge.className = 'update-badge error';
      badge.textContent = '✘ Fehler';
      btn.disabled = false;
    }
  } catch (e) {
    status.textContent = '✘ Netzwerkfehler';
    badge.className = 'update-badge error';
    badge.textContent = '✘ Fehler';
    btn.disabled = false;
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Run check on page load
checkUpdate();