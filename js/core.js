/* Core helpers: formatting, escaping, Lucide icons, toasts, dialogs, autocomplete. */
window.EYN = window.EYN || {};
(function (E) {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const matches = (hay, query) => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const h = fold(hay);
    return words.every((w) => h.includes(w));
  };
  const money = (n) => (n == null || n === '' ? '' : Math.round(n).toLocaleString('vi-VN'));
  const moneyOrDash = (n) => (!n ? '–' : money(n));
  const signed = (n) => (n < 0 ? `(${money(-n)})` : money(n));
  const parseMoney = (s) => {
    const n = Number(String(s ?? '').replace(/[^\d-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const periodLabel = (p) => `${p.slice(5, 7)}/${p.slice(0, 4)}`;
  const uid = (() => { let i = 1000; return (p = 'id') => `${p}${++i}`; })();

  /* Lucide icon set (stroke icons, 24 viewBox) */
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'lock-open': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'calendar-check': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    'list-tree': '<path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'circle-alert': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'circle-x': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    'circle-minus': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    link: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
    merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    branch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    'file-check': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    'search-check': '<path d="m8 11 2 2 4-4"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
    factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    'arrow-left-right': '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  };
  const icon = (name, extra = '') =>
    `<svg class="od-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;

  const badge = (tone, text, ic) => `<span class="badge${tone ? ' badge-' + tone : ''}">${ic ? icon(ic) : ''}${esc(text)}</span>`;

  /* Toasts */
  function toast(title, opts = {}) {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast${opts.error ? ' is-error' : ''}`;
    el.setAttribute('role', opts.error ? 'alert' : 'status');
    el.innerHTML = `${icon(opts.icon || (opts.error ? 'circle-alert' : 'circle-check'))}
      <div class="toast-body"><span class="toast-title">${esc(title)}</span>${opts.text ? `<span class="toast-text">${esc(opts.text)}</span>` : ''}</div>
      ${opts.action ? `<button type="button" class="toast-action">${esc(opts.action.label)}</button>` : ''}`;
    const close = () => { el.classList.add('is-out'); setTimeout(() => el.remove(), 170); };
    if (opts.action) el.querySelector('.toast-action').addEventListener('click', () => { opts.action.run(); close(); });
    host.appendChild(el);
    setTimeout(close, opts.duration || (opts.action ? 7000 : 3600));
  }

  /* Dialogs: one reusable <dialog>, rebuilt per open. Returns focus to the opener on close. */
  function openDialog({ eyebrow, title, body, size, actions = [], onMount, initialFocus }) {
    const dlg = document.getElementById('dlg');
    const opener = document.activeElement;
    dlg.className = `dlg${size === 'lg' ? ' is-lg' : ''}`;
    dlg.innerHTML = `
      <div class="dlg-head">${eyebrow ? `<span class="dlg-eyebrow">${esc(eyebrow)}</span>` : ''}<h3 class="dlg-title" id="dlg-title">${esc(title)}</h3></div>
      <div class="dlg-body">${body}</div>
      <div class="dlg-foot">${actions.map((a, i) => (a.spacer ? '<span class="spacer"></span>' : `<button type="button" class="btn ${a.variant || ''}" data-i="${i}">${a.icon ? icon(a.icon) : ''}${esc(a.label)}${a.kbd ? ` <kbd>${a.kbd}</kbd>` : ''}</button>`)).join('')}</div>`;
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    const api = {
      el: dlg,
      close() {
        if (dlg.open) dlg.close();
      },
    };
    dlg.querySelectorAll('.dlg-foot [data-i]').forEach((b) => {
      const a = actions[Number(b.dataset.i)];
      b.addEventListener('click', () => {
        const keep = a.run ? a.run(api) : undefined;
        if (keep !== false) api.close();
      });
    });
    dlg.onclose = () => {
      const target = api.returnFocus || (opener && opener.isConnected ? opener : document.querySelector('[data-primary-action]'));
      if (target && target.focus) target.focus();
    };
    dlg.showModal();
    if (onMount) onMount(api);
    const f = initialFocus ? dlg.querySelector(initialFocus) : dlg.querySelector('input, select, textarea, .dlg-foot .btn:last-child');
    if (f) requestAnimationFrame(() => f.focus());
    return api;
  }

  function confirmDialog({ title, text, confirmLabel = 'Xác nhận', danger, onConfirm, eyebrow }) {
    return openDialog({
      eyebrow, title,
      body: `<p class="muted">${esc(text)}</p>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: confirmLabel, variant: danger ? 'btn-danger' : '', run: onConfirm }],
    });
  }

  /* Autocomplete popover bound to an input. items(q) -> [{value, code, name, meta}] */
  function autocomplete(input, { items, onPick, minWidth }) {
    let pop = null; let list = []; let idx = 0;
    const close = () => { if (pop) { pop.remove(); pop = null; } input.setAttribute('aria-expanded', 'false'); };
    const render = () => {
      if (!pop) {
        pop = document.createElement('div');
        pop.className = 'pop';
        pop.setAttribute('role', 'listbox');
        document.body.appendChild(pop);
        pop.addEventListener('mousedown', (e) => {
          const it = e.target.closest('.pop-item');
          if (!it) return;
          e.preventDefault();
          pick(Number(it.dataset.i));
        });
      }
      const r = input.getBoundingClientRect();
      pop.style.left = `${Math.min(r.left, window.innerWidth - Math.max(r.width, minWidth || 300) - 8)}px`;
      pop.style.width = `${Math.max(r.width, minWidth || 300)}px`;
      const below = window.innerHeight - r.bottom > 220;
      pop.style.top = below ? `${r.bottom + 4}px` : '';
      pop.style.bottom = below ? '' : `${window.innerHeight - r.top + 4}px`;
      pop.innerHTML = list.length
        ? list.map((it, i) => `<div class="pop-item" role="option" data-i="${i}" aria-selected="${i === idx}"><span class="pop-code">${esc(it.code)}</span><span class="pop-name od-truncate">${esc(it.name)}</span>${it.meta ? `<span class="pop-meta">${esc(it.meta)}</span>` : ''}</div>`).join('')
        : '<div class="pop-empty">Không có kết quả. Thử gõ mã hoặc tên khác.</div>';
      const sel = pop.querySelector('[aria-selected="true"]');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-expanded', 'true');
    };
    const pick = (i) => { const it = list[i]; if (!it) return; close(); onPick(it); };
    const refresh = () => { list = items(input.value).slice(0, 30); idx = 0; render(); };
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.addEventListener('input', refresh);
    input.addEventListener('focus', () => { if (input.dataset.acOnFocus !== 'false') refresh(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (e) => {
      if (!pop) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, list.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); render(); }
      else if ((e.key === 'Enter' || e.key === 'Tab') && list.length && input.value.trim()) {
        const exact = list.find((l) => l.code === input.value.trim());
        if (exact && e.key === 'Tab') { close(); onPick(exact); return; }
        e.preventDefault(); e.stopPropagation(); pick(idx); E.afterPick && E.afterPick(input, e);
      } else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    return { close };
  }

  /* Real file download (UTF-8 BOM so Excel reads Vietnamese) and print, shared by every report. */
  function downloadCsv(name, rows) {
    const cell = (v) => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const blob = new Blob([`\ufeff${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Đã tạo file', { text: name, icon: 'download' });
  }
  const tableRows = (table) => [...table.querySelectorAll('tr')].filter((tr) => !tr.hidden).map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
  function printPage(title) {
    const prev = document.title;
    document.title = title;
    try { window.print(); } catch (_) { toast('Trình duyệt chặn lệnh in', { error: true }); }
    document.title = prev;
  }

  /* Print an HTML fragment instead of the live screen (dense grids, dialogs). */
  function printHtml(title, html) {
    let host = document.getElementById('print-area');
    if (!host) { host = document.createElement('div'); host.id = 'print-area'; document.body.appendChild(host); }
    host.innerHTML = html;
    document.body.classList.add('print-area-on');
    printPage(title);
    document.body.classList.remove('print-area-on');
    host.innerHTML = '';
  }

  Object.assign(E, { downloadCsv, tableRows, printPage, printHtml, esc, fold, matches, money, moneyOrDash, signed, parseMoney, dmy, periodLabel, uid, icon, badge, toast, openDialog, confirmDialog, autocomplete });
})(window.EYN);
