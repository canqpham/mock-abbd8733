/* Master data views: chart of accounts, counterparties, posting rules, company settings. */
(function (E) {
  const { esc, icon, badge, money, dmy, state } = E;

  if (!document.getElementById('views-master-style')) {
    const st = document.createElement('style');
    st.id = 'views-master-style';
    st.textContent = `
      .vm-two { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
      .vm-rule { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; padding: 12px 20px; border-bottom: 1px solid var(--ink-100); cursor: pointer; }
      .vm-rule:hover { background: var(--ink-50); }
      .vm-rule.is-active { background: var(--brand-50); box-shadow: inset 0 0 0 1px var(--brand-300); }
      .vm-rule.is-off .vm-rule-name { color: var(--ink-500); }
      .vm-rule-name { display: block; font-weight: 600; color: var(--ink-900); }
      .vm-rule-cond { display: block; font-size: 12px; color: var(--ink-500); }
      .vm-tier { padding: 10px 20px 6px; font-size: 12px; font-weight: 600; color: var(--ink-500); background: var(--ink-50); border-bottom: 1px solid var(--ink-100); }
      .vm-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .vm-code { display: inline-block; }
      .vm-inactive td { color: var(--ink-400); }
      @media (max-width: 1100px) { .vm-two { grid-template-columns: minmax(0, 1fr); } }
    `;
    document.head.appendChild(st);
  }

  const SIDE = { D: 'Dư Nợ', C: 'Dư Có', B: 'Lưỡng tính' };
  const readonlyToast = () => E.toast('Công ty đang ở chế độ chỉ đọc', { error: true, text: 'Không sửa được danh mục.' });
  const fieldErr = (input, msg) => {
    const box = input.closest('.field');
    let el = box.querySelector('.field-error');
    if (!el) { el = document.createElement('span'); el.className = 'field-error'; box.appendChild(el); }
    el.textContent = msg || '';
    el.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };

  /* =============== Hệ thống tài khoản =============== */
  const collapsed = new Set();
  let accQuery = '';

  E.views.accounts = {
    render() {
      const d = E.db();
      const c = E.company();
      const tb = E.trialBalance(state.period, 'detail');
      const bal = Object.fromEntries(tb.map((r) => [r.code, r]));
      const depth = (a) => { let n = 0; let p = a.parent; while (p) { n++; p = (E.acc(p) || {}).parent; } return n; };
      const hasKids = (a) => d.accounts.some((x) => x.parent === a.code);
      const hiddenByParent = (a) => { let p = a.parent; while (p) { if (collapsed.has(p)) return true; p = (E.acc(p) || {}).parent; } return false; };

      let list;
      if (accQuery) {
        const hits = new Set();
        d.accounts.forEach((a) => {
          if (!E.matches(`${a.code} ${a.name}`, accQuery)) return;
          hits.add(a.code);
          let p = a.parent; while (p) { hits.add(p); p = (E.acc(p) || {}).parent; }
        });
        list = d.accounts.filter((a) => hits.has(a.code));
      } else list = d.accounts.filter((a) => !hiddenByParent(a));

      const rows = list.map((a) => {
        const dp = depth(a);
        const kids = hasKids(a);
        const b = bal[a.code];
        const balTxt = b && (b.endD || b.endC)
          ? `${b.endD ? `<span class="od-truncate">Nợ ${money(b.endD)}</span>` : ''}${b.endC ? `<span class="od-truncate">Có ${money(b.endC)}</span>` : ''}`
          : '<span class="faint">–</span>';
        return `<tr class="${a.active ? '' : 'vm-inactive'}">
          <td class="is-tight"><span class="mono vm-code" style="padding-left:${dp * 18}px">${kids && !accQuery
            ? `<button type="button" class="tree-toggle" data-a="toggle" data-code="${esc(a.code)}" aria-expanded="${!collapsed.has(a.code)}" aria-label="${collapsed.has(a.code) ? 'Mở' : 'Thu gọn'} ${esc(a.code)}">${icon('chevron-right')}</button>`
            : '<span class="tree-spacer"></span>'} <span class="${a.postable ? '' : 'strong'}">${esc(a.code)}</span></span></td>
          <td><span class="${a.postable ? '' : 'strong'}">${esc(a.name)}</span></td>
          <td class="is-tight">${SIDE[a.side]}</td>
          <td class="is-tight">${a.cp ? `<span class="text-success" title="Bắt buộc chọn đối tượng">${icon('check')}<span class="sr-only">Có</span></span>` : '<span class="faint">–</span>'}</td>
          <td class="is-tight">${a.postable ? badge('', 'Chi tiết') : badge('', 'Tổng hợp')}</td>
          <td class="num"><span class="od-stack" style="--od-gap:0">${balTxt}</span></td>
          <td class="is-tight">${a.active ? badge('success', 'Đang dùng') : badge('', 'Ngừng dùng')}</td>
          <td class="is-tight">${a.postable ? `<button type="button" class="btn btn-ghost" data-a="active" data-code="${esc(a.code)}">${a.active ? 'Ngừng dùng' : 'Dùng lại'}</button>` : ''}</td>
        </tr>`;
      }).join('');

      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Hệ thống tài khoản</h1>
            <span class="page-sub">Theo ${esc(c.regime)} · ${d.accounts.length} tài khoản · ${d.accounts.filter((a) => a.postable).length} chi tiết</span></div>
          <div class="page-actions">${badge('brand', c.regime)}
            <button type="button" class="btn btn-outline" data-a="expand">Mở hết</button>
            <button type="button" class="btn btn-outline" data-a="collapse">Thu gọn</button>
            <button type="button" class="btn" data-a="add" data-primary-action ${E.isReadonly() ? 'disabled' : ''}>${icon('plus')}Thêm TK chi tiết</button>
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="search-input od-fill" style="max-width:360px">${icon('search')}<input class="input" type="search" data-search placeholder="Tìm mã hoặc tên TK… (F7)" aria-label="Tìm tài khoản" value="${esc(accQuery)}"></div>
            <span class="muted" style="margin-left:auto">Số dư cuối kỳ ${E.periodLabel(state.period)}</span>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Mã TK</th><th>Tên tài khoản</th><th>Tính chất</th><th>Đối tượng</th><th>Loại</th><th class="num">Số dư cuối kỳ</th><th>Trạng thái</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="8"><div class="empty">${icon('search')}<span class="empty-title">Không có tài khoản khớp</span><span class="empty-text">Thử gõ mã TK như 1331 hoặc một phần tên.</span></div></td></tr>`}</tbody>
          </table></div>
        </div>
      </div>`;
    },
    mount(host) {
      const search = host.querySelector('[data-search]');
      search.addEventListener('input', () => {
        accQuery = search.value;
        const pos = search.selectionStart;
        E.refresh();
        const s = document.querySelector('#content [data-search]');
        if (s) { s.focus(); s.setSelectionRange(pos, pos); }
      });
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t) return;
        const a = t.dataset.a;
        if (a === 'toggle') {
          const code = t.dataset.code;
          collapsed.has(code) ? collapsed.delete(code) : collapsed.add(code);
          E.refresh();
          const btn = document.querySelector(`#content [data-a="toggle"][data-code="${code}"]`);
          if (btn) btn.focus();
        }
        if (a === 'expand') { collapsed.clear(); E.refresh(); }
        if (a === 'collapse') { E.db().accounts.forEach((x) => { if (!x.parent && E.db().accounts.some((k) => k.parent === x.code)) collapsed.add(x.code); }); E.refresh(); }
        if (a === 'active') {
          if (E.isReadonly()) return readonlyToast();
          const acc = E.acc(t.dataset.code);
          acc.active = !acc.active;
          E.refresh();
          E.toast(acc.active ? `Đã dùng lại TK ${acc.code}` : `Đã ngừng dùng TK ${acc.code}`, { text: 'Không xóa TK, chỉ ngừng dùng.' });
        }
        if (a === 'add') { if (E.isReadonly()) return readonlyToast(); addAccountDialog(); }
      });
    },
  };

  function addAccountDialog() {
    const d = E.db();
    const parents = d.accounts.filter((a) => a.active);
    E.openDialog({
      eyebrow: 'Hệ thống tài khoản', title: 'Thêm TK chi tiết',
      body: `<div class="form-grid">
        <div class="field span-12"><label class="label" for="na-parent">TK cha<span class="req">*</span></label>
          <select class="select" id="na-parent">${parents.map((a) => `<option value="${esc(a.code)}">${esc(a.code)} · ${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field span-4"><label class="label" for="na-code">Mã TK<span class="req">*</span></label><input class="input mono" id="na-code" inputmode="numeric"></div>
        <div class="field span-8"><label class="label" for="na-name">Tên TK<span class="req">*</span></label><input class="input" id="na-name"></div>
        <div class="field span-12"><div class="od-row"><span class="switch"><input type="checkbox" id="na-cp"><span></span></span><label for="na-cp">Theo dõi chi tiết theo đối tượng</label></div></div>
        <p class="field-error span-12" id="na-err" hidden></p>
      </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Lưu', icon: 'check',
        run(api) {
          const el = api.el;
          const okCode = checkCode(el); const okName = checkName(el);
          if (!okCode || !okName) return false;
          const parent = E.acc(el.querySelector('#na-parent').value);
          const b = E.balances(state.period)[parent.code];
          const err = el.querySelector('#na-err');
          if (parent.postable && b && (b.openD || b.openC || b.psD || b.psC)) {
            err.textContent = 'TK cha đã có số dư, không tách được TK con.'; err.hidden = false; return false;
          }
          const code = el.querySelector('#na-code').value.trim();
          const idx = d.accounts.indexOf(parent);
          let insertAt = idx + 1;
          while (insertAt < d.accounts.length && d.accounts[insertAt].code.startsWith(parent.code) && d.accounts[insertAt].code < code) insertAt++;
          d.accounts.splice(insertAt, 0, { code, name: el.querySelector('#na-name').value.trim(), side: parent.side, cp: el.querySelector('#na-cp').checked, active: true, parent: parent.code, postable: true });
          parent.postable = false;
          collapsed.delete(parent.code);
          E.refresh();
          E.toast(`Đã thêm TK ${code}`, { text: 'Danh mục đã cập nhật cho mọi người đang mở công ty này.' });
          return true;
        },
      }],
      onMount(api) {
        const el = api.el;
        const sel = el.querySelector('#na-parent');
        const code = el.querySelector('#na-code');
        const firstPostable = parents.find((a) => a.code === '6422') || parents[0];
        sel.value = firstPostable.code;
        const suggest = () => {
          const p = sel.value;
          let n = 1; while (E.acc(`${p}${n}`)) n++;
          code.value = `${p}${n}`;
          fieldErr(code, '');
          el.querySelector('#na-cp').checked = !!E.acc(p).cp;
        };
        suggest();
        sel.addEventListener('change', suggest);
        code.addEventListener('blur', () => checkCode(el));
        el.querySelector('#na-name').addEventListener('blur', () => checkName(el));
      },
      initialFocus: '#na-name',
    });
  }
  function checkCode(el) {
    const p = el.querySelector('#na-parent').value;
    const input = el.querySelector('#na-code');
    const v = input.value.trim();
    let msg = '';
    if (!v) msg = 'Nhập mã TK.';
    else if (!/^\d+$/.test(v)) msg = 'Mã TK chỉ gồm chữ số.';
    else if (!v.startsWith(p) || v === p) msg = `Mã TK phải bắt đầu bằng ${p} và dài hơn TK cha.`;
    else if (E.acc(v)) msg = `TK ${v} đã có trong hệ thống.`;
    return fieldErr(input, msg);
  }
  function checkName(el) {
    const input = el.querySelector('#na-name');
    return fieldErr(input, input.value.trim() ? '' : 'Nhập tên TK.');
  }

  /* =============== Đối tượng =============== */
  let cpKind = 'all';
  let cpQuery = '';
  const KIND_TONE = { customer: 'info', supplier: 'brand', employee: 'success', other: '' };
  const PREFIX = { customer: 'KH', supplier: 'NCC', employee: 'NV', other: 'CN' };

  function cpDebt(code) {
    const b = E.balances(state.period);
    const pick = (acc) => { const x = b[acc] && b[acc].byCp[code]; return x ? x.open + x.ps : 0; };
    const ar = pick('131');
    const ap = -pick('331');
    const out = [];
    if (ar) out.push(ar > 0 ? `Phải thu ${money(ar)}` : `Thu trước ${money(-ar)}`);
    if (ap) out.push(ap > 0 ? `Phải trả ${money(ap)}` : `Trả trước ${money(-ap)}`);
    return { ar, ap, text: out };
  }

  E.views.cps = {
    render() {
      const d = E.db();
      const kinds = [['all', 'Tất cả'], ['customer', 'Khách hàng'], ['supplier', 'Nhà cung cấp'], ['employee', 'Nhân viên'], ['other', 'Khác']];
      const count = (k) => (k === 'all' ? d.cps.length : d.cps.filter((c) => c.kind === k).length);
      const list = d.cps.filter((c) => (cpKind === 'all' || c.kind === cpKind) && (!cpQuery || E.matches(`${c.code} ${c.name} ${c.mst}`, cpQuery)));
      const rows = list.map((c) => {
        const debt = cpDebt(c.code);
        return `<tr class="is-click" data-a="open" data-code="${esc(c.code)}" tabindex="0">
          <td class="is-tight mono">${esc(c.code)}</td>
          <td><span class="strong">${esc(c.name)}</span></td>
          <td class="is-tight">${badge(KIND_TONE[c.kind], E.kindLabel[c.kind])}</td>
          <td class="is-tight mono">${c.mst ? esc(c.mst) : '<span class="faint">–</span>'}</td>
          <td style="max-width:260px"><span class="od-truncate muted">${esc(c.address)}</span></td>
          <td class="num">${debt.text.length ? `<span class="od-stack" style="--od-gap:0">${debt.text.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : '<span class="faint">–</span>'}</td>
          <td class="is-tight">${c.active ? badge('success', 'Đang dùng') : badge('', 'Ngừng dùng')}</td>
        </tr>`;
      }).join('');
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Đối tượng</h1><span class="page-sub">${d.cps.length} khách hàng, nhà cung cấp, nhân viên và cá nhân</span></div>
          <div class="page-actions"><button type="button" class="btn" data-a="add" data-primary-action ${E.isReadonly() ? 'disabled' : ''}>${icon('plus')}Thêm đối tượng</button></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="seg" role="group" aria-label="Lọc theo loại">${kinds.map(([k, l]) => `<button type="button" data-a="kind" data-kind="${k}" aria-pressed="${cpKind === k}">${esc(l)} <span class="count">${count(k)}</span></button>`).join('')}</div>
            <div class="search-input od-fill" style="max-width:320px;margin-left:auto">${icon('search')}<input class="input" type="search" data-search placeholder="Tìm mã, tên, MST… (F7)" aria-label="Tìm đối tượng" value="${esc(cpQuery)}"></div>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>MST</th><th>Địa chỉ</th><th class="num">Công nợ cuối kỳ</th><th>Trạng thái</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7"><div class="empty">${icon('users')}<span class="empty-title">Không có đối tượng khớp</span><span class="empty-text">Đổi bộ lọc loại hoặc thử gõ MST.</span></div></td></tr>`}</tbody>
          </table></div>
        </div>
      </div>`;
    },
    mount(host) {
      const search = host.querySelector('[data-search]');
      search.addEventListener('input', () => {
        cpQuery = search.value;
        const pos = search.selectionStart;
        E.refresh();
        const s = document.querySelector('#content [data-search]');
        if (s) { s.focus(); s.setSelectionRange(pos, pos); }
      });
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t) return;
        if (t.dataset.a === 'kind') { cpKind = t.dataset.kind; E.refresh(); const b = document.querySelector(`#content [data-kind="${cpKind}"]`); if (b) b.focus(); }
        if (t.dataset.a === 'open') cpDetail(t.dataset.code);
        if (t.dataset.a === 'add') { if (E.isReadonly()) return readonlyToast(); addCpDialog(); }
      });
      host.addEventListener('keydown', (e) => {
        const tr = e.target.closest('tr[data-a="open"]');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); cpDetail(tr.dataset.code); }
      });
    },
  };

  function cpDetail(code) {
    const c = E.cp(code);
    const debt = cpDebt(code);
    const lines = [];
    E.db().entries.filter((en) => en.status === 'posted' && E.periodOf(en.date) === state.period).forEach((en) => en.lines.forEach((l) => {
      if (l.cp === code) lines.push({ en, l });
    }));
    const recent = lines.sort((a, z) => z.en.date.localeCompare(a.en.date)).slice(0, 8);
    const acc = debt.ap && !debt.ar ? '331' : '131';
    E.openDialog({
      eyebrow: E.kindLabel[c.kind], title: c.name, size: 'lg',
      body: `<dl class="dl">
          <dt>Mã</dt><dd class="mono">${esc(c.code)}</dd>
          <dt>MST</dt><dd class="mono">${c.mst ? esc(c.mst) : '–'}</dd>
          <dt>Địa chỉ</dt><dd>${esc(c.address || '–')}</dd>
          <dt>Công nợ cuối kỳ</dt><dd class="mono">${debt.text.length ? debt.text.map(esc).join(' · ') : 'Không có'}</dd>
          <dt>Trạng thái</dt><dd>${c.active ? badge('success', 'Đang dùng') : badge('', 'Ngừng dùng')}</dd>
        </dl>
        <hr class="divider">
        <span class="label">Phát sinh trong kỳ ${E.periodLabel(state.period)}</span>
        ${recent.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th>Nợ / Có</th><th class="num">Số tiền</th></tr></thead><tbody>
          ${recent.map(({ en, l }) => `<tr><td class="is-tight mono">${dmy(en.date)}</td><td class="is-tight mono">${esc(en.no)}</td><td>${esc(en.desc)}</td><td class="is-tight"><span class="acc-chip">${esc(l.dr || '')}</span> / <span class="acc-chip">${esc(l.cr || '')}</span></td><td class="num">${money(l.amt)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">Chưa có bút toán nào trong kỳ.</p>'}`,
      actions: [
        { label: c.active ? 'Ngừng dùng' : 'Dùng lại', variant: 'btn-outline', run() { if (E.isReadonly()) { readonlyToast(); return; } c.active = !c.active; E.refresh(); E.toast(c.active ? 'Đã dùng lại đối tượng' : 'Đã ngừng dùng đối tượng', { text: 'Không xóa đối tượng đã có phát sinh.' }); } },
        { spacer: true },
        { label: 'Đóng', variant: 'btn-outline' },
        { label: 'Mở công nợ', icon: 'merge', run() { E.go('ar', { acc, cp: code }); } },
      ],
    });
  }

  function nextCpCode(kind) {
    const pre = PREFIX[kind];
    const nums = E.db().cps.filter((c) => c.code.startsWith(pre) && /^\d+$/.test(c.code.slice(pre.length))).map((c) => Number(c.code.slice(pre.length)));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${pre}${String(n).padStart(pre === 'NV' ? 3 : 4, '0')}`;
  }

  function addCpDialog() {
    const kindOpt = (k) => `<option value="${k}">${E.kindLabel[k]}</option>`;
    E.openDialog({
      eyebrow: 'Danh mục', title: 'Thêm đối tượng',
      body: `<div class="form-grid">
        <div class="field span-6"><label class="label" for="nc-kind">Loại<span class="req">*</span></label><select class="select" id="nc-kind">${['customer', 'supplier', 'employee', 'other'].map(kindOpt).join('')}</select></div>
        <div class="field span-6"><label class="label" for="nc-code">Mã<span class="req">*</span></label><input class="input mono" id="nc-code"></div>
        <div class="field span-12"><label class="label" for="nc-name">Tên<span class="req">*</span></label><input class="input" id="nc-name"></div>
        <div class="field span-6"><label class="label" for="nc-mst">MST</label><input class="input mono" id="nc-mst" inputmode="numeric" placeholder="0101234567"></div>
        <div class="field span-12"><label class="label" for="nc-addr">Địa chỉ</label><input class="input" id="nc-addr"></div>
      </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Lưu', icon: 'check',
        run(api) {
          const el = api.el;
          const ok = [checkCpCode(el), checkCpName(el), checkMst(el)].every(Boolean);
          if (!ok) { const bad = el.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return false; }
          const c = { code: el.querySelector('#nc-code').value.trim(), name: el.querySelector('#nc-name').value.trim(), kind: el.querySelector('#nc-kind').value, mst: el.querySelector('#nc-mst').value.trim(), address: el.querySelector('#nc-addr').value.trim(), active: true };
          E.db().cps.push(c);
          cpKind = 'all'; cpQuery = '';
          E.refresh();
          E.toast(`Đã thêm ${c.code}`, { text: c.name });
          return true;
        },
      }],
      onMount(api) {
        const el = api.el;
        const kind = el.querySelector('#nc-kind');
        const code = el.querySelector('#nc-code');
        kind.value = cpKind !== 'all' ? cpKind : 'supplier';
        code.value = nextCpCode(kind.value);
        kind.addEventListener('change', () => { code.value = nextCpCode(kind.value); fieldErr(code, ''); });
        code.addEventListener('blur', () => checkCpCode(el));
        el.querySelector('#nc-name').addEventListener('blur', () => checkCpName(el));
        el.querySelector('#nc-mst').addEventListener('blur', () => checkMst(el));
      },
      initialFocus: '#nc-name',
    });
  }
  function checkCpCode(el) {
    const input = el.querySelector('#nc-code'); const v = input.value.trim();
    return fieldErr(input, !v ? 'Nhập mã đối tượng.' : E.cp(v) ? `Mã ${v} đã tồn tại.` : '');
  }
  function checkCpName(el) {
    const input = el.querySelector('#nc-name');
    return fieldErr(input, input.value.trim() ? '' : 'Nhập tên đối tượng.');
  }
  function checkMst(el) {
    const input = el.querySelector('#nc-mst'); const v = input.value.trim();
    return fieldErr(input, v && !/^\d{10}(-\d{3})?$/.test(v) ? 'MST gồm 10 số, hoặc 10 số kèm -xxx cho chi nhánh.' : '');
  }

  /* =============== Rule định khoản =============== */
  const TIERS = { 1: 'Tầng 1 · Đối tượng + hàng hóa', 2: 'Tầng 2 · Đối tượng', 3: 'Tầng 3 · Mẫu nghiệp vụ', 4: 'Tầng 4 · Mặc định theo loại chứng từ' };
  const KIND = { in: 'HĐ mua vào', out: 'HĐ bán ra', bank: 'Sao kê' };
  const BASE = { net: 'tiền hàng', vat: 'thuế', gross: 'tổng', cogs: 'giá vốn' };
  let selRule = null;
  let testKey = '';

  function condText(r) {
    const c = r.cond; const parts = [];
    if (c.kind) parts.push(KIND[c.kind]);
    if (c.dir) parts.push(c.dir === 'in' ? 'tiền vào' : 'tiền ra');
    if (c.cp) parts.push(E.cpName(c.cp));
    if (c.keyword) parts.push(`nội dung chứa “${c.keyword}”`);
    return parts.join(' · ') || 'Mọi chứng từ';
  }
  const tplChips = (r) => r.tpl.map(([side, code, base]) => `<span class="acc-chip">${side === 'D' ? 'Nợ' : 'Có'} ${code === 'BANK' ? 'TK ngân hàng' : esc(code)} · ${BASE[base]}</span>`).join(' ');

  function testDocs() {
    const d = E.db();
    const docs = d.invoices.map((inv) => ({
      key: inv.id,
      label: `${KIND[inv.dir]} ${inv.no} · ${E.cpName(inv.party)}`,
      doc: { kind: inv.dir, cp: inv.party, text: `${inv.items.map((i) => i[0]).join(' ')}`, net: inv.net, vat: inv.vat },
    }));
    d.proposals.filter((p) => p.doc && p.doc.kind === 'bank').forEach((p) => docs.push({
      key: p.id,
      label: `Sao kê ${p.doc.bank} · ${p.doc.content}`,
      doc: { kind: 'bank', dir: p.doc.dir, text: p.doc.content, net: p.doc.amount, vat: 0, account: p.doc.account },
    }));
    return docs;
  }

  E.views.rules = {
    render(params = {}) {
      const d = E.db();
      if (params.id) selRule = params.id;
      if (!selRule || !d.rules.some((r) => r.id === selRule)) selRule = d.rules[0] && d.rules[0].id;
      const groups = [1, 2, 3, 4].map((t) => {
        const rs = d.rules.filter((r) => r.tier === t);
        if (!rs.length) return '';
        return `<div class="vm-tier">${TIERS[t]}</div>${rs.map((r) => `
          <div class="vm-rule${r.id === selRule ? ' is-active' : ''}${r.active ? '' : ' is-off'}" data-a="sel" data-id="${r.id}" tabindex="0" role="button" aria-pressed="${r.id === selRule}">
            <div class="od-stack" style="--od-gap:4px">
              <span class="vm-rule-name">${esc(r.name)}</span>
              <span class="vm-rule-cond">${esc(condText(r))}</span>
              <span class="od-cluster" style="--od-gap:4px">${tplChips(r)}</span>
            </div>
            <div class="vm-side">
              <span class="switch" title="${r.active ? 'Đang bật' : 'Đang tắt'}"><input type="checkbox" data-a="toggle" data-id="${r.id}" ${r.active ? 'checked' : ''} aria-label="Bật rule ${esc(r.name)}" ${E.isReadonly() ? 'disabled' : ''}><span></span></span>
              <span class="mono muted" style="font-size:12px">${r.hits} lần/90 ngày</span>
              <span class="mono faint" style="font-size:12px">v${r.version}</span>
            </div>
          </div>`).join('')}`;
      }).join('');

      const docs = testDocs();
      if (!testKey || !docs.some((x) => x.key === testKey)) testKey = docs[0] ? docs[0].key : '';
      const cur = docs.find((x) => x.key === testKey);
      let result = '<p class="muted">Chưa có chứng từ để thử.</p>';
      if (cur) {
        const rule = E.ruleMatch(cur.doc);
        if (rule) {
          const lines = E.ruleApply(rule, cur.doc);
          result = `<div class="od-row"><span class="strong od-fill">${esc(rule.name)}</span>${badge('brand', `Tầng ${rule.tier}`)}</div>
            <table class="tbl"><thead><tr><th>Nợ/Có</th><th>TK</th><th class="num">Số tiền</th></tr></thead><tbody>
            ${lines.map((l) => `<tr><td>${l.side === 'D' ? 'Nợ' : 'Có'}</td><td><span class="acc-chip">${esc(l.code)}</span></td><td class="num">${money(l.amt)}</td></tr>`).join('')}
            </tbody></table>`;
        } else {
          result = `<div class="od-row">${icon('sparkles')}<span>Không rule nào khớp → AI đề xuất</span></div>`;
        }
      }

      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Rule định khoản</h1><span class="page-sub">Rule chạy trước AI, tầng nhỏ hơn được ưu tiên. ${d.rules.filter((r) => r.active).length}/${d.rules.length} rule đang bật</span></div>
          <div class="page-actions"><button type="button" class="btn" data-a="add" data-primary-action ${E.isReadonly() ? 'disabled' : ''}>${icon('plus')}Thêm rule</button></div>
        </div>
        <div class="vm-two">
          <div class="card">${groups}</div>
          <div class="card">
            <div class="card-head"><div><span class="card-title">Thử với chứng từ</span><span class="card-sub">Xem rule nào khớp và bút toán sinh ra</span></div></div>
            <div class="card-body od-stack" style="--od-gap:12px">
              <div class="field"><label class="label" for="rt-doc">Chứng từ nguồn</label>
                <select class="select" id="rt-doc">${docs.map((x) => `<option value="${esc(x.key)}" ${x.key === testKey ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
              ${cur ? `<span class="muted" style="font-size:12px">Tổng tiền <span class="mono">${money(cur.doc.net + cur.doc.vat)}</span> đ</span>` : ''}
              <div class="od-stack" style="--od-gap:8px" aria-live="polite">${result}</div>
            </div>
          </div>
        </div>
      </div>`;
    },
    mount(host) {
      host.querySelector('#rt-doc') && host.querySelector('#rt-doc').addEventListener('change', (e) => {
        testKey = e.target.value; E.refresh();
        const s = document.getElementById('rt-doc'); if (s) s.focus();
      });
      host.addEventListener('change', (e) => {
        const t = e.target.closest('input[data-a="toggle"]');
        if (!t) return;
        if (E.isReadonly()) { t.checked = !t.checked; return readonlyToast(); }
        const r = E.db().rules.find((x) => x.id === t.dataset.id);
        r.active = t.checked; r.version += 1;
        E.refresh();
        E.toast(`Đã lưu rule, phiên bản v${r.version}`, { text: `${r.name}: ${r.active ? 'đang bật' : 'đã tắt'}` });
        const sw = document.querySelector(`#content input[data-a="toggle"][data-id="${r.id}"]`); if (sw) sw.focus();
      });
      host.addEventListener('click', (e) => {
        if (e.target.closest('.switch')) return;
        const t = e.target.closest('[data-a]');
        if (!t) return;
        if (t.dataset.a === 'sel') { selRule = t.dataset.id; E.refresh(); const r = document.querySelector(`#content [data-a="sel"][data-id="${selRule}"]`); if (r) r.focus(); }
        if (t.dataset.a === 'add') { if (E.isReadonly()) return readonlyToast(); addRuleDialog(); }
      });
      host.addEventListener('keydown', (e) => {
        const r = e.target.closest('[data-a="sel"]');
        if (r && (e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); r.click(); }
      });
    },
  };

  function addRuleDialog() {
    const d = E.db();
    const postable = d.accounts.filter((a) => a.postable && a.active);
    const accOpts = (sel) => `<option value="">Chọn TK</option>${postable.map((a) => `<option value="${esc(a.code)}" ${a.code === sel ? 'selected' : ''}>${esc(a.code)} · ${esc(a.name)}</option>`).join('')}`;
    E.openDialog({
      eyebrow: 'Rule định khoản', title: 'Thêm rule', size: 'lg',
      body: `<div class="form-grid">
        <div class="field span-8"><label class="label" for="nr-name">Tên rule<span class="req">*</span></label><input class="input" id="nr-name" placeholder="Ví dụ: Bắc Sơn · Xi măng → 1561"></div>
        <div class="field span-4"><label class="label" for="nr-tier">Tầng</label><select class="select" id="nr-tier">${[1, 2, 3, 4].map((t) => `<option value="${t}" ${t === 2 ? 'selected' : ''}>${TIERS[t]}</option>`).join('')}</select></div>
        <div class="field span-4"><label class="label" for="nr-kind">Loại chứng từ</label><select class="select" id="nr-kind"><option value="in">HĐ mua vào</option><option value="out">HĐ bán ra</option><option value="bank">Sao kê</option></select></div>
        <div class="field span-4"><label class="label" for="nr-cp">Đối tượng</label><select class="select" id="nr-cp"><option value="">Không giới hạn</option>${d.cps.filter((c) => c.active).map((c) => `<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field span-4"><label class="label" for="nr-kw">Từ khóa</label><input class="input" id="nr-kw" placeholder="xi mang"><span class="help">Khớp không dấu trong tên hàng hoặc nội dung</span></div>
        <div class="field span-4"><label class="label" for="nr-dr">TK Nợ<span class="req">*</span></label><select class="select mono" id="nr-dr">${accOpts('1561')}</select></div>
        <div class="field span-4"><label class="label" for="nr-cr">TK Có<span class="req">*</span></label><select class="select mono" id="nr-cr">${accOpts('331')}</select></div>
        <div class="field span-4"><label class="label" for="nr-base">Dựa trên</label><select class="select" id="nr-base"><option value="net">Tiền hàng</option><option value="vat">Thuế</option><option value="cogs">Giá vốn xuất kho</option><option value="gross">Tổng</option></select></div>
      </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Lưu rule', icon: 'check',
        run(api) {
          const el = api.el;
          const name = el.querySelector('#nr-name');
          const dr = el.querySelector('#nr-dr');
          const cr = el.querySelector('#nr-cr');
          const accMsg = (v) => { if (!v) return 'Chọn tài khoản.'; const a = E.acc(v); if (!a) return 'TK không tồn tại.'; if (!a.postable) return 'Chọn TK chi tiết.'; return ''; };
          const ok = [fieldErr(name, name.value.trim() ? '' : 'Nhập tên rule.'), fieldErr(dr, accMsg(dr.value)), fieldErr(cr, accMsg(cr.value) || (dr.value && dr.value === cr.value ? 'TK Có phải khác TK Nợ.' : ''))].every(Boolean);
          if (!ok) { const bad = el.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return false; }
          const base = el.querySelector('#nr-base').value;
          const kind = el.querySelector('#nr-kind').value;
          const cond = { kind };
          const cpv = el.querySelector('#nr-cp').value; if (cpv) cond.cp = cpv;
          const kw = el.querySelector('#nr-kw').value.trim(); if (kw) cond.keyword = kw;
          const r = { id: E.uidp('r'), tier: Number(el.querySelector('#nr-tier').value), name: name.value.trim(), cond, tpl: [['D', dr.value, base], ['C', cr.value, base]], hits: 0, active: true, version: 1 };
          d.rules.push(r);
          selRule = r.id;
          E.refresh();
          E.toast('Đã thêm rule', { text: `${r.name} · v1` });
          return true;
        },
      }],
      onMount(api) {
        const el = api.el;
        el.querySelector('#nr-name').addEventListener('blur', (e) => fieldErr(e.target, e.target.value.trim() ? '' : 'Nhập tên rule.'));
      },
      initialFocus: '#nr-name',
    });
  }

  /* =============== Cài đặt công ty =============== */
  const PARAM_FIELDS = [
    ['year', 'Năm áp dụng', 'int'], ['luongCoSo', 'Lương cơ sở (đ)', 'money'], ['luongCoSoTu', 'Lương cơ sở áp dụng từ', 'text'],
    ['tranBhxh', 'Trần đóng BHXH, BHYT (đ)', 'money'], ['tranBhtn', 'Trần đóng BHTN (đ)', 'money'], ['tranTu', 'Trần áp dụng từ', 'text'],
    ['nldBhxh', 'NLĐ: BHXH (%)', 'pct'], ['nldBhyt', 'NLĐ: BHYT (%)', 'pct'], ['nldBhtn', 'NLĐ: BHTN (%)', 'pct'],
    ['ctyBhxh', 'Công ty: BHXH (%)', 'pct'], ['ctyBhyt', 'Công ty: BHYT (%)', 'pct'], ['ctyBhtn', 'Công ty: BHTN (%)', 'pct'], ['kpcd', 'Kinh phí công đoàn (%)', 'pct'],
    ['giamTruBanThan', 'Giảm trừ bản thân (đ)', 'money'], ['giamTruPhuThuoc', 'Giảm trừ mỗi người phụ thuộc (đ)', 'money'],
    ['ngayCongChuan', 'Ngày công chuẩn tháng', 'int'], ['gioMotNgay', 'Giờ làm mỗi ngày', 'int'], ['otHeSo', 'Hệ số OT (%)', 'int'],
  ];
  function paramsDialog() {
    const d = E.db();
    const fmt = (k, kind) => (kind === 'money' ? money(d.params[k]) : String(d.params[k]).replace('.', ','));
    E.openDialog({
      eyebrow: 'Cài đặt công ty', title: 'Tham số lương và BHXH', size: 'lg',
      body: `<div class="form-grid">${PARAM_FIELDS.map(([k, l, kind]) => `<div class="field span-4"><label class="label" for="pp-${k}">${esc(l)}<span class="req">*</span></label><input id="pp-${k}" class="input${kind === 'text' ? '' : ' mono'}" ${kind === 'text' ? '' : 'inputmode="decimal"'} value="${esc(fmt(k, kind))}"></div>`).join('')}</div><p class="help">Đổi tham số không làm đổi bảng lương đã tạo; tạo lại bảng lương để áp dụng.</p>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: 'Lưu tham số', run(api) {
        let ok = true; const next = {};
        PARAM_FIELDS.forEach(([k, l, kind]) => {
          const inp = api.el.querySelector(`#pp-${k}`); const raw = inp.value.trim();
          let msg = '';
          if (!raw) msg = 'Không để trống.';
          else if (kind === 'text') next[k] = raw;
          else {
            const v = kind === 'money' ? E.parseMoney(raw) : Number(raw.replace(',', '.'));
            if (!Number.isFinite(v) || v < 0) msg = 'Nhập số không âm.';
            else if (kind === 'pct' && v > 100) msg = 'Tối đa 100%.';
            else if (kind === 'int' && !Number.isInteger(v)) msg = 'Nhập số nguyên.';
            else if (k === 'ngayCongChuan' && (v < 20 || v > 31)) msg = 'Ngày công chuẩn từ 20 đến 31.';
            else if (k === 'gioMotNgay' && (v < 1 || v > 12)) msg = 'Từ 1 đến 12 giờ.';
            else next[k] = v;
          }
          if (!fieldErr(inp, msg)) ok = false;
        });
        if (!ok) { api.el.querySelector('[aria-invalid="true"]').focus(); return false; }
        Object.assign(d.params, next);
        E.refresh(); E.toast('Đã lưu tham số lương và BHXH', { text: `Năm áp dụng ${d.params.year}.` });
        return true;
      } }],
      initialFocus: '#pp-year',
    });
  }

  E.views.settings = {
    render() {
      const c = E.company();
      const d = E.db();
      const usage = d.aiUsage || [];
      const cur = usage.find((u) => u[0] === state.period) || usage[usage.length - 1] || [state.period, 0, 0];
      const pct = d.aiBudget ? Math.min(100, Math.round((cur[2] / d.aiBudget) * 100)) : 0;
      const users = state.users.map((u) => [u.name, u.initials, [[u.role === 'ADMIN' ? 'brand' : '', u.role], ...(u.payroll ? [['success', 'Có quyền lương']] : [])]]);
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Cài đặt công ty</h1><span class="page-sub">${esc(c.name)}</span></div>
        </div>
        <div class="od-grid" style="--od-cols:2;--od-gap:16px">
          <div class="card">
            <div class="card-head"><span class="card-title">Thông tin</span></div>
            <div class="card-body"><dl class="dl">
              <dt>Tên công ty</dt><dd>${esc(c.name)}</dd>
              <dt>MST</dt><dd class="mono">${esc(c.mst)}</dd>
              <dt>Chế độ kế toán</dt><dd>${badge('brand', c.regime)}</dd>
              <dt>Năm tài chính bắt đầu</dt><dd class="mono">Tháng 01</dd>
              <dt>CRM client id</dt><dd class="mono">crm-${esc(c.id)}</dd>
              <dt>Người phụ trách</dt><dd>${esc(c.owner)}</dd>
              <dt>Ngành</dt><dd>${esc(c.industry)}</dd>
            </dl></div>
          </div>
          <div class="card">
            <div class="card-head"><span class="card-title">AI bên ngoài</span>${d.aiEnabled ? badge('success', 'Đang bật') : badge('', 'Đang tắt')}</div>
            <div class="card-body od-stack" style="--od-gap:14px">
              <div class="od-row-top" style="--od-gap:12px">
                <span class="switch"><input type="checkbox" id="ai-on" ${d.aiEnabled ? 'checked' : ''} ${E.isReadonly() ? 'disabled' : ''}><span></span></span>
                <div class="od-field"><label class="strong" for="ai-on">Cho phép gửi dữ liệu khách này tới AI bên ngoài</label><span class="help">Tắt thì rule vẫn chạy; đề xuất AI và Trợ lý ngừng.</span></div>
              </div>
              <hr class="divider">
              <div class="od-row"><span class="od-fill muted">Ngân sách AI mỗi tháng</span><span class="mono strong od-nowrap">${money(d.aiBudget)} đ</span></div>
              <div class="od-stack" style="--od-gap:4px">
                <div class="od-row"><span class="od-fill muted">Đã dùng kỳ ${E.periodLabel(cur[0])}</span><span class="mono od-nowrap">${money(cur[2])} đ · ${pct}%</span></div>
                <div class="progress is-brand" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Mức dùng ngân sách AI"><span style="width:${pct}%"></span></div>
              </div>
              <div class="table-wrap"><table class="tbl">
                <thead><tr><th>Kỳ</th><th class="num">Lượt gọi</th><th class="num">Chi phí (đ)</th></tr></thead>
                <tbody>${usage.map((u) => `<tr><td class="mono">${E.periodLabel(u[0])}</td><td class="num">${money(u[1])}</td><td class="num">${money(u[2])}</td></tr>`).join('')}</tbody>
              </table></div>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><div><span class="card-title">Quyền truy cập</span><span class="card-sub">Đồng bộ từ CRM. Đổi quyền tại CRM.</span></div></div>
            <div>${users.map(([n, ini, bs]) => `<div class="od-row" style="padding:12px 20px;border-bottom:1px solid var(--ink-100)"><span class="avatar" aria-hidden="true">${esc(ini)}</span><span class="od-fill strong">${esc(n)}</span><span class="od-cluster" style="--od-gap:6px">${bs.map(([t, l]) => badge(t, l)).join('')}</span></div>`).join('')}</div>
          </div>
          <div class="card">
            <div class="card-head"><div class="od-fill"><span class="card-title">Tham số lương và BHXH</span><span class="card-sub">Năm áp dụng ${d.params.year}. Bảng lương dùng các tham số này, không hardcode trong hàm tính.</span></div><button type="button" class="btn btn-outline" data-a="params" ${E.canWrite() ? '' : 'disabled'}>${icon('pencil')}Sửa</button></div>
            <div class="card-body"><dl class="dl">
              <dt>Lương cơ sở</dt><dd class="mono">${money(d.params.luongCoSo)} đ · từ ${esc(d.params.luongCoSoTu)}</dd>
              <dt>Trần đóng BHXH, BHYT</dt><dd class="mono">${money(d.params.tranBhxh)} đ (20 × lương cơ sở) · từ ${esc(d.params.tranTu)}</dd>
              <dt>Trần đóng BHTN</dt><dd class="mono">${money(d.params.tranBhtn)} đ</dd>
              <dt>Người lao động</dt><dd class="mono">BHXH ${d.params.nldBhxh}% · BHYT ${d.params.nldBhyt}% · BHTN ${d.params.nldBhtn}%</dd>
              <dt>Công ty</dt><dd class="mono">BHXH ${d.params.ctyBhxh}% · BHYT ${d.params.ctyBhyt}% · BHTN ${d.params.ctyBhtn}% · KPCĐ ${d.params.kpcd}%</dd>
              <dt>Giảm trừ gia cảnh</dt><dd class="mono">Bản thân ${money(d.params.giamTruBanThan)} đ · người phụ thuộc ${money(d.params.giamTruPhuThuoc)} đ</dd>
              <dt>Ngày công chuẩn, OT</dt><dd class="mono">${d.params.ngayCongChuan} ngày · ${d.params.gioMotNgay} giờ/ngày · OT ${d.params.otHeSo}%</dd>
            </dl></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="od-fill"><span class="card-title">Biểu thuế TNCN lũy tiến từng phần</span><span class="card-sub">Biểu 7 bậc áp dụng kèm mức giảm trừ ở bên cạnh.</span></div></div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Bậc</th><th class="num">Thu nhập tính thuế từ</th><th class="num">Đến</th><th class="num">Thuế suất</th></tr></thead>
              <tbody>${d.taxBrackets.map((b, i) => `<tr><td>${i + 1}</td><td class="num">${money(b.from)}</td><td class="num">${b.to == null ? 'Trên' : money(b.to)}</td><td class="num">${b.rate}%</td></tr>`).join('')}</tbody></table></div>
          </div>
          <div class="card">
            <div class="card-head"><span class="card-title">Thuế TNDN và kho</span></div>
            <div class="card-body od-stack" style="--od-gap:14px">
              <div class="field"><label class="label" for="cit-rate">Thuế suất TNDN tạm tính (%)</label><div class="od-row"><input id="cit-rate" class="input mono" inputmode="decimal" style="max-width:120px" value="${esc(String(d.opt.citRate).replace('.', ','))}" ${E.canWrite() ? '' : 'disabled'}><button type="button" class="btn btn-outline" data-a="cit" ${E.canWrite() ? '' : 'disabled'}>Lưu</button></div><span class="help">Chốt sổ ghi Nợ ${esc(E.rm().cit)} / Có 3334 theo thuế suất này trước khi kết chuyển. Mặc định 20%.</span></div>
              <hr class="divider">
              <div class="od-row-top" style="--od-gap:12px">
                <span class="switch"><input type="checkbox" id="neg-stock" ${d.opt.blockNegStock ? 'checked' : ''} ${E.canWrite() ? '' : 'disabled'}><span></span></span>
                <div class="od-field"><label class="strong" for="neg-stock">Chặn ghi xuất kho làm tồn âm</label><span class="help">Tương ứng CFG_KHAC ID191 của Smart Pro. Tắt thì cho phép xuất vượt tồn.</span></div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><span class="card-title">Ngừng dịch vụ</span>${c.readonly ? badge('danger', 'Chỉ đọc') : ''}</div>
            <div class="card-body od-stack" style="--od-gap:12px">
              ${c.readonly
                ? `<p class="muted">Công ty đang ở chế độ chỉ đọc. Gói bàn giao gồm sổ mọi năm, danh mục, chứng từ đính kèm và tệp kiểm tra SHA-256.</p>
                   <div><button type="button" class="btn" data-a="handover">${icon('download')}Tạo gói bàn giao</button></div>`
                : `<p class="muted">Khi khách ngừng dịch vụ, công ty chuyển sang chỉ đọc: vẫn xem và xuất sổ được, không ghi hay sửa.</p>
                   <div><button type="button" class="btn btn-danger-outline" data-a="readonly">${icon('lock')}Chuyển sang chỉ đọc</button></div>`}
            </div>
          </div>
        </div>
      </div>`;
    },
    mount(host) {
      const sw = host.querySelector('#ai-on');
      if (sw) sw.addEventListener('change', () => {
        if (E.isReadonly()) { sw.checked = !sw.checked; return readonlyToast(); }
        E.db().aiEnabled = sw.checked;
        E.refresh();
        E.refreshChrome();
        E.toast(sw.checked ? 'Đã bật AI bên ngoài cho khách này' : 'Đã tắt AI bên ngoài cho khách này', { icon: 'sparkles', text: sw.checked ? 'Đề xuất AI và Trợ lý hoạt động lại.' : 'Rule vẫn chạy bình thường.' });
        const s = document.getElementById('ai-on'); if (s) s.focus();
      });
      const neg = host.querySelector('#neg-stock');
      if (neg) neg.addEventListener('change', () => { E.db().opt.blockNegStock = neg.checked; E.toast(neg.checked ? 'Đã bật chặn xuất kho làm tồn âm' : 'Đã cho phép xuất vượt tồn', { icon: 'warehouse' }); });
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t) return;
        if (t.dataset.a === 'cit') {
          const inp = host.querySelector('#cit-rate');
          const v = Number(inp.value.replace(',', '.'));
          if (!(v >= 0 && v <= 100) || !inp.value.trim()) { inp.setAttribute('aria-invalid', 'true'); E.toast('Thuế suất không hợp lệ', { error: true, text: 'Nhập số từ 0 đến 100.' }); return; }
          inp.setAttribute('aria-invalid', 'false'); E.db().opt.citRate = v; E.toast('Đã lưu thuế suất TNDN tạm tính', { text: `${v}%` });
        }
        if (t.dataset.a === 'params') paramsDialog();
        if (t.dataset.a === 'readonly') {
          E.confirmDialog({
            eyebrow: E.company().name, title: 'Chuyển công ty sang chỉ đọc?', danger: true, confirmLabel: 'Chuyển sang chỉ đọc',
            text: 'Mọi người sẽ không ghi sổ, duyệt hay sửa danh mục của công ty này nữa. Chỉ quản trị viên mở lại được.',
            onConfirm() {
              E.company().readonly = true;
              E.refresh();
              E.refreshChrome();
              E.toast('Công ty đã chuyển sang chỉ đọc', { icon: 'lock' });
            },
          });
        }
        if (t.dataset.a === 'handover') {
          t.disabled = true;
          t.classList.add('is-loading');
          t.innerHTML = `${icon('loader')}Đang tạo gói…`;
          setTimeout(() => {
            t.disabled = false;
            t.classList.remove('is-loading');
            t.innerHTML = `${icon('download')}Tạo gói bàn giao`;
            const c = E.company();
            E.toast('Đã tạo gói bàn giao', { text: `bangiao-${c.mst}.zip`, action: { label: 'Tải ZIP', run: () => E.toast('Đang tải gói bàn giao', { icon: 'download' }) } });
          }, 1200);
        }
      });
    },
  };
})(window.EYN);
