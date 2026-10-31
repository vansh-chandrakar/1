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
  let keys = Object.assign({}, DEFAULT_KEYS, load('zc_keys', {}));
  let S = load('zc_session', null);
  let filter = 'all';
  let capturing = null;

  if (S) {
    S.topic = S.topic || '';
    S.mode = S.mode || 'none';
    S.limit = S.limit || 0;
    S.elapsed = S.elapsed || 0;
    S.startedAt = S.startedAt || null;
    S.finished = !!S.finished;
    S.alerted = !!S.alerted;
  }

  const persist = () => {
    try {
      localStorage.setItem('zc_session', JSON.stringify(S));
      localStorage.setItem('zc_keys', JSON.stringify(keys));
    } catch {}
  };

  /* ---------- helpers ---------- */
  const label = (i) => S.style === 'letters' ? LETTERS[i] : S.style === 'roman' ? ROMAN[i] : String(i + 1);
  const lastQ = () => (S.count ? S.first + S.count - 1 : null);
  const maxSeen = () => Math.max(S.current, ...Object.keys(S.answers).map(Number));
  const endQ = () => (lastQ() !== null ? lastQ() : maxSeen());
  const valueText = (v) => (v === undefined ? 'Not answered' : v === 'skip' ? 'Skipped' : label(v));
  const optionList = () => Array.from({ length: S.options }, (_, i) => label(i)).join(', ');
  const counts = () => {
    const vals = Object.values(S.answers);
    const answered = vals.filter((v) => v !== 'skip').length;
    const skipped = vals.filter((v) => v === 'skip').length;
    const total = endQ() - S.first + 1;
    return { answered, skipped, notAnswered: Math.max(0, total - answered - skipped) };
  };
  const pretty = (code) => (code ? code.replace(/^Key|^Digit/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2') : 'Not set');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- clock ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  const elapsedMs = () => S.elapsed + (S.startedAt ? Date.now() - S.startedAt : 0);

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.15;
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.15);
      });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch {}
  }

  function updateClock() {
    const wrap = $('#clock');
    if (!S || S.mode === 'none' || S.finished) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    const ms = elapsedMs();
    let txt, over = false;
    if (S.mode === 'timer') {
      const rem = S.limit * 1000 - ms;
      over = rem <= 0;
      txt = over ? '+' + fmt(-rem / 1000) : fmt(Math.ceil(rem / 1000));
      if (over && S.startedAt && !S.alerted) { S.alerted = true; persist(); beep(); toast("Time's up"); }
    } else {
      txt = fmt(ms / 1000);
    }
    $('#clockTime').textContent = txt;
    wrap.classList.toggle('over', over);
    wrap.classList.toggle('paused', !S.startedAt);
    $('#btnClock').textContent = S.startedAt ? 'Pause' : 'Resume';
  }
  setInterval(updateClock, 250);

  $('#btnClock').addEventListener('click', () => {
    if (S.startedAt) { S.elapsed = elapsedMs(); S.startedAt = null; }
    else { S.startedAt = Date.now(); }
    persist();
    updateClock();
  });

  /* ---------- rendering ---------- */
  function render() {
    $('#setup').classList.toggle('hidden', !!S);
    $('#test').classList.toggle('hidden', !S || S.finished);
    $('#done').classList.toggle('hidden', !S || !S.finished);
    if (!S) return;
    if (S.finished) return renderDone();

    const c = counts();
    const total = lastQ() !== null ? ` / ${S.count}` : '';
    $('#topicLabel').textContent = S.topic;
    $('#topicLabel').classList.toggle('hidden', !S.topic);
    $('#progress').textContent = `Answered ${c.answered}${total} · Skipped ${c.skipped}`;
    $('#qNum').textContent = S.current;

    const v = S.answers[S.current];
    $('#qStatus').textContent = v === undefined ? 'Not answered yet' : v === 'skip' ? 'Skipped' : `Your answer: ${label(v)}`;

    const box = $('#options');
    box.innerHTML = '';
    for (let i = 0; i < S.options; i++) {
      const b = document.createElement('button');
      b.textContent = label(i);
      if (v === i) b.classList.add('selected');
      const hint = keys['o' + i];
      if (hint) {
        const k = document.createElement('span');
        k.className = 'kbd';
        k.textContent = pretty(hint).replace('Numpad', 'Num');
        b.appendChild(k);
      }
      b.addEventListener('click', () => answer(i));
      box.appendChild(b);
    }
    if (S.options % 2 === 1) box.lastChild.style.gridColumn = '1 / -1';
    updateClock();
  }

  function renderDone() {
    const c = counts();
    $('#stAnswered').textContent = c.answered;
    $('#stSkipped').textContent = c.skipped;
    $('#stNone').textContent = c.notAnswered;
    $('#doneTitle').textContent = S.topic || 'Test finished';
    const hasTime = S.mode !== 'none';
    $('#stTimeBox').classList.toggle('hidden', !hasTime);
    $('#timeOpt').classList.toggle('hidden', !hasTime);
    if (hasTime) {
      const used = fmt(S.elapsed / 1000);
      $('#stTime').textContent = S.mode === 'timer' ? `${used} / ${fmt(S.limit)}` : used;
    }
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
  $('#inTiming').addEventListener('change', (e) => {
    $('#minsWrap').classList.toggle('hidden', e.target.value !== 'timer');
  });

  $('#setupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = parseInt($('#inFirst').value, 10);
    const count = parseInt($('#inCount').value, 10);
    if (isNaN(first)) return;
    const mode = $('#inTiming').value;
    let limit = 0;
    if (mode === 'timer') {
      const m = parseFloat($('#inMinutes').value);
      if (!(m > 0)) return toast('Enter the timer minutes');
      limit = Math.round(m * 60);
    }
    S = {
      first,
      count: isNaN(count) ? null : count,
      options: parseInt($('#inOptions').value, 10),
      style: $('#inStyle').value,
      current: first,
      answers: {},
      topic: $('#inTopic').value.trim(),
      mode, limit,
      elapsed: 0,
      startedAt: mode === 'none' ? null : Date.now(),
      finished: false,
      alerted: false
    };
    persist();
    render();
  });

  document.querySelectorAll('.js-new').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Start a new session? Current answers will be cleared. Export first if you need them.')) return;
    S = null;
    try { localStorage.removeItem('zc_session'); } catch {}
    render();
  }));

  $('#btnSkip').addEventListener('click', skip);
  $('#btnPrev').addEventListener('click', () => go(S.current - 1));
  $('#btnNext').addEventListener('click', () => go(S.current + 1));

  /* ---------- finish ---------- */
  $('#btnFinish').addEventListener('click', () => {
    const c = counts();
    if (!confirm(`Finish the test?\n\nNot answered: ${c.notAnswered}\nSkipped: ${c.skipped}`)) return;
    if (S.startedAt) { S.elapsed = elapsedMs(); S.startedAt = null; }
    S.finished = true;
    persist();
    render();
  });
  $('#btnBack').addEventListener('click', () => {
    S.finished = false;
    if (S.mode !== 'none') S.startedAt = Date.now();
    persist();
    render();
  });

  /* ---------- dialogs ---------- */
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

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
    if (!S) return toast('Start a session first');
    if (S.finished) return toast('Go back to the test to browse questions');
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
  $('#dlgKeys').addEventListener('close', () => { capturing = null; if (S && !S.finished) render(); });
  $('#btnResetKeys').addEventListener('click', () => { keys = Object.assign({}, DEFAULT_KEYS); persist(); renderKeys(); });

  /* ---------- export ---------- */
  function buildRows() {
    const rows = [];
    for (let q = S.first; q <= endQ(); q++) rows.push([q, valueText(S.answers[q])]);
    return rows;
  }
  function timeLine() {
    if (S.mode === 'none' || !$('#chkTime').checked) return '';
    const used = fmt(S.elapsed / 1000);
    return S.mode === 'timer' ? `Time limit: ${fmt(S.limit)} | Time used: ${used}` : `Time taken: ${used}`;
  }
  function summaryLine() {
    const c = counts();
    return `Answered: ${c.answered} | Skipped: ${c.skipped}` + (c.notAnswered ? ` | Not answered: ${c.notAnswered}` : '');
  }

  $('#btnCopy').addEventListener('click', async () => {
    const tl = timeLine();
    const text =
      (S.topic ? `Topic: ${S.topic}\n` : '') +
      `Questions: ${S.first} to ${endQ()}\nOptions: ${optionList()}\n` +
      (tl ? tl + '\n' : '') + '\n' +
      buildRows().map(([q, v]) => `${q}: ${v}`).join('\n') +
      `\n\n${summaryLine()}`;
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
    toast('Copied to clipboard');
  });

  $('#btnPdf').addEventListener('click', () => {
    if (!window.jspdf) return toast('PDF library not loaded. Check your internet connection.');
    const doc = new window.jspdf.jsPDF();
    const rows = buildRows();
    const PER_COL = 40, COLS = 4, PER_PAGE = PER_COL * COLS;

    let y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Answer Sheet', 15, y);
    if (S.topic) {
      y += 8;
      doc.setFontSize(12);
      doc.text(S.topic, 15, y);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    y += 7;
    doc.text(`Questions ${S.first} to ${endQ()}  |  Options: ${optionList()}  |  ${summaryLine()}`, 15, y);
    const tl = timeLine();
    if (tl) { y += 5; doc.text(tl, 15, y); }
    doc.setTextColor(0);
    doc.setFontSize(11);
    const startY = y + 10;

    rows.forEach(([q, v], i) => {
      if (i > 0 && i % PER_PAGE === 0) doc.addPage();
      const page = Math.floor(i / PER_PAGE);
      const n = i % PER_PAGE;
      const col = Math.floor(n / PER_COL);
      const row = n % PER_COL;
      doc.text(`${q}: ${v}`, 15 + col * 47, (page === 0 ? startY : 20) + row * 6);
    });
    const safe = (S.topic || 'answers').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'answers';
    doc.save(`${safe}_${S.first}-${endQ()}.pdf`);
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
    if (!S || S.finished || document.querySelector('dialog[open]')) return;
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
  try { const t = localStorage.getItem('zc_theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
  $('#btnTheme').addEventListener('click', () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('zc_theme', next); } catch {}
  });

  render();
})();
