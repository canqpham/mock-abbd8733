/* Daily work screens: companies, review queue (S05), voucher list. */
(function (E) {
  const { esc, icon, badge, money, dmy, state } = E;

  const SOURCE_TAG = {
    rule: ['branch', 'Rule'], ai: ['sparkles', 'AI'], manual: ['pencil', 'Tay'], job: ['clock', 'Job'],
  };
  const sourceTag = (s) => {
    const [ic, l] = SOURCE_TAG[s.kind] || ['info', s.kind];
    const label = s.kind === 'ai' ? `AI ${String(s.conf).replace('.', ',')}` : s.kind === 'rule' ? s.label : s.label || l;
    return `<span class="source-tag">${icon(ic)}<span class="od-truncate">${esc(label)}</span></span>`;
  };
  const lineSum = (lines) => lines.reduce((s, l) => s + (Number(l.amt) || 0), 0);
  const accItems = (q) => E.db().accounts.filter((a) => a.postable && a.active && (!q || a.code.startsWith(q.trim()) || E.matches(`${a.code} ${a.name}`, q)))
    .map((a) => ({ value: a.code, code: a.code, name: a.name, meta: a.cp ? 'Theo dõi đối tượng' : '' }));
  const cpItems = (q) => E.db().cps.filter((c) => c.active && (!q || E.matches(`${c.code} ${c.name} ${c.mst}`, q)))
    .map((c) => ({ value: c.code, code: c.code, name: c.name, meta: [E.kindLabel[c.kind], c.mst && `MST ${c.mst}`].filter(Boolean).join(' · ') }));

  /* ================= Companies ================= */
  const coState = { q: '', filter: 'all' };
  E.views.companies = {
    render() {
      const rows = state.companies.map((c) => {
        const d = state.data[c.id];
        const pending = d.proposals.filter((p) => p.status === 'proposed' && E.periodOf(p.date) === '2027-01').length;
        const cl = E.checklist(d, '2027-01');
        const locked = E.isLocked('2027-01', d);
        return { c, d, pending, cl, locked };
      });
      const shown = rows.filter((r) => (!coState.q || E.matches(`${r.c.name} ${r.c.mst} ${r.c.industry}`, coState.q))
        && (coState.filter === 'all' || (coState.filter === 'mine' && r.c.owner === state.user.name) || (coState.filter === 'attention' && !r.locked && !r.c.readonly && (r.pending > 0 || !r.cl.canLock))));
      const totalPending = rows.reduce((s, r) => s + r.pending, 0);
      const lockedCount = rows.filter((r) => r.locked).length;
      const active = rows.filter((r) => !r.c.readonly).length;
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Công ty khách</h1><span class="page-sub">${rows.length} công ty bạn được phân quyền · kỳ đang làm 01/2027</span></div>
          <div class="page-actions"><button type="button" class="btn" data-a="add-company" data-primary-action>${icon('plus')}Thêm từ CRM</button></div>
        </div>
        <div class="stats" style="--cols:4">
          <div class="stat"><span class="stat-label">Đang phục vụ</span><span class="stat-value">${active}</span><span class="stat-note">${rows.length - active} công ty chỉ đọc</span></div>
          <div class="stat"><span class="stat-label">Đề xuất chờ duyệt</span><span class="stat-value">${totalPending}</span><span class="stat-note">Tất cả công ty, kỳ 01/2027</span></div>
          <div class="stat"><span class="stat-label">Đã khóa kỳ 01/2027</span><span class="stat-value">${lockedCount}/${active}</span><span class="stat-note">Hạn khóa 15/03/2027</span></div>
          <div class="stat"><span class="stat-label">Hạn nộp 01/GTGT tháng 01</span><span class="stat-value">20/02/2027</span><span class="stat-note">Còn 20 ngày</span></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="seg" role="group" aria-label="Lọc công ty">
              ${[['all', 'Tất cả'], ['mine', 'Tôi phụ trách'], ['attention', 'Cần xử lý']].map(([k, l]) => `<button type="button" data-a="filter" data-k="${k}" aria-pressed="${coState.filter === k}">${l}</button>`).join('')}
            </div>
            <div class="search-input od-fill" style="max-width:360px;margin-left:auto">${icon('search')}<input class="input" data-search data-a-input="q" type="search" placeholder="Tìm tên, MST, ngành… (F7)" value="${esc(coState.q)}" aria-label="Tìm công ty"></div>
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Công ty</th><th class="hide-sm">Ngành</th><th>Chế độ</th><th class="hide-sm">Phụ trách</th><th class="num">Chờ duyệt</th><th style="min-width:160px">Chốt sổ 01/2027</th><th>Trạng thái</th></tr></thead>
              <tbody>${shown.length ? shown.map(({ c, d, pending, cl, locked }) => `
                <tr class="is-click" data-a="open" data-id="${c.id}" tabindex="0">
                  <td><span class="strong od-truncate" style="max-width:360px">${esc(c.name)}</span><span class="mono muted" style="font-size:12px">MST ${esc(c.mst)}</span></td>
                  <td class="hide-sm">${esc(c.industry)}</td>
                  <td>${badge('neutral', c.regime)}</td>
                  <td class="hide-sm">${esc(c.owner)}</td>
                  <td class="num">${pending ? `<span class="strong">${pending}</span>` : '<span class="faint">0</span>'}</td>
                  <td><div class="od-row"><div class="progress od-fill ${cl.done === 11 ? 'is-success' : ''}"><span style="transform:scaleX(${cl.done / 11})"></span></div><span class="mono muted" style="font-size:12px">${cl.done}/11</span></div></td>
                  <td>${c.readonly ? badge('neutral', 'Chỉ đọc', 'lock') : locked ? badge('success', 'Đã khóa kỳ', 'lock') : !d.aiEnabled ? badge('warning', 'Đang mở · AI tắt') : badge('info', 'Đang mở')}</td>
                </tr>`).join('') : `<tr><td colspan="7"><div class="empty">${icon('search')}<span class="empty-title">Không có công ty khớp</span><span class="empty-text">Xóa bộ lọc hoặc tìm theo MST.</span></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    },
    mount(host) {
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        if (t.dataset.a === 'open') E.switchCompany(t.dataset.id);
        if (t.dataset.a === 'filter') { coState.filter = t.dataset.k; E.refresh(); }
        if (t.dataset.a === 'add-company') addCompany();
      });
      host.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-a="open"]')) E.switchCompany(e.target.dataset.id); });
      const q = host.querySelector('[data-a-input="q"]');
      q.addEventListener('input', () => { coState.q = q.value; const pos = q.selectionStart; E.refresh(); const n = document.querySelector('[data-a-input="q"]'); n.focus(); n.setSelectionRange(pos, pos); });
    },
  };

  function addCompany() {
    const crm = [['crm-2291', 'Công ty TNHH Kỹ thuật Điện Hưng Thịnh', '0109223344'], ['crm-2310', 'Công ty CP Dược phẩm Thiên Ân', '0108334455'], ['crm-2347', 'Công ty TNHH Logistics Bắc Hà', '0110445566']];
    E.openDialog({
      eyebrow: 'Chỉ quản trị viên', title: 'Thêm công ty từ CRM',
      body: `<div class="field"><label class="label" for="nc-client">Khách trên CRM<span class="req">*</span></label>
          <select class="select" id="nc-client">${crm.map(([id, n, m]) => `<option value="${id}">${esc(n)} · MST ${m}</option>`).join('')}</select>
          <span class="help">Chỉ hiện khách đang có hợp đồng dịch vụ kế toán và chưa có sổ.</span></div>
        <div class="od-grid" style="--od-cols:2">
          <div class="field"><label class="label" for="nc-regime">Chế độ kế toán<span class="req">*</span></label><select class="select" id="nc-regime"><option>TT133</option><option>TT99</option></select></div>
          <div class="field"><label class="label" for="nc-fy">Tháng bắt đầu năm tài chính<span class="req">*</span></label><select class="select" id="nc-fy">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Tháng ${String(i + 1).padStart(2, '0')}</option>`).join('')}</select></div>
        </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Tạo sổ', icon: 'plus', run(api) {
          const id = api.el.querySelector('#nc-client').value;
          const [, name, mst] = crm.find((x) => x[0] === id);
          if (state.companies.some((c) => c.mst === mst)) { E.toast('Công ty này đã có sổ', { error: true }); return false; }
          const c = { id: `c${state.companies.length + 1}`, name, mst, regime: api.el.querySelector('#nc-regime').value, industry: 'Mới', owner: state.user.name, factor: 0.2 };
          state.companies.push(c);
          state.data[c.id] = { ...state.data.c10, proposals: [], entries: state.data.c10.entries.slice(0, 1), invoices: [], items: [], checks: [], assets: [], acks: {}, runs: { depreciation: false, cogs: false, closing: false }, periods: { '2027-01': { locked: false } }, counters: {}, audit: [] };
          E.toast(`Đã tạo sổ cho ${name}`, { text: 'Bước tiếp: nhập số dư đầu kỳ.' });
          E.refresh();
          return true;
        },
      }],
    });
  }

  /* ================= Review queue (S05) ================= */
  const rv = { source: 'all', status: 'proposed', errorsOnly: false, q: '', batch: null, group: false, active: null, selected: new Set() };
  const srcKey = (p) => (p.source.kind === 'ai' ? 'ai' : p.source.kind === 'manual' ? 'manual' : p.source.kind === 'job' ? 'job' : p.doc && p.doc.kind === 'bank' ? 'bank' : ['HD', 'HDBR'].includes(p.type) ? 'out' : 'in');
  const SOURCES = [['all', 'Tất cả'], ['in', 'HĐ mua vào'], ['out', 'HĐ bán ra'], ['bank', 'Sao kê'], ['ai', 'Có AI'], ['manual', 'Nhập tay'], ['job', 'Cuối kỳ']];
  const matchSource = (p, s) => s === 'all' || (s === 'ai' ? p.source.kind === 'ai' : s === 'bank' ? p.doc && p.doc.kind === 'bank' : srcKey(p) === s);

  function reviewList() {
    const d = E.db();
    return d.proposals.filter((p) => E.periodOf(p.date) === state.period
      && (rv.status === 'proposed' ? p.status === 'proposed' || p.status === 'posting' : p.status === rv.status)
      && matchSource(p, rv.source)
      && (!rv.batch || p.batch === rv.batch)
      && (!rv.errorsOnly || E.validateLines(p.lines, { period: state.period, doc: p.doc, date: p.date }).length || E.proposalWarnings(p).length)
      && (!rv.q || E.matches(`${p.desc} ${E.cpName(p.cp)} ${p.type} ${p.lines.map((l) => `${l.dr} ${l.cr} ${l.amt}`).join(' ')}`, rv.q)))
      .sort((a, z) => (rv.group ? (E.cpName(a.cp) || 'zzz').localeCompare(E.cpName(z.cp) || 'zzz') : 0) || a.date.localeCompare(z.date));
  }

  function propRow(p) {
    const errs = p.status === 'proposed' ? E.validateLines(p.lines, { period: state.period, doc: p.doc, date: p.date }) : [];
    const warns = p.status === 'proposed' ? E.proposalWarnings(p) : [];
    return `<div class="prop${rv.active === p.id ? ' is-active' : ''}${p.status === 'posting' ? ' is-posting' : ''}${p.status === 'posted' ? ' is-posted' : ''}" data-id="${p.id}" tabindex="${rv.active === p.id ? 0 : -1}" role="row" aria-selected="${rv.active === p.id}">
      <div class="prop-row">
        <span>${p.status === 'proposed' ? `<input type="checkbox" class="check" data-a="sel" data-id="${p.id}" aria-label="Chọn đề xuất" ${rv.selected.has(p.id) ? 'checked' : ''} ${errs.length ? 'disabled' : ''}>` : p.status === 'posting' ? icon('loader') : ''}</span>
        <span class="mono">${dmy(p.date).slice(0, 5)}</span>
        <span class="col-hide">${badge('neutral', p.type)}</span>
        <span class="od-truncate col-hide ${p.cp ? 'strong' : 'faint'}">${esc(p.cp ? E.cpName(p.cp) : 'Chưa có đối tượng')}</span>
        <span class="od-truncate">${esc(p.desc)}${p.edited ? ' <span class="badge badge-brand">đã sửa</span>' : ''}</span>
        <span>${p.status === 'posting' ? '<span class="muted">Đang ghi sổ…</span>' : p.status === 'posted' ? `<span class="source-tag">${icon('circle-check')}${esc(p.entryNo)}</span>` : p.status === 'rejected' ? badge('neutral', 'Từ chối') : sourceTag(p.source)}</span>
      </div>
      <div class="prop-lines">${p.lines.map((l) => `<div class="prop-line"><span><span class="faint">Nợ</span> <span class="acc-chip">${esc(l.dr || '–')}</span></span><span><span class="faint">Có</span> <span class="acc-chip">${esc(l.cr || '–')}</span></span><span class="od-truncate muted">${esc(l.desc || (l.cp ? E.cpName(l.cp) : ''))}</span><span class="num">${money(l.amt)}</span></div>`).join('')}</div>
      ${errs.map((x) => `<div class="prop-err">${icon('circle-x')}<span>${esc(x.msg)}</span></div>`).join('')}
      ${warns.map((w) => `<div class="prop-err prop-warn">${icon('alert')}<span>${esc(w)}</span></div>`).join('')}
    </div>`;
  }

  function docPreview(p) {
    if (!p) return `<div class="card card-pad"><div class="empty">${icon('inbox')}<span class="empty-title">Chọn một đề xuất</span><span class="empty-text">Chứng từ gốc và lý do định khoản hiện ở đây.</span></div></div>`;
    const errs = p.status === 'proposed' ? E.validateLines(p.lines, { period: state.period, doc: p.doc, date: p.date }) : [];
    let doc = '';
    if (p.doc && p.doc.kind === 'invoice') {
      const inv = E.invoice(p.doc.id);
      const party = E.cp(inv.party) || {};
      doc = `<div class="doc">
        <div class="doc-title">HÓA ĐƠN GIÁ TRỊ GIA TĂNG</div>
        <div class="doc-sub mono">Ký hiệu ${esc(inv.serial)} · Số ${esc(inv.no)} · ${dmy(inv.date)}</div>
        <dl class="dl" style="margin-top:12px"><dt>${inv.dir === 'in' ? 'Người bán' : 'Người mua'}</dt><dd>${esc(party.name)}</dd><dt>MST</dt><dd class="mono">${esc(party.mst || '—')}</dd></dl>
        <table class="doc-lines"><thead><tr><th>Hàng hóa, dịch vụ</th><th class="num">SL</th><th class="num">Thành tiền</th></tr></thead>
          <tbody>${inv.items.map(([n, u, q, pr]) => `<tr><td>${esc(n)}</td><td class="num">${q} ${esc(u)}</td><td class="num">${money(q * pr)}</td></tr>`).join('')}</tbody></table>
        <dl class="dl" style="margin-top:10px"><dt>Tiền hàng</dt><dd class="num">${money(inv.net)}</dd><dt>Thuế GTGT ${inv.rate}%</dt><dd class="num">${money(inv.vat)}</dd><dt class="strong">Tổng thanh toán</dt><dd class="num strong">${money(inv.total)}</dd></dl>
        ${inv.status === 'cancelled' ? `<p class="text-danger" style="margin-top:10px;font-size:13px">${icon('circle-x')} ${esc(inv.cancelNote)}</p>` : ''}
      </div>`;
    } else if (p.doc && p.doc.kind === 'bank') {
      doc = `<div class="doc"><div class="doc-title">DÒNG SAO KÊ ${esc(p.doc.bank.toUpperCase())}</div><div class="doc-sub">Lô ${esc(p.batch || '—')}</div>
        <dl class="dl" style="margin-top:12px"><dt>Tài khoản</dt><dd class="mono">${esc(E.acc(p.doc.account).name)}</dd><dt>Ngày giao dịch</dt><dd class="mono">${dmy(p.doc.date)}</dd>
        <dt>${p.doc.dir === 'in' ? 'Tiền vào' : 'Tiền ra'}</dt><dd class="num strong" style="text-align:left">${money(p.doc.amount)}</dd>
        ${p.fx ? `<dt>Nguyên tệ</dt><dd class="mono">${p.fx.amount} ${p.fx.cur} × ${money(p.fx.rate)}</dd>` : ''}
        <dt>Nội dung</dt><dd class="mono" style="overflow-wrap:anywhere">${esc(p.doc.content)}</dd></dl></div>`;
    } else {
      doc = `<div class="doc"><div class="doc-title">${esc(E.TYPE_NAMES[p.type] || p.type).toUpperCase()}</div><div class="doc-sub">${esc(p.source.label)}</div>
        <p class="muted" style="margin-top:10px">${p.source.kind === 'job' ? 'Bút toán sinh tự động từ xử lý cuối kỳ. Kiểm tra số liệu trước khi duyệt.' : 'Chứng từ nhập tay, chưa đính kèm chứng từ gốc.'}</p></div>`;
    }
    const reason = p.source.kind === 'ai'
      ? `<div class="conf"><span class="label">Độ tin cậy</span><div class="progress ${p.source.conf >= 0.8 ? 'is-success' : 'is-brand'}"><span style="transform:scaleX(${p.source.conf})"></span></div><span class="mono">${String(p.source.conf).replace('.', ',')}</span></div><p class="muted" style="font-size:13px">${esc(p.source.reason)}</p>`
      : p.source.kind === 'rule' ? `<p style="font-size:13px">Khớp rule <button type="button" class="link-btn" data-go="rules" data-params='${esc(JSON.stringify({ id: p.source.ruleId }))}'>${esc(p.source.label)}</button>.</p>` : `<p class="muted" style="font-size:13px">${esc(p.source.label)}</p>`;
    const can = p.status === 'proposed' && E.canWrite();
    return `<div class="card">
      <div class="card-head"><span class="od-fill"><span class="card-title">${esc(E.TYPE_NAMES[p.type] || p.type)}</span><span class="card-sub mono">${dmy(p.date)}${p.entryNo ? ` · ${esc(p.entryNo)}` : ''}</span></span>
        ${p.status === 'posted' ? badge('success', 'Đã ghi sổ', 'check') : p.status === 'rejected' ? badge('neutral', 'Đã từ chối') : errs.length ? badge('danger', `${errs.length} lỗi`) : badge('warning', 'Chờ duyệt')}</div>
      <div class="card-body od-stack" style="--od-gap:12px">
        ${doc}
        <div class="od-stack" style="--od-gap:6px"><span class="label">Vì sao định khoản thế này</span>${reason}</div>
        ${p.status === 'rejected' ? `<p class="muted" style="font-size:13px">Lý do từ chối: ${esc(p.rejectReason)}</p>` : ''}
      </div>
      ${p.status === 'proposed' ? `<div class="dlg-foot" style="border-radius:0 0 var(--r-lg) var(--r-lg);flex-wrap:wrap">
        <button type="button" class="btn btn-danger-outline" data-a="reject" ${can ? '' : 'disabled'}>${icon('x')}Từ chối</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-outline" data-a="edit" ${can ? '' : 'disabled'}>${icon('pencil')}Sửa</button>
        <button type="button" class="btn" data-a="approve-one" ${can && !errs.length ? '' : 'disabled'}>${icon('check')}Duyệt</button>
      </div>` : ''}
    </div>`;
  }

  E.views.review = {
    flush: true,
    render(params) {
      if (params.source) rv.source = params.source;
      if (params.batch !== undefined) { rv.batch = params.batch; rv.status = 'proposed'; }
      if (params.status) rv.status = params.status;
      const d = E.db();
      const inPeriod = d.proposals.filter((p) => E.periodOf(p.date) === state.period);
      const list = reviewList();
      if (!list.some((p) => p.id === rv.active)) rv.active = list[0] ? list[0].id : null;
      [...rv.selected].forEach((id) => { if (!list.some((p) => p.id === id && p.status === 'proposed')) rv.selected.delete(id); });
      const pending = inPeriod.filter((p) => p.status === 'proposed');
      const posted = inPeriod.filter((p) => p.status === 'posted');
      const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);
      const byKind = (k) => inPeriod.filter((p) => p.source.kind === k).length;
      const noEdit = pct(posted.filter((p) => !p.edited).length, posted.length);
      const active = d.proposals.find((p) => p.id === rv.active);
      const count = (k) => inPeriod.filter((p) => (rv.status === 'proposed' ? p.status === 'proposed' : p.status === rv.status) && matchSource(p, k)).length;
      const can = E.canWrite();
      return `<div class="review">
        <div class="review-head">
          <div><h1 class="page-title">Duyệt đề xuất</h1><span class="page-sub">${pending.length} chờ duyệt · ${posted.length} đã ghi sổ trong kỳ ${E.periodLabel(state.period)}</span></div>
          <div class="page-actions">
            <span class="kbd-legend hide-sm"><span>Rule <b class="mono">${pct(byKind('rule'), inPeriod.length)}%</b></span><span>AI <b class="mono">${pct(byKind('ai'), inPeriod.length)}%</b></span><span>Tay <b class="mono">${pct(byKind('manual'), inPeriod.length)}%</b></span><span>Duyệt không sửa <b class="mono">${posted.length ? `${noEdit}%` : '–'}</b></span></span>
            <button type="button" class="btn btn-danger-outline" data-a="reject" ${can && active && active.status === 'proposed' ? '' : 'disabled'}>${icon('x')}Từ chối <kbd>Ctrl Shift R</kbd></button>
            <button type="button" class="btn" data-a="approve" data-primary-action ${can && (rv.selected.size || (active && active.status === 'proposed')) ? '' : 'disabled'}>${icon('check')}Duyệt ${rv.selected.size ? `(${rv.selected.size})` : ''} <kbd>Ctrl Enter</kbd></button>
          </div>
        </div>
        <div class="review-filters">
          <div class="seg" role="group" aria-label="Nguồn">${SOURCES.map(([k, l]) => `<button type="button" data-a="source" data-k="${k}" aria-pressed="${rv.source === k}">${l}<span class="count">${count(k)}</span></button>`).join('')}</div>
          <div class="seg" role="group" aria-label="Trạng thái">${[['proposed', 'Chờ duyệt'], ['posted', 'Đã ghi'], ['rejected', 'Từ chối']].map(([k, l]) => `<button type="button" data-a="status" data-k="${k}" aria-pressed="${rv.status === k}">${l}</button>`).join('')}</div>
          <label class="od-row" style="--od-gap:6px;font-size:13px"><input type="checkbox" class="check" data-a="errors" ${rv.errorsOnly ? 'checked' : ''}>Chỉ dòng có lỗi, cảnh báo</label>
          <label class="od-row" style="--od-gap:6px;font-size:13px"><input type="checkbox" class="check" data-a="group" ${rv.group ? 'checked' : ''}>Nhóm theo đối tượng</label>
          ${rv.batch ? `<button type="button" class="chip" aria-pressed="true" data-a="clear-batch">Lô ${esc(rv.batch)} ${icon('x')}</button>` : ''}
          <div class="search-input od-fill" style="min-width:200px;max-width:320px;margin-left:auto">${icon('search')}<input class="input" type="search" data-search data-a-input="q" value="${esc(rv.q)}" placeholder="Tìm không dấu… (F7)" aria-label="Tìm đề xuất"></div>
        </div>
        <div class="review-body">
          <div class="card review-list">
            <div class="list-head" role="row"><span><input type="checkbox" class="check" data-a="sel-all" aria-label="Chọn tất cả đề xuất hợp lệ" ${rv.status !== 'proposed' ? 'disabled' : ''}></span><span>Ngày</span><span class="col-hide">Loại</span><span class="col-hide">Đối tượng</span><span>Diễn giải · bút toán</span><span>Nguồn</span></div>
            <div class="review-scroll" role="grid" aria-label="Danh sách đề xuất">${list.length ? groupRows(list) : `<div class="empty">${icon('circle-check')}<span class="empty-title">${rv.status === 'proposed' ? 'Không còn đề xuất chờ duyệt' : 'Chưa có đề xuất nào'}</span><span class="empty-text">${rv.source !== 'all' || rv.q || rv.errorsOnly || rv.batch ? 'Bộ lọc đang ẩn bớt đề xuất. Bỏ lọc để xem tất cả.' : 'Đề xuất mới xuất hiện khi đồng bộ hóa đơn, nhập sao kê hoặc chạy xử lý cuối kỳ.'}</span></div>`}</div>
            <div class="list-foot"><span class="kbd-legend"><span><kbd>↑</kbd><kbd>↓</kbd> chuyển</span><span><kbd>Space</kbd> chọn</span><span><kbd>Enter</kbd> sửa</span><span><kbd>Ctrl Enter</kbd> duyệt</span></span><span class="od-fill"></span><span class="muted" style="font-size:12px">${list.length} dòng · tổng <span class="mono">${money(list.reduce((s, p) => s + lineSum(p.lines), 0))}</span></span></div>
          </div>
          <aside class="preview" aria-label="Chứng từ gốc">${docPreview(active)}</aside>
        </div>
      </div>`;
    },
    mount(host) {
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        const row = e.target.closest('.prop');
        if (t) {
          const a = t.dataset.a;
          if (a === 'source') { rv.source = t.dataset.k; return E.refresh({}); }
          if (a === 'status') { rv.status = t.dataset.k; return E.refresh({}); }
          if (a === 'errors') { rv.errorsOnly = t.checked; return E.refresh({}); }
          if (a === 'group') { rv.group = t.checked; return E.refresh({}); }
          if (a === 'clear-batch') { rv.batch = null; return E.refresh({}); }
          if (a === 'sel') { t.checked ? rv.selected.add(t.dataset.id) : rv.selected.delete(t.dataset.id); return E.refresh({}); }
          if (a === 'sel-all') { reviewList().forEach((p) => { if (p.status === 'proposed' && !E.validateLines(p.lines, { period: state.period, doc: p.doc, date: p.date }).length) t.checked ? rv.selected.add(p.id) : rv.selected.delete(p.id); }); return E.refresh({}); }
          if (a === 'approve') return approve();
          if (a === 'approve-one') return approve([rv.active]);
          if (a === 'reject') return reject();
          if (a === 'edit') return editProposal(rv.active);
        }
        if (row) { rv.active = row.dataset.id; E.refresh({}); focusActive(); }
      });
      host.addEventListener('dblclick', (e) => { const row = e.target.closest('.prop'); if (row) editProposal(row.dataset.id); });
      const q = host.querySelector('[data-a-input="q"]');
      q.addEventListener('input', () => { rv.q = q.value; const pos = q.selectionStart; E.refresh({}); const n = document.querySelector('[data-a-input="q"]'); n.focus(); n.setSelectionRange(pos, pos); });
      q.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'Escape') { e.preventDefault(); focusActive(); } });
    },
    onKey(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); approve(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); reject(); return; }
      if (e.target.matches('input[type="search"], input[type="text"], textarea')) return;
      const list = reviewList();
      const i = list.findIndex((p) => p.id === rv.active);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (n) { rv.active = n.id; E.refresh({}); focusActive(); }
      } else if (e.key === ' ' && rv.active) {
        e.preventDefault();
        const p = list[i];
        if (p && p.status === 'proposed' && !E.validateLines(p.lines, { period: state.period, doc: p.doc, date: p.date }).length) { rv.selected.has(p.id) ? rv.selected.delete(p.id) : rv.selected.add(p.id); E.refresh({}); focusActive(); }
      } else if (e.key === 'Enter' && rv.active && !e.target.closest('button')) { e.preventDefault(); editProposal(rv.active); }
    },
  };

  function groupRows(list) {
    if (!rv.group) return list.map(propRow).join('');
    let g = null;
    return list.map((p) => {
      const name = p.cp ? E.cpName(p.cp) : 'Chưa có đối tượng';
      const head = name !== g ? `<div class="list-head" style="border-radius:0;grid-template-columns:1fr">${esc((g = name))}</div>` : '';
      return head + propRow(p);
    }).join('');
  }
  function focusActive() {
    const el = document.querySelector(`.prop[data-id="${rv.active}"]`);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
  }

  function approve(ids) {
    if (!E.canWrite()) return;
    const d = E.db();
    const target = (ids || (rv.selected.size ? [...rv.selected] : [rv.active])).map((id) => d.proposals.find((p) => p.id === id)).filter((p) => p && p.status === 'proposed');
    if (!target.length) return;
    const denied = target.filter((p) => E.approveBlock(p));
    const ok = target.filter((p) => !denied.includes(p) && !E.validateLines(p.lines, { period: state.period, doc: p.doc, date: p.date }).length);
    const bad = target.length - ok.length;
    if (denied.length) { E.toast('Không có quyền duyệt đề xuất lương', { error: true, text: E.approveBlock(denied[0]) }); if (!ok.length) return; }
    if (!ok.length) { E.toast('Đề xuất còn lỗi, chưa duyệt được', { error: true, text: 'Sửa lỗi hoặc từ chối đề xuất này.' }); return; }
    const list = reviewList();
    const last = list.findIndex((p) => p.id === ok[ok.length - 1].id);
    const next = list.slice(last + 1).find((p) => p.status === 'proposed' && !ok.includes(p)) || list.slice(0, last).reverse().find((p) => p.status === 'proposed' && !ok.includes(p));
    ok.forEach((p) => { p.status = 'posting'; rv.selected.delete(p.id); });
    rv.active = next ? next.id : rv.active;
    E.refresh({}); focusActive();
    setTimeout(() => {
      const edited = ok.filter((p) => p.edited && p.cp);
      ok.forEach((p) => { p.status = 'proposed'; E.approveProposal(p.id); });
      if (state.route.view === 'review') { E.refresh({}); focusActive(); } else E.refreshChrome();
      E.toast(`Đã ghi sổ ${ok.length} đề xuất`, { text: bad ? `${bad} đề xuất còn lỗi nên bị bỏ qua.` : ok.map((p) => p.entryNo).join(', ') });
      if (edited.length === 1) {
        const p = edited[0];
        E.toast(`Lưu thành rule cho ${E.cpName(p.cp)}?`, { icon: 'branch', text: 'Lần sau chứng từ tương tự sẽ được định khoản như bạn vừa sửa.', action: { label: 'Lưu rule', run: () => saveRuleFrom(p) } });
      }
    }, 550);
  }

  function saveRuleFrom(p) {
    const d = E.db();
    const kind = p.doc && p.doc.kind === 'bank' ? 'bank' : ['HD', 'HDBR'].includes(p.type) ? 'out' : 'in';
    d.rules.push({ id: E.uidp('r'), tier: p.doc && p.doc.kind === 'bank' ? 3 : 2, name: `${E.cpName(p.cp)} → ${p.lines[0].dr}`, cond: { kind, cp: p.cp }, tpl: p.lines.flatMap((l, i) => [['D', l.dr, i === 0 ? 'net' : 'vat'], ['C', l.cr, i === 0 ? 'net' : 'vat']]).filter((x, i, arr) => arr.findIndex((y) => y[0] === x[0] && y[1] === x[1] && y[2] === x[2]) === i), hits: 0, active: true, version: 1 });
    E.toast('Đã lưu rule mới', { text: 'Xem và chỉnh ở màn Rule định khoản.', action: { label: 'Mở', run: () => E.go('rules') } });
  }

  function reject() {
    if (!E.canWrite()) return;
    const p = E.db().proposals.find((x) => x.id === rv.active);
    if (!p || p.status !== 'proposed') return;
    E.openDialog({
      eyebrow: p.desc, title: 'Từ chối đề xuất',
      body: `<div class="field"><label class="label" for="rj">Lý do<span class="req">*</span></label><textarea class="textarea" id="rj" placeholder="Ví dụ: hóa đơn đã bị hủy, chờ hóa đơn thay thế"></textarea><span class="field-error" id="rj-err" hidden>Nhập lý do để người khác biết vì sao bị từ chối.</span></div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Từ chối', variant: 'btn-danger', run(api) {
          const ta = api.el.querySelector('#rj');
          if (!ta.value.trim()) { ta.setAttribute('aria-invalid', 'true'); api.el.querySelector('#rj-err').hidden = false; ta.focus(); return false; }
          E.rejectProposal(p, ta.value.trim());
          const list = reviewList(); rv.active = list[0] ? list[0].id : null;
          E.refresh({}); api.returnFocus = document.querySelector('[data-primary-action]');
          E.toast('Đã từ chối đề xuất', { icon: 'x' });
          return true;
        },
      }],
      initialFocus: '#rj',
    });
  }

  function editProposal(id) {
    const p = E.db().proposals.find((x) => x.id === id);
    if (!p || p.status !== 'proposed' || !E.canWrite()) return;
    const draft = { cp: p.cp || '', lines: p.lines.map((l) => ({ ...l })) };
    const drawErrors = (api) => {
      const errs = E.validateLines(draft.lines.map((l) => ({ ...l, cp: l.cp || null })), { period: state.period, doc: p.doc, date: p.date });
      api.el.querySelector('#ed-errs').innerHTML = errs.length ? errs.map((x) => `<div class="prop-err" style="padding:0">${icon('circle-x')}<span>${esc(x.msg)}</span></div>`).join('') : `<span class="balance-ok">${icon('circle-check')}Hợp lệ, có thể duyệt</span>`;
      api.el.querySelectorAll('[data-f]').forEach((inp) => { const [i, f] = inp.dataset.f.split(':'); inp.setAttribute('aria-invalid', errs.some((x) => x.line === Number(i) && x.field === f) ? 'true' : 'false'); });
      return errs;
    };
    E.openDialog({
      eyebrow: `${E.TYPE_NAMES[p.type]} · ${dmy(p.date)}`, title: 'Sửa đề xuất', size: 'lg',
      body: `<p class="muted">${esc(p.desc)}</p>
        <div class="field" style="max-width:420px"><label class="label" for="ed-cp">Đối tượng</label><input class="input" id="ed-cp" value="${esc(draft.cp ? `${draft.cp} · ${E.cpName(draft.cp)}` : '')}" placeholder="Gõ mã, tên hoặc MST"></div>
        <table class="lines"><thead><tr><th>TK Nợ</th><th>TK Có</th><th>Đối tượng dòng</th><th style="text-align:right">Số tiền</th></tr></thead><tbody>
        ${draft.lines.map((l, i) => `<tr>
          <td><input class="cell mono" data-f="${i}:dr" value="${esc(l.dr || '')}" aria-label="TK Nợ dòng ${i + 1}"><span class="cell-hint od-truncate">${esc((E.acc(l.dr) || {}).name || '')}</span></td>
          <td><input class="cell mono" data-f="${i}:cr" value="${esc(l.cr || '')}" aria-label="TK Có dòng ${i + 1}"><span class="cell-hint od-truncate">${esc((E.acc(l.cr) || {}).name || '')}</span></td>
          <td><input class="cell" data-f="${i}:cp" value="${esc(l.cp ? E.cpName(l.cp) : '')}" placeholder="—" aria-label="Đối tượng dòng ${i + 1}"></td>
          <td><input class="cell num" data-f="${i}:amt" value="${money(l.amt)}" inputmode="numeric" aria-label="Số tiền dòng ${i + 1}"></td></tr>`).join('')}
        </tbody></table>
        <div id="ed-errs" class="od-stack" style="--od-gap:4px" role="status"></div>
        ${p.source.kind === 'ai' ? '<div><button type="button" class="btn btn-outline" id="rerun">Chạy lại AI cho chứng từ này</button></div>' : ''}`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: 'Lưu', variant: 'btn-outline', run: (api) => save(api, false) }, { label: 'Lưu và duyệt', icon: 'check', run: (api) => save(api, true) }],
      onMount(api) {
        const cpIn = api.el.querySelector('#ed-cp');
        E.autocomplete(cpIn, { items: cpItems, onPick: (it) => { draft.cp = it.code; cpIn.value = `${it.code} · ${it.name}`; draft.lines.forEach((l, i) => { if ((E.acc(l.dr) || {}).cp || (E.acc(l.cr) || {}).cp) { l.cp = it.code; api.el.querySelector(`[data-f="${i}:cp"]`).value = it.name; } }); drawErrors(api); } });
        api.el.querySelectorAll('[data-f]').forEach((inp) => {
          const [i, f] = inp.dataset.f.split(':');
          const line = draft.lines[Number(i)];
          if (f === 'dr' || f === 'cr') {
            E.autocomplete(inp, { items: accItems, onPick: (it) => { inp.value = it.code; line[f] = it.code; inp.nextElementSibling.textContent = it.name; drawErrors(api); } });
            inp.addEventListener('change', () => { line[f] = inp.value.trim(); inp.nextElementSibling.textContent = (E.acc(line[f]) || {}).name || ''; drawErrors(api); });
          } else if (f === 'cp') {
            E.autocomplete(inp, { items: cpItems, onPick: (it) => { inp.value = it.name; line.cp = it.code; drawErrors(api); } });
            inp.addEventListener('change', () => { if (!inp.value.trim()) { line.cp = null; drawErrors(api); } });
          } else {
            inp.addEventListener('change', () => { line.amt = E.parseMoney(inp.value); inp.value = money(line.amt); drawErrors(api); });
          }
        });
        const rr = api.el.querySelector('#rerun');
        if (rr) rr.addEventListener('click', () => { rr.classList.add('is-loading'); rr.disabled = true; setTimeout(() => { rr.disabled = false; rr.classList.remove('is-loading'); E.toast('AI trả lại cùng định khoản', { text: `Độ tin cậy ${String(p.source.conf).replace('.', ',')}. Chi phí 1 lượt gọi.`, icon: 'sparkles' }); }, 900); });
        drawErrors(api);
      },
      initialFocus: '[data-f="0:dr"]',
    });
    function save(api, andApprove) {
      api.el.querySelectorAll('[data-f$=":amt"]').forEach((inp) => { const [i] = inp.dataset.f.split(':'); draft.lines[Number(i)].amt = E.parseMoney(inp.value); });
      const errs = drawErrors(api);
      if (andApprove && errs.length) return false;
      const changed = JSON.stringify(draft.lines) !== JSON.stringify(p.lines) || (draft.cp || null) !== p.cp;
      p.lines = draft.lines.map((l) => ({ ...l, cp: l.cp || null }));
      p.cp = draft.cp || null;
      if (changed) p.edited = true;
      E.refresh({});
      if (andApprove) approve([p.id]); else E.toast('Đã lưu đề xuất', { text: errs.length ? `Còn ${errs.length} lỗi cần sửa trước khi duyệt.` : 'Sẵn sàng duyệt.' });
      return true;
    }
  }

  /* ================= Voucher list ================= */
  const vs = { type: 'all', q: '' };
  const SRC_LABEL = { manual: ['neutral', 'Tay'], einvoice: ['info', 'HĐĐT'], bank: ['info', 'Sao kê'], ai: ['brand', 'AI'], reversal: ['warning', 'Đảo'], closing: ['neutral', 'Cuối kỳ'] };
  E.views.vouchers = {
    render() {
      const all = E.db().entries.filter((e) => e.source !== 'smartpro_import' && E.periodOf(e.date) === state.period);
      const types = [...new Set(all.map((e) => e.type))].sort();
      const list = all.filter((e) => (vs.type === 'all' || e.type === vs.type) && (!vs.q || E.matches(`${e.no} ${e.desc} ${e.lines.map((l) => `${l.dr} ${l.cr} ${E.cpName(l.cp)}`).join(' ')}`, vs.q)))
        .sort((a, z) => z.date.localeCompare(a.date) || z.no.localeCompare(a.no));
      const can = E.canWrite();
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Danh sách chứng từ</h1><span class="page-sub">${all.length} chứng từ đã ghi sổ trong kỳ ${E.periodLabel(state.period)} · chứng từ đã ghi không sửa, chỉ đảo</span></div>
          <div class="page-actions"><button type="button" class="btn" data-go="entry" data-primary-action ${E.isReadonly() ? 'disabled' : ''}>${icon('plus')}Chứng từ mới</button></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="seg" role="group" aria-label="Loại chứng từ"><button type="button" data-a="type" data-k="all" aria-pressed="${vs.type === 'all'}">Tất cả</button>${types.map((t) => `<button type="button" data-a="type" data-k="${t}" aria-pressed="${vs.type === t}">${t}</button>`).join('')}</div>
            <div class="search-input od-fill" style="max-width:320px;margin-left:auto">${icon('search')}<input class="input" type="search" data-search data-a-input="q" value="${esc(vs.q)}" placeholder="Số CT, diễn giải, TK… (F7)" aria-label="Tìm chứng từ"></div>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Ngày</th><th>Số CT</th><th class="hide-sm">Diễn giải</th><th class="hide-sm">Định khoản</th><th class="num">Số tiền</th><th>Nguồn</th><th class="is-tight"></th></tr></thead>
            <tbody>${list.length ? list.map((e) => `<tr class="is-click" data-a="open" data-id="${e.id}">
              <td class="mono">${dmy(e.date)}</td>
              <td><span class="mono strong">${esc(e.no)}</span>${e.reversedBy ? `<span class="muted" style="font-size:12px">Đã đảo bởi ${esc(e.reversedBy)}</span>` : ''}</td>
              <td class="hide-sm"><span class="od-truncate" style="max-width:420px">${esc(e.desc)}</span></td>
              <td class="hide-sm"><span class="od-cluster" style="--od-gap:4px">${e.lines.slice(0, 2).map((l) => `<span class="acc-chip">${esc(l.dr)}/${esc(l.cr)}</span>`).join('')}${e.lines.length > 2 ? `<span class="faint">+${e.lines.length - 2}</span>` : ''}</span></td>
              <td class="num">${money(lineSum(e.lines))}</td>
              <td>${badge(...(SRC_LABEL[e.source] || ['neutral', e.source]))}</td>
              <td class="is-tight"><div class="od-row" style="--od-gap:2px"><button type="button" class="btn btn-ghost btn-icon" data-a="copy" data-id="${e.id}" aria-label="Sao chép ${esc(e.no)}" title="Sao chép">${icon('copy')}</button><button type="button" class="btn btn-ghost btn-icon" data-a="reverse" data-id="${e.id}" aria-label="Đảo ${esc(e.no)}" title="Đảo bút toán" ${can && !e.reversedBy && e.source !== 'reversal' ? '' : 'disabled'}>${icon('undo')}</button></div></td>
            </tr>`).join('') : `<tr><td colspan="7"><div class="empty">${icon('file-text')}<span class="empty-title">Không có chứng từ</span><span class="empty-text">${vs.q || vs.type !== 'all' ? 'Không có chứng từ khớp bộ lọc.' : 'Kỳ này chưa có chứng từ nào được ghi sổ.'}</span></div></td></tr>`}</tbody>
          </table></div>
        </div>
      </div>`;
    },
    mount(host) {
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'type') { vs.type = t.dataset.k; E.refresh(); }
        if (a === 'copy') { e.stopPropagation(); E.go('entry', { copy: t.dataset.id }); }
        if (a === 'reverse') { e.stopPropagation(); confirmReverse(t.dataset.id); }
        if (a === 'open') openVoucher(t.dataset.id);
      });
      const q = host.querySelector('[data-a-input="q"]');
      q.addEventListener('input', () => { vs.q = q.value; const pos = q.selectionStart; E.refresh(); const n = document.querySelector('[data-a-input="q"]'); n.focus(); n.setSelectionRange(pos, pos); });
    },
  };

  function confirmReverse(id) {
    const e = E.db().entries.find((x) => x.id === id);
    E.confirmDialog({
      eyebrow: e.no, title: 'Đảo bút toán này?',
      text: `Tạo phiếu kế toán ngược chiều cho ${e.no} (${money(lineSum(e.lines))} đ). Bút toán gốc giữ nguyên trong sổ theo Điều 28 TT99/2025.`,
      confirmLabel: 'Tạo bút toán đảo',
      onConfirm: () => { const rev = E.reverseEntry(id); E.toast(`Đã tạo ${rev.no}`, { text: `Đảo ${e.no}` }); E.refresh(); },
    });
  }
  E.confirmReverse = confirmReverse;

  function openVoucher(id) {
    const e = E.db().entries.find((x) => x.id === id);
    E.openDialog({
      eyebrow: `${E.TYPE_NAMES[e.type] || e.type} · ${dmy(e.date)}`, title: e.no, size: 'lg',
      body: `<p>${esc(e.desc)}</p>
        <table class="tbl"><thead><tr><th>TK Nợ</th><th>TK Có</th><th>Đối tượng</th><th>Diễn giải</th><th class="num">Số tiền</th></tr></thead>
        <tbody>${e.lines.map((l) => `<tr><td><span class="acc-chip">${esc(l.dr)}</span></td><td><span class="acc-chip">${esc(l.cr)}</span></td><td>${esc(E.cpName(l.cp) || '—')}</td><td>${esc(l.desc || '')}</td><td class="num">${money(l.amt)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4">Tổng</td><td class="num">${money(lineSum(e.lines))}</td></tr></tfoot></table>
        <dl class="dl"><dt>Người ghi</dt><dd>${esc(e.createdBy)}</dd><dt>Nguồn</dt><dd>${esc((SRC_LABEL[e.source] || [, e.source])[1])}</dd>${e.reversedBy ? `<dt>Đã đảo bởi</dt><dd class="mono">${esc(e.reversedBy)}</dd>` : ''}</dl>`,
      actions: [
        { label: 'Đảo bút toán', icon: 'undo', variant: 'btn-outline', run: () => { if (E.canWrite() && !e.reversedBy) setTimeout(() => confirmReverse(id), 0); } },
        { spacer: true },
        { label: 'Sao chép sang chứng từ mới', variant: 'btn-outline', icon: 'copy', run: () => E.go('entry', { copy: id }) },
        { label: 'Đóng' },
      ],
    });
  }
  E.openVoucher = openVoucher;
})(window.EYN);
