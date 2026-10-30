(() => {
  const $ = (s) => document.querySelector(s);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const LETTERS = 'ABCDEF';
  const DEFAULT_KEYS = {
    o0: 'Digit1', o1: 'Digit2', o2: 'Digit3', o3: 'Digit4', o4: 'Digit5', o5: 'Digit6',
    skip: 'KeyS', prev: 'ArrowLeft', next: 'ArrowRight'
  };
  const KEY_NAMES = {
    o0: 'Option 1', o1: 'Option 2', o2: 'Option 3', o3: 'Option 4', o4: 'Option 5', o5: 'Option 6',
    skip: 'Skip', prev: 'Previous', next: 'Next'
  };

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  let keys = Object.assign({}, DEFAULT_KEYS, load('at_keys', {}));
  let S = load('at_session', null);
  let filter = 'all';
  let capturing = null;

  const persist = () => {
    try {
      localStorage.setItem('at_session', JSON.stringify(S));
      localStorage.setItem('at_keys', JSON.stringify(keys));
    } catch {}
  };

  /* ---------- helpers ---------- */
  const label = (i) => S.style === 'letters' ? LETTERS[i] : S.style === 'roman' ? ROMAN[i] : String(i + 1);
  const lastQ = () => (S.count ? S.first + S.count - 1 : null);
  const maxSeen = () => Math.max(S.current, ...Object.keys(S.answers).map(Number));
  const endQ = () => (lastQ() !== null ? lastQ() : maxSeen());
  const valueText = (v) => (v === undefined ? 'Not answered' : v === 'skip' ? 'Skipped' : label(v));
  const counts = () => {
    const vals = Object.values(S.answers);
    return { answered: vals.filter((v) => v !== 'skip').length, skipped: vals.filter((v) => v === 'skip').length };
  };

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- rendering ---------- */
  function render() {
    $('#setup').classList.toggle('hidden', !!S);
    $('#test').classList.toggle('hidden', !S);
    if (!S) return;

    const c = counts();
    const total = lastQ() !== null ? ` / ${S.count}` : '';
    $('#progress').textContent = `Answered ${c.answered}${total} · Skipped ${c.skipped}`;
    $('#qNum').textContent = S.current;

    const v = S.answers[S.current];
    $('#qStatus').textContent = v === undefined ? 'Not answered yet' : v === 'skip' ? 'Skipped' : `Answer: ${label(v)}`;

    const box = $('#options');
    box.innerHTML = '';
    for (let i = 0; i < S.options; i++) {
      const b = document.createElement('button');
      b.textContent = label(i);
      if (v === i) b.classList.add('selected');
      b.addEventListener('click', () => answer(i));
      box.appendChild(b);
    }
    if (S.options % 2 === 1) box.lastChild.style.gridColumn = '1 / -1';
  }

  function go(q) {
    if (q < S.first) return toast('This is the first question');
    if (lastQ() !== null && q > lastQ()) return toast('This is the last question');
    S.current = q;
    persist();
    render();
  }

  function advance() {
    if (lastQ() !== null && S.current >= lastQ()) { persist(); render(); return toast('Last question reached'); }
    go(S.current + 1);
  }

  function answer(i) { S.answers[S.current] = i; advance(); }
  function skip() { S.answers[S.current] = 'skip'; advance(); }

  /* ---------- setup ---------- */
  $('#setupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = parseInt($('#inFirst').value, 10);
    const count = parseInt($('#inCount').value, 10);
    if (isNaN(first)) return;
    S = {
      first,
      count: isNaN(count) ? null : count,
      options: parseInt($('#inOptions').value, 10),
      style: $('#inStyle').value,
      current: first,
      answers: {}
    };
    persist();
    render();
  });

  $('#btnNew').addEventListener('click', () => {
    if (!confirm('Start a new session? Current answers will be cleared. Export first if you need them.')) return;
    S = null;
    try { localStorage.removeItem('at_session'); } catch {}
    render();
  });

  $('#btnSkip').addEventListener('click', skip);
  $('#btnPrev').addEventListener('click', () => go(S.current - 1));
  $('#btnNext').addEventListener('click', () => go(S.current + 1));

  /* ---------- dialogs ---------- */
  const needSession = () => { if (!S) { toast('Start a session first'); return false; } return true; };
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  // Grid
  function renderGrid() {
    const grid = $('#grid');
    grid.innerHTML = '';
    for (let q = S.first; q <= endQ(); q++) {
      const v = S.answers[q];
      if (filter === 'skipped' && v !== 'skip') continue;
      if (filter === 'unanswered' && v !== undefined) continue;
      const b = document.createElement('button');
      b.textContent = q;
      if (v === 'skip') b.classList.add('skipped');
      else if (v !== undefined) b.classList.add('answered');
      if (q === S.current) b.classList.add('current');
      b.addEventListener('click', () => { $('#dlgGrid').close(); go(q); });
      grid.appendChild(b);
    }
    if (!grid.children.length) grid.innerHTML = '<p class="muted small">Nothing to show here.</p>';
  }
  $('#btnGrid').addEventListener('click', () => {
    if (!needSession()) return;
    renderGrid();
    $('#dlgGrid').showModal();
    const cur = $('#grid .current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
  document.querySelectorAll('[data-filter]').forEach((c) => c.addEventListener('click', () => {
    filter = c.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('on', x === c));
    renderGrid();
  }));

  // Keys
  const pretty = (code) => (code ? code.replace(/^Key|^Digit/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2') : 'Not set');
  function renderKeys() {
    const list = $('#keyList');
    list.innerHTML = '';
    Object.keys(KEY_NAMES).forEach((action) => {
      const row = document.createElement('div');
      row.className = 'keyrow';
      row.innerHTML = `<span>${KEY_NAMES[action]}</span>`;
      const b = document.createElement('button');
      b.textContent = capturing === action ? 'Press a key…' : pretty(keys[action]);
      if (capturing === action) b.classList.add('waiting');
      b.addEventListener('click', () => { capturing = action; renderKeys(); });
      row.appendChild(b);
      list.appendChild(row);
    });
  }
  $('#btnKeys').addEventListener('click', () => { capturing = null; renderKeys(); $('#dlgKeys').showModal(); });
  $('#dlgKeys').addEventListener('close', () => { capturing = null; });
  $('#btnResetKeys').addEventListener('click', () => { keys = Object.assign({}, DEFAULT_KEYS); persist(); renderKeys(); });

  // Export
  $('#btnExport').addEventListener('click', () => { if (needSession()) $('#dlgExport').showModal(); });

  function buildRows() {
    const rows = [];
    for (let q = S.first; q <= endQ(); q++) rows.push([q, valueText(S.answers[q])]);
    return rows;
  }
  const optionList = () => Array.from({ length: S.options }, (_, i) => label(i)).join(', ');

  $('#btnCopy').addEventListener('click', async () => {
    const c = counts();
    const text =
      `Questions: ${S.first} to ${endQ()}\nOptions: ${optionList()}\n\n` +
      buildRows().map(([q, v]) => `${q}: ${v}`).join('\n') +
      `\n\nAnswered: ${c.answered} | Skipped: ${c.skipped}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    $('#dlgExport').close();
    toast('Copied to clipboard');
  });

  $('#btnPdf').addEventListener('click', () => {
    if (!window.jspdf) return toast('PDF library not loaded. Check your internet connection.');
    const doc = new window.jspdf.jsPDF();
    const rows = buildRows();
    const c = counts();
    const PER_COL = 40, COLS = 4, PER_PAGE = PER_COL * COLS;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Answer Sheet', 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Questions ${S.first} to ${endQ()}  |  Options: ${optionList()}  |  Answered: ${c.answered}  Skipped: ${c.skipped}`, 15, 25);

    doc.setFontSize(11);
    rows.forEach(([q, v], i) => {
      if (i > 0 && i % PER_PAGE === 0) { doc.addPage(); }
      const n = i % PER_PAGE;
      const col = Math.floor(n / PER_COL);
      const row = n % PER_COL;
      doc.text(`${q}: ${v}`, 15 + col * 47, 36 + row * 6.2);
    });
    doc.save(`answers_${S.first}-${endQ()}.pdf`);
    $('#dlgExport').close();
  });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (capturing) {
      e.preventDefault();
      if (e.code === 'Escape') { capturing = null; return renderKeys(); }
      Object.keys(keys).forEach((a) => { if (keys[a] === e.code) keys[a] = ''; });
      keys[capturing] = e.code;
      capturing = null;
      persist();
      return renderKeys();
    }
    if (!S || document.querySelector('dialog[open]')) return;
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const action = Object.keys(keys).find((a) => keys[a] === e.code);
    if (!action) return;
    e.preventDefault();
    if (action === 'skip') skip();
    else if (action === 'prev') go(S.current - 1);
    else if (action === 'next') go(S.current + 1);
    else { const i = parseInt(action.slice(1), 10); if (i < S.options) answer(i); }
  });

  /* ---------- theme ---------- */
  try { const t = localStorage.getItem('at_theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
  $('#btnTheme').addEventListener('click', () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('at_theme', next); } catch {}
  });

  render();
})();
