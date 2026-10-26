/* App shell: navigation, top bar, router, command palette, shortcuts, assistant. */
(function (E) {
  const { esc, icon, state } = E;
  E.views = E.views || {};

  const NAV = [
    { label: null, items: [{ view: 'companies', label: 'Công ty khách', icon: 'building' }] },
    { label: 'Nhập liệu', items: [
      { view: 'review', label: 'Duyệt đề xuất', icon: 'inbox', count: () => E.db().proposals.filter((p) => p.status === 'proposed' && E.periodOf(p.date) === state.period).length },
      { view: 'entry', label: 'Nhập chứng từ', icon: 'pencil' },
      { view: 'vouchers', label: 'Danh sách chứng từ', icon: 'file-text' },
    ] },
    { label: 'Hóa đơn & Ngân hàng', items: [
      { view: 'invoices', label: 'Hóa đơn điện tử', icon: 'receipt' },
      { view: 'bank', label: 'Import sao kê', icon: 'landmark' },
    ] },
    { label: 'Kho & Giá thành', show: (c) => E.hasModule(c, 'stock'), items: [
      { view: 'stock', label: 'Hàng hóa & kho', icon: 'warehouse' },
      { view: 'stockmove', label: 'Nhập xuất kho', icon: 'arrow-left-right' },
      { view: 'costing', label: 'Giá thành', icon: 'factory', show: (c) => E.hasModule(c, 'costing') },
    ] },
    { label: 'Lương & BHXH', items: [
      { view: 'staff', label: 'Nhân viên', icon: 'user' },
      { view: 'timesheet', label: 'Chấm công', icon: 'calendar-check' },
      { view: 'payroll', label: 'Bảng lương', icon: 'banknote' },
    ] },
    { label: 'Sổ sách & Báo cáo', items: [
      { view: 'ar', label: 'Công nợ', icon: 'merge' },
      { view: 'books', label: 'Sổ sách & CĐPS', icon: 'book-open' },
      { view: 'reports', label: 'BCTC & Thuế GTGT', icon: 'chart' },
    ] },
    { label: 'Cuối kỳ', items: [
      { view: 'assets', label: 'Tài sản & phân bổ', icon: 'package' },
      { view: 'checks', label: 'Kiểm tra chi phí', icon: 'shield', count: () => E.db().checks.filter((k) => k.status === 'open').length },
      { view: 'close', label: 'Chốt sổ tháng', icon: 'calendar-check' },
    ] },
    { label: 'Danh mục', items: [
      { view: 'accounts', label: 'Hệ thống tài khoản', icon: 'list-tree' },
      { view: 'cps', label: 'Đối tượng', icon: 'users' },
      { view: 'projects', label: 'Hợp đồng & công trình', icon: 'folder' },
      { view: 'vtypes', label: 'Loại chứng từ', icon: 'tag' },
      { view: 'opening', label: 'Số dư đầu kỳ', icon: 'clipboard' },
      { view: 'rules', label: 'Rule định khoản', icon: 'branch' },
      { view: 'settings', label: 'Cài đặt công ty', icon: 'sliders' },
    ] },
  ];
  /* Groups and items can depend on the company's industry; hidden views redirect instead of rendering. */
  const itemShown = (g, it) => { const c = E.company(); return (!g.show || g.show(c)) && (!it.show || it.show(c)); };
  const visibleNav = () => NAV.map((g) => ({ ...g, items: g.items.filter((it) => itemShown(g, it)) })).filter((g) => g.items.length);
  const allNav = () => visibleNav().flatMap((g) => g.items);
  const isHidden = (view) => NAV.some((g) => g.items.some((it) => it.view === view && !itemShown(g, it)));

  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const topbar = document.getElementById('topbar');
  const banner = document.getElementById('banner');
  const content = document.getElementById('content');
  let current = null;

  function renderNav() {
    nav.innerHTML = visibleNav().map((g) => `
      <div class="nav-group">${g.label ? `<span class="nav-label">${esc(g.label)}</span>` : ''}
        ${g.items.map((it) => {
          const n = it.count ? it.count() : 0;
          return `<button type="button" class="nav-item" data-go="${it.view}" ${state.route.view === it.view ? 'aria-current="page"' : ''}>${icon(it.icon)}<span class="od-fill od-truncate">${esc(it.label)}</span>${n ? `<span class="nav-count">${n}</span>` : ''}</button>`;
        }).join('')}
      </div>`).join('');
  }

  function renderTopbar() {
    const c = E.company();
    const locked = E.isLocked();
    topbar.innerHTML = `
      <button type="button" class="btn btn-ghost btn-icon menu-btn" data-act="menu" aria-label="Mở menu">${icon('menu')}</button>
      <button type="button" class="switcher" data-act="company" aria-label="Đổi công ty">
        ${icon('building')}
        <span class="switcher-text"><span class="switcher-title od-truncate">${esc(c.name)}</span><span class="switcher-sub mono">MST ${esc(c.mst)} · ${esc(c.regime)}</span></span>
        ${icon('chevron-down')}
      </button>
      <button type="button" class="switcher period-switch" data-act="period" aria-label="Đổi kỳ kế toán">
        ${icon(locked ? 'lock' : 'calendar-check')}
        <span class="switcher-text"><span class="switcher-title mono">Kỳ ${E.periodLabel(state.period)}</span><span class="switcher-sub">${locked ? 'Đã khóa' : 'Đang mở'}</span></span>
        ${icon('chevron-down')}
      </button>
      <button type="button" class="cmdk-trigger" data-act="cmdk">${icon('search')}<span class="cmdk-label">Tìm màn hình, công ty, lệnh…</span><kbd>Ctrl K</kbd></button>
      <button type="button" class="btn btn-outline" data-act="assistant">${icon('sparkles')}<span class="hide-sm">Trợ lý</span></button>
      <button type="button" class="btn btn-ghost btn-icon hide-sm" data-act="keys" aria-label="Phím tắt">${icon('keyboard')}</button>
      <button type="button" class="avatar avatar-btn" data-act="user" title="${esc(state.user.name)} · ${state.user.role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}. Bấm để đổi người dùng" aria-label="Đổi người dùng">${esc(state.user.initials)}</button>`;
    const box = document.getElementById('userbox');
    if (box) box.innerHTML = `<span class="avatar" aria-hidden="true">${esc(state.user.initials)}</span><span class="od-fill od-stack" style="--od-gap:0"><span class="strong od-truncate">${esc(state.user.name)}</span><span class="muted" style="font-size:12px">${state.user.role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}${state.user.payroll ? ' · quyền lương' : ''}</span></span>`;
  }

  function renderBanner() {
    const c = E.company();
    if (state.route.view === 'companies') { banner.hidden = true; return; }
    if (c.readonly) {
      banner.hidden = false; banner.className = 'banner is-danger';
      banner.innerHTML = `${icon('lock')}<span>Khách đã ngừng dịch vụ. Công ty ở chế độ chỉ đọc: xem và xuất sổ được, không ghi hay sửa.</span>`;
    } else if (E.isLocked()) {
      const p = E.db().periods[state.period];
      banner.hidden = false; banner.className = 'banner';
      banner.innerHTML = `${icon('lock')}<span class="od-fill">Kỳ ${E.periodLabel(state.period)} đã khóa bởi ${esc(p.lockedBy)}. Muốn sửa số liệu phải mở khóa kỳ kèm lý do.</span><button type="button" class="btn btn-outline" data-go="close">Đến Chốt sổ</button>`;
    } else banner.hidden = true;
  }

  function go(view, params = {}) {
    if (!E.views[view]) view = 'companies';
    if (isHidden(view)) { E.toast('Màn hình không áp dụng cho ngành này', { text: `Ngành ${E.company().industry} không dùng ${(NAV.flatMap((g) => g.items).find((n) => n.view === view) || {}).label}.`, icon: 'info' }); view = 'review'; }
    state.route = { view, params };
    app.classList.remove('nav-open');
    renderNav(); renderTopbar(); renderBanner();
    const v = E.views[view];
    current = v;
    content.className = `content${v.flush ? ' is-flush' : ''}`;
    const host = document.createElement('div');
    host.className = 'view';
    if (v.flush) host.style.height = '100%';
    host.innerHTML = v.render(params);
    content.replaceChildren(host);
    content.scrollTop = 0;
    const title = (allNav().find((n) => n.view === view) || {}).label || 'Sổ cái';
    document.title = `${title} · EYN Sổ cái`;
    try { history.replaceState(null, '', `#${view}`); } catch (_) { /* sandboxed preview */ }
    if (v.mount) v.mount(host, params);
  }
  /* Re-render the current view in place (after a state change) without moving the user. */
  function refresh(params) {
    const top = content.scrollTop;
    go(state.route.view, params || state.route.params);
    content.scrollTop = top;
  }
  E.go = go;
  E.refresh = refresh;
  E.refreshChrome = () => { renderNav(); renderTopbar(); renderBanner(); };
  E.isViewHidden = isHidden;
  E.canWrite = () => !E.isReadonly() && !E.isLocked();

  function switchCompany(id) {
    state.companyId = id;
    state.period = '2027-01';
    const v = state.route.view === 'companies' ? 'review' : state.route.view;
    go(v);
    E.toast(`Đang làm việc với ${E.company().name}`, { icon: 'building' });
  }
  E.switchCompany = switchCompany;

  /* ---------- Period popover ---------- */
  function openPeriodMenu(anchor) {
    const periods = Object.keys(E.db().periods).sort().reverse();
    E.openDialog({
      eyebrow: E.company().name, title: 'Chọn kỳ kế toán',
      body: `<div class="od-stack" role="listbox">${periods.map((p) => {
        const info = E.db().periods[p];
        return `<button type="button" class="nav-item" data-period="${p}" ${p === state.period ? 'aria-current="page"' : ''}>${icon(info.locked ? 'lock' : 'calendar-check')}<span class="od-fill mono">Kỳ ${E.periodLabel(p)}</span>${E.badge(info.locked ? 'neutral' : 'success', info.locked ? 'Đã khóa' : 'Đang mở')}</button>`;
      }).join('')}</div><p class="help">Kỳ sau chỉ mở khi kỳ trước đã khóa. Kỳ 02/2027 sẽ xuất hiện sau khi khóa kỳ 01/2027.</p>`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
      onMount(api) {
        api.el.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { state.period = b.dataset.period; api.close(); refresh({}); }));
      },
      initialFocus: '[aria-current="page"]',
    });
  }

  /* ---------- Command palette ---------- */
  const cmdk = document.getElementById('cmdk');
  function commands() {
    const list = [];
    allNav().forEach((n) => list.push({ group: 'Màn hình', label: n.label, icon: n.icon, run: () => go(n.view) }));
    [['PC', 'Phiếu chi mới'], ['PT', 'Phiếu thu mới'], ['UNC', 'Ủy nhiệm chi mới'], ['PKT', 'Phiếu kế toán mới']].forEach(([t, l]) => list.push({ group: 'Lệnh', label: l, icon: 'plus', kbd: t === 'PC' ? 'Alt N' : '', run: () => go('entry', { type: t }) }));
    list.push({ group: 'Lệnh', label: 'Import sao kê ngân hàng', icon: 'upload', run: () => go('bank') });
    list.push({ group: 'Lệnh', label: 'Đồng bộ hóa đơn điện tử', icon: 'refresh', run: () => go('invoices', { sync: true }) });
    list.push({ group: 'Lệnh', label: 'Mở bảng cân đối phát sinh', icon: 'scale', run: () => go('books', { tab: 'tb' }) });
    list.push({ group: 'Lệnh', label: 'Hỏi Trợ lý', icon: 'sparkles', run: () => openAssistant() });
    state.companies.forEach((c) => list.push({ group: 'Công ty', label: c.name, sub: `MST ${c.mst}`, icon: 'building', run: () => switchCompany(c.id) }));
    return list;
  }
  function openCmdk(query = '') {
    const all = commands();
    let idx = 0; let shown = [];
    cmdk.innerHTML = `
      <div class="cmdk-input">${icon('search')}<input type="text" placeholder="Gõ tên màn hình, công ty hoặc MST (không cần dấu)" aria-label="Tìm kiếm" value="${esc(query)}"><kbd>Esc</kbd></div>
      <div class="cmdk-list" role="listbox"></div>
      <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> chọn</span><span><kbd>Enter</kbd> mở</span><span><kbd>Esc</kbd> đóng</span></div>`;
    const input = cmdk.querySelector('input');
    const listEl = cmdk.querySelector('.cmdk-list');
    const draw = () => {
      const q = input.value;
      shown = all.filter((c) => !q || E.matches(`${c.label} ${c.sub || ''}`, q)).slice(0, 40);
      idx = Math.min(idx, Math.max(shown.length - 1, 0));
      let g = '';
      listEl.innerHTML = shown.length ? shown.map((c, i) => {
        const head = c.group !== g ? `<div class="cmdk-group">${esc((g = c.group))}</div>` : '';
        return `${head}<div class="cmdk-item" role="option" data-i="${i}" aria-selected="${i === idx}">${icon(c.icon)}<span class="od-fill od-truncate">${esc(c.label)}</span>${c.sub ? `<span class="mono muted">${esc(c.sub)}</span>` : ''}${c.kbd ? `<kbd>${c.kbd}</kbd>` : ''}</div>`;
      }).join('') : '<div class="empty"><span class="empty-title">Không tìm thấy</span><span class="empty-text">Thử gõ MST, mã TK hoặc tên màn hình.</span></div>';
      const sel = listEl.querySelector('[aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest' });
    };
    const run = (i) => { const c = shown[i]; if (!c) return; cmdk.close(); c.run(); };
    input.addEventListener('input', () => { idx = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, shown.length - 1); draw(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); draw(); }
      if (e.key === 'Enter') { e.preventDefault(); run(idx); }
    });
    listEl.addEventListener('click', (e) => { const it = e.target.closest('.cmdk-item'); if (it) run(Number(it.dataset.i)); });
    draw();
    cmdk.showModal();
    input.focus();
  }
  E.openCmdk = openCmdk;

  /* ---------- Switch user (CRM sync is mocked): payroll screens and payroll approvals depend on the payroll right ---------- */
  function openUserMenu() {
    E.openDialog({
      eyebrow: 'Phiên làm việc', title: 'Đổi người dùng',
      body: `<div class="od-stack" role="listbox">${state.users.map((u, i) => `<button type="button" class="nav-item" data-user="${i}" ${u.name === state.user.name ? 'aria-current="page"' : ''}><span class="avatar" aria-hidden="true">${esc(u.initials)}</span><span class="od-fill od-truncate">${esc(u.name)}</span>${E.badge(u.role === 'ADMIN' ? 'brand' : '', u.role)}${u.payroll ? E.badge('success', 'Có quyền lương') : E.badge('', 'Không có quyền lương')}</button>`).join('')}</div><p class="help">Quyền lương quyết định xem được Nhân viên, Chấm công, Bảng lương và duyệt được đề xuất lương.</p>`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
      onMount(api) {
        api.el.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => { E.setUser(Number(b.dataset.user)); api.close(); E.refreshChrome(); refresh(); E.toast(`Đang đăng nhập với ${state.user.name}`, { icon: 'user' }); }));
      },
      initialFocus: '[aria-current="page"]',
    });
  }

  /* ---------- Shortcuts help ---------- */
  function openKeys() {
    const rows = [
      ['Chung', [['Ctrl K', 'Tìm màn hình, công ty, lệnh'], ['Alt N', 'Phiếu chi mới'], ['Alt 1 · 2 · 3 · 4', 'Duyệt · Nhập · Sổ sách · Chốt sổ'], ['F7', 'Đến ô lọc/tìm của màn đang mở'], ['?', 'Mở bảng này']]],
      ['Nhập chứng từ', [['Enter / Tab', 'Sang ô kế tiếp, cuối dòng thì thêm dòng'], ['↑ ↓', 'Chọn gợi ý tài khoản, đối tượng'], ['Ctrl S / F10', 'Lưu chứng từ'], ['F12', 'Sửa chứng từ đã ghi'], ['F5', 'Sao chép dòng đang đứng'], ['Esc', 'Đóng gợi ý']]],
      ['Chấm công', [['← ↑ ↓ →', 'Di chuyển giữa các ô'], ['X P L O K N', 'Gõ mã công (X+2 là đi làm và OT 2 giờ)'], ['Enter', 'Xuống hàng kế'], ['Delete', 'Xóa ô']]],
      ['Duyệt đề xuất', [['↑ ↓', 'Chuyển đề xuất'], ['Space', 'Chọn / bỏ chọn'], ['Enter', 'Sửa đề xuất'], ['Ctrl Enter', 'Duyệt các đề xuất đã chọn'], ['Ctrl Shift R', 'Từ chối (bắt buộc lý do)']]],
    ];
    E.openDialog({
      eyebrow: 'Làm việc không cần chuột', title: 'Phím tắt', size: 'lg',
      body: `<div class="od-grid" style="--od-cols:3">${rows.map(([g, ks]) => `<div class="od-stack"><span class="label">${esc(g)}</span>${ks.map(([k, t]) => `<div class="od-row"><span class="od-fill">${esc(t)}</span><kbd>${esc(k)}</kbd></div>`).join('')}</div>`).join('')}</div>`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
    });
  }

  /* ---------- Assistant ---------- */
  const drawer = document.getElementById('assistant');
  const chats = {};
  const SUGGEST = ['Có hóa đơn mua vào nào chưa ghi sổ không?', 'Khách nào còn nợ quá 60 ngày?', 'Chi phí quản lý 6422 tháng này gồm những gì?', 'Tiền gửi ngân hàng cuối kỳ còn bao nhiêu?'];
  const link = (label, view, params = {}) => `<button type="button" class="msg-link" data-go="${view}" data-params='${esc(JSON.stringify(params))}'>${esc(label)}</button>`;

  function answer(q) {
    const d = E.db();
    const f = E.fold(q);
    if (!d.aiEnabled) return `<p>AI bên ngoài đang tắt cho khách này nên Trợ lý không trả lời được.</p><p>${link('Mở Cài đặt công ty', 'settings')} để bật lại nếu khách đã đồng ý.</p>`;
    if (f.includes('hoa don') && (f.includes('chua') || f.includes('ghi so'))) {
      const list = d.invoices.filter((i) => i.dir === 'in' && i.status === 'valid' && !i.ignored && E.invoiceStatus(i) !== 'posted');
      if (!list.length) return '<p>Mọi hóa đơn mua vào hợp lệ trong kỳ đã ghi sổ.</p>';
      return `<p>Có <b>${list.length}</b> hóa đơn mua vào hợp lệ chưa ghi sổ trong kỳ ${E.periodLabel(state.period)}:</p><ul>${list.map((i) => `<li><span class="mono">${esc(i.no)}</span> · ${esc(E.cpName(i.party))} · <span class="mono">${E.money(i.total)}</span> đ (${E.invoiceStatus(i) === 'proposed' ? 'đang chờ duyệt' : 'chưa xử lý'})</li>`).join('')}</ul><p>${link('Mở màn Duyệt, lọc HĐ mua vào', 'review', { source: 'in' })}</p>`;
    }
    if (f.includes('no') && (f.includes('60') || f.includes('qua han') || f.includes('tuoi'))) {
      const today = '2027-01-31';
      const days = (dt) => Math.round((new Date(today) - new Date(dt)) / 86400000);
      const list = d.items.filter((i) => i.acc === '131' && i.side === 'D' && i.remaining > 0 && days(i.date) > 60);
      if (!list.length) return '<p>Không có khoản phải thu nào quá 60 ngày.</p>';
      return `<p>Các hóa đơn phải thu quá 60 ngày (tính đến 31/01/2027):</p><ul>${list.map((i) => `<li>${esc(E.cpName(i.cp))}: ${esc(i.ref)}, <span class="mono">${E.money(i.remaining)}</span> đ, ${days(i.date)} ngày</li>`).join('')}</ul><p>${link('Mở Công nợ TK 131', 'ar', { acc: '131' })}</p>`;
    }
    if (f.includes('6422') || f.includes('chi phi')) {
      const l = E.ledger('6422');
      const total = l.rows.reduce((s, r) => s + r.d - r.c, 0);
      return `<p>TK 6422 kỳ ${E.periodLabel(state.period)} phát sinh <b class="mono">${E.money(total)}</b> đ từ ${l.rows.length} bút toán đã ghi sổ:</p><ul>${l.rows.map((r) => `<li><span class="mono">${esc(r.e.no)}</span> ${esc(r.e.desc)}: <span class="mono">${E.money(r.d - r.c)}</span> đ</li>`).join('')}</ul><p>Các đề xuất chưa duyệt chưa được tính. ${link('Mở sổ chi tiết 6422', 'books', { tab: 'detail', acc: '6422' })}</p>`;
    }
    if (f.includes('tien gui') || f.includes('ngan hang') || f.includes('112')) {
      return `<p>Số dư cuối kỳ tiền gửi ngân hàng (đã ghi sổ):</p><ul><li>11211 Vietcombank: <span class="mono">${E.money(E.net('11211'))}</span> đ</li><li>11212 Techcombank: <span class="mono">${E.money(E.net('11212'))}</span> đ</li></ul><p>${link('Mở sổ tiền gửi 112', 'books', { tab: 'detail', acc: '112' })}</p>`;
    }
    return '<p>Trợ lý chỉ đọc số liệu sổ của công ty đang mở và chưa hiểu câu này.</p><p>Thử hỏi về hóa đơn chưa ghi sổ, công nợ quá hạn, chi phí theo tài khoản hoặc số dư tiền.</p>';
  }

  function drawChat() {
    const id = state.companyId;
    const msgs = chats[id] || [];
    const body = drawer.querySelector('.drawer-body');
    body.innerHTML = `${msgs.length ? '' : `<div class="msg msg-bot"><p>Mình đọc sổ của <b>${esc(E.company().name)}</b> và trả lời có dẫn chứng từ. Trợ lý chỉ đọc, không ghi sổ.</p></div>`}
      ${msgs.map((m) => `<div class="msg ${m.who === 'user' ? 'msg-user' : 'msg-bot'}">${m.who === 'user' ? esc(m.text) : m.html}</div>`).join('')}
      ${msgs.length ? '' : `<div class="od-stack">${SUGGEST.map((s) => `<button type="button" class="chip" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}`;
    body.scrollTop = body.scrollHeight;
  }
  function ask(text) {
    if (!text.trim()) return;
    const id = state.companyId;
    chats[id] = chats[id] || [];
    chats[id].push({ who: 'user', text });
    chats[id].push({ who: 'bot', html: '<p class="muted">Đang đọc sổ…</p>' });
    drawChat();
    setTimeout(() => { chats[id][chats[id].length - 1] = { who: 'bot', html: answer(text) }; drawChat(); }, 450);
  }
  function openAssistant() {
    drawer.hidden = false;
    drawer.querySelector('.drawer-title').textContent = 'Trợ lý hỏi đáp';
    drawChat();
    drawer.querySelector('textarea').focus();
  }
  function closeAssistant() { drawer.hidden = true; const b = topbar.querySelector('[data-act="assistant"]'); if (b) b.focus(); }
  drawer.innerHTML = `
    <div class="drawer-head">${icon('sparkles')}<span class="od-fill"><span class="card-title drawer-title">Trợ lý hỏi đáp</span></span><button type="button" class="btn btn-ghost btn-icon" data-act="close-assistant" aria-label="Đóng trợ lý">${icon('x')}</button></div>
    <div class="drawer-body" aria-live="polite"></div>
    <div class="drawer-foot"><div class="od-row"><label class="sr-only" for="ask">Câu hỏi</label><textarea id="ask" class="textarea od-fill" rows="2" style="min-height:44px" placeholder="Hỏi về số liệu sổ, ví dụ: chi phí 6422 tháng này?"></textarea><button type="button" class="btn btn-icon btn-lg" data-act="send" aria-label="Gửi">${icon('send')}</button></div><p class="help" style="margin-top:6px">Enter để gửi · Shift Enter xuống dòng</p></div>`;
  drawer.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ask],[data-act],[data-go]');
    if (!t) return;
    if (t.dataset.ask) ask(t.dataset.ask);
    if (t.dataset.act === 'close-assistant') closeAssistant();
    if (t.dataset.act === 'send') { const ta = drawer.querySelector('textarea'); ask(ta.value); ta.value = ''; }
    if (t.dataset.go) go(t.dataset.go, t.dataset.params ? JSON.parse(t.dataset.params) : {});
  });
  drawer.querySelector('textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(e.target.value); e.target.value = ''; }
    if (e.key === 'Escape') closeAssistant();
  });
  E.openAssistant = openAssistant;

  /* ---------- Global events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-act]');
    if (!t || drawer.contains(t) || cmdk.contains(t)) return;
    if (t.closest('#dlg') && !t.dataset.go) return;
    if (t.dataset.go) {
      if (t.closest('#dlg')) document.getElementById('dlg').close();
      go(t.dataset.go, t.dataset.params ? JSON.parse(t.dataset.params) : {});
      return;
    }
    const a = t.dataset.act;
    if (a === 'menu') app.classList.toggle('nav-open');
    if (a === 'scrim') app.classList.remove('nav-open');
    if (a === 'company') openCmdk('');
    if (a === 'period') openPeriodMenu(t);
    if (a === 'cmdk') openCmdk();
    if (a === 'assistant') (drawer.hidden ? openAssistant() : closeAssistant());
    if (a === 'keys') openKeys();
    if (a === 'user') openUserMenu();
  });

  const inField = (el) => el && (el.matches('input, textarea, select') || el.isContentEditable);
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
    if (document.querySelector('dialog[open]')) return;
    if (e.altKey && !mod && /^[1-4n]$/i.test(e.key) || (e.altKey && /^(Digit[1-4]|KeyN)$/.test(e.code))) {
      e.preventDefault();
      const map = { Digit1: 'review', Digit2: 'entry', Digit3: 'books', Digit4: 'close' };
      if (e.code === 'KeyN') go('entry', { type: 'PC' }); else if (map[e.code]) go(map[e.code]);
      return;
    }
    if (e.key === 'F7') {
      const s = content.querySelector('[data-search]');
      if (s) { e.preventDefault(); s.focus(); s.select && s.select(); return; }
    }
    if (e.key === '?' && !inField(e.target)) { e.preventDefault(); openKeys(); return; }
    if (e.key === 'Escape' && !drawer.hidden && drawer.contains(e.target)) { closeAssistant(); return; }
    if (current && current.onKey) current.onKey(e);
  });

  const scrim = document.createElement('div');
  scrim.className = 'scrim'; scrim.dataset.act = 'scrim';
  const obs = new MutationObserver(() => { if (app.classList.contains('nav-open')) app.appendChild(scrim); else scrim.remove(); });
  obs.observe(app, { attributes: true, attributeFilter: ['class'] });

  E.start = () => {
    let first = 'companies';
    try { const h = location.hash.slice(1); if (E.views[h]) first = h; } catch (_) { /* ignore */ }
    go(first);
  };
})(window.EYN);
