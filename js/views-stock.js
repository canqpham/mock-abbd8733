/* Kho: Hàng hóa & kho (S-stock) and Nhập xuất kho (S-stockmove). Stock is always derived from ledger lines carrying item/wh/qty. */
(function (E) {
  const { esc, icon, badge, money, state } = E;
  const r0 = Math.round;
  const db = () => E.db();
  const fmtQ = (n) => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const parseNum = (s) => { const n = Number(String(s ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const dmy = E.dmy;
  const goodsLabel = (code) => { const g = E.goodsOf(code); return g ? g.name : code; };
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;

  const METHODS = [
    ['BQGQ', 'Bình quân gia quyền cuối tháng', true], ['BQDD', 'Bình quân di động (liên hoàn)', true], ['FIFO', 'Nhập trước xuất trước (FIFO)', true],
    ['LIFO', 'Nhập sau xuất trước (LIFO)', false], ['HT', 'Thực tế đích danh', false], ['HTLO', 'Đích danh theo lô', false],
    ['BQGQ_KHO', 'Bình quân gia quyền theo từng kho', false], ['BQNGAY', 'Bình quân theo ngày', false], ['BQLAN', 'Bình quân mỗi lần xuất', false],
    ['NHAPCUOI', 'Giá nhập cuối cùng', false], ['KEHOACH', 'Giá kế hoạch', false], ['NK', 'Giá nhập kho cùng phiếu (hàng nhập khẩu)', false], ['GIABAN', 'Giá bán trừ lãi gộp định mức', false],
  ];
  const METHOD_NAME = Object.fromEntries(METHODS.map(([k, n]) => [k, n]));
  const STOCK_ACCS = ['1561', '152', '153', '155'];

  const ui = { tab: 'catalog', q: '', group: '', status: 'active', wh: '', grp: '', card: { item: '', wh: '' } };
  const TABS = [['catalog', 'Danh mục VTHH'], ['stock', 'Tồn kho'], ['card', 'Thẻ kho'], ['wh', 'Kho & Lô']];

  const usedItem = (code) => db().entries.some((e) => e.lines.some((l) => l.item === code));
  const whName = (c) => { const w = db().warehouses.find((x) => x.code === c); return w ? `${w.code} · ${w.name}` : c || ''; };
  const postable = (prefix) => db().accounts.filter((a) => a.postable && a.active && a.code.startsWith(prefix));

  /* ======================= Hàng hóa & kho ======================= */
  function catalogTab() {
    const d = db();
    const groups = [...new Set(d.goods.map((g) => g.group))].sort();
    const list = d.goods.filter((g) => (!ui.group || g.group === ui.group) && (ui.status === 'all' || (ui.status === 'active') === g.active) && (!ui.q || E.matches(`${g.code} ${g.name} ${g.group}`, ui.q)));
    return `<div class="stk-filters">
        <div class="search-input od-fill" style="min-width:200px;max-width:340px">${icon('search')}<input class="input" type="search" data-search data-f="q" value="${esc(ui.q)}" placeholder="Tìm mã, tên, nhóm… (F7)" aria-label="Tìm hàng hóa"></div>
        <label class="od-stack" style="--od-gap:2px"><span class="label">Nhóm</span><select class="select" data-f="group">${opt('', 'Tất cả nhóm', !ui.group)}${groups.map((g) => opt(g, g, ui.group === g)).join('')}</select></label>
        <label class="od-stack" style="--od-gap:2px"><span class="label">Trạng thái</span><select class="select" data-f="status">${opt('active', 'Đang dùng', ui.status === 'active')}${opt('off', 'Ngừng dùng', ui.status === 'off')}${opt('all', 'Tất cả', ui.status === 'all')}</select></label>
        <button type="button" class="btn" data-a="add-item" ${E.canWrite() ? '' : 'disabled'}>${icon('plus')}Thêm hàng hóa</button>
      </div>
      ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên hàng hóa</th><th>Nhóm</th><th>ĐVT</th><th>TK kho</th><th>TK DT</th><th>TK GV</th><th class="num">VAT</th><th>Phương pháp</th><th>Lô</th><th>Trạng thái</th></tr></thead>
        <tbody>${list.map((g) => `<tr class="is-click" tabindex="0" data-a="edit-item" data-code="${esc(g.code)}"><td class="mono">${esc(g.code)}</td><td style="min-width:200px">${esc(g.name)}${g.units.length ? `<span class="help">${g.units.map((u) => `1 ${esc(g.unit)} = ${fmtQ(u.factor)} ${esc(u.unit)}`).join(' · ')}</span>` : ''}</td><td>${esc(g.group)}</td><td>${esc(g.unit)}</td><td><span class="acc-chip">${esc(g.tkKho)}</span></td><td><span class="acc-chip">${esc(g.tkDt)}</span></td><td><span class="acc-chip">${esc(g.tkGv)}</span></td><td class="num">${g.vat}%</td><td>${badge('', g.method)}</td><td>${g.lot ? badge('info', 'Theo lô') : '–'}</td><td>${g.active ? badge('success', 'Đang dùng') : badge('neutral', 'Ngừng dùng')}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${icon('package')}<span class="empty-title">Không có hàng hóa phù hợp</span><span class="empty-text">Bỏ bớt bộ lọc hoặc thêm hàng hóa mới.</span></div>`}`;
  }

  function stockTab() {
    const d = db();
    const rows = E.stockTable(state.period).filter((r) => (r.openQty || r.inQty || r.outQty || r.endQty || r.openVal || r.endVal) && (!ui.wh || r.wh === ui.wh) && (!ui.grp || (E.goodsOf(r.item) || {}).group === ui.grp));
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    const neg = rows.filter((r) => r.endQty < -1e-9);
    const groups = [...new Set(d.goods.map((g) => g.group))].sort();
    return `<div class="stats" style="--cols:4;padding:0 20px 16px">
        <div class="stat"><span class="stat-label">Mặt hàng còn tồn</span><span class="stat-value">${new Set(rows.filter((r) => r.endQty > 0).map((r) => r.item)).size}</span><span class="stat-note">${rows.length} dòng item × kho</span></div>
        <div class="stat"><span class="stat-label">Giá trị tồn cuối kỳ</span><span class="stat-value">${money(sum('endVal'))}</span><span class="stat-note">Khớp TK 152/153/155/156</span></div>
        <div class="stat"><span class="stat-label">Giá trị nhập trong kỳ</span><span class="stat-value">${money(sum('inVal'))}</span><span class="stat-note">Kỳ ${E.periodLabel(state.period)}</span></div>
        <div class="stat"><span class="stat-label">Tồn âm</span><span class="stat-value ${neg.length ? 'text-danger' : ''}">${neg.length}</span><span class="stat-note">${neg.length ? 'Cần nhập bổ sung hoặc sửa phiếu xuất' : d.opt.blockNegStock ? 'Đang chặn ghi xuất âm' : 'Cho phép xuất âm'}</span></div>
      </div>
      <div class="stk-filters">
        <label class="od-stack" style="--od-gap:2px"><span class="label">Kho</span><select class="select" data-f="wh">${opt('', 'Tất cả kho', !ui.wh)}${d.warehouses.map((w) => opt(w.code, `${w.code} · ${w.name}`, ui.wh === w.code)).join('')}</select></label>
        <label class="od-stack" style="--od-gap:2px"><span class="label">Nhóm hàng</span><select class="select" data-f="grp">${opt('', 'Tất cả nhóm', !ui.grp)}${groups.map((g) => opt(g, g, ui.grp === g)).join('')}</select></label>
        <button type="button" class="btn btn-outline" data-a="csv-stock">${icon('download')}Xuất CSV</button>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="tbl" id="stk-table"><thead><tr><th>Mặt hàng</th><th>Kho</th><th class="num">SL đầu kỳ</th><th class="num">Nhập</th><th class="num">Xuất</th><th class="num">Tồn cuối</th><th class="num">Giá trị</th><th class="num">Đơn giá BQ</th></tr></thead>
        <tbody>${rows.map((r) => { const g = E.goodsOf(r.item) || {}; const isNeg = r.endQty < -1e-9; return `<tr class="is-click${isNeg ? ' is-danger' : ''}" tabindex="0" data-a="open-card" data-item="${esc(r.item)}" data-wh="${esc(r.wh)}"><td style="min-width:200px"><span class="mono">${esc(r.item)}</span> ${esc(g.name || '')}</td><td>${esc(r.wh)}</td><td class="num">${fmtQ(r.openQty)}</td><td class="num">${fmtQ(r.inQty)}</td><td class="num">${fmtQ(r.outQty)}</td><td class="num">${isNeg ? `${icon('circle-alert')} Âm ` : ''}${fmtQ(r.endQty)} ${esc(g.unit || '')}</td><td class="num">${money(r.endVal)}</td><td class="num">${money(r.avg)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="2">Cộng</td><td class="num"></td><td class="num">${money(sum('inVal'))}</td><td class="num">${money(sum('outVal'))}</td><td class="num"></td><td class="num">${money(sum('endVal'))}</td><td class="num"></td></tr></tfoot></table></div>`
        : `<div class="empty">${icon('warehouse')}<span class="empty-title">Chưa có tồn kho</span><span class="empty-text">Nhập kho ở màn Nhập xuất kho hoặc khai báo tồn đầu kỳ ở màn Số dư đầu kỳ.</span></div>`}`;
  }

  function cardTab() {
    const d = db();
    if (!ui.card.item || !E.goodsOf(ui.card.item)) {
      const first = E.stockTable(state.period).find((r) => r.endQty || r.inQty || r.outQty);
      ui.card = first ? { item: first.item, wh: first.wh } : { item: (d.goods[0] || {}).code || '', wh: (d.warehouses[0] || {}).code || '' };
    }
    const g = E.goodsOf(ui.card.item);
    const c = g ? E.stockCard(ui.card.item, ui.card.wh, state.period) : null;
    const co = E.company();
    const head = `<label class="field" style="min-width:260px;flex:1"><span class="label">Mặt hàng</span><input class="input" id="stk-card-item" data-ac-item value="${esc(g ? `${g.code} · ${g.name}` : '')}" placeholder="Gõ mã hoặc tên hàng"></label>
      <label class="field"><span class="label">Kho</span><select class="select" data-f="card-wh">${d.warehouses.map((w) => opt(w.code, `${w.code} · ${w.name}`, ui.card.wh === w.code)).join('')}</select></label>
      <div class="od-cluster" style="margin-left:auto;align-self:flex-end"><button type="button" class="btn btn-outline" data-a="print-card" ${c ? '' : 'disabled'}>${icon('printer')}In</button><button type="button" class="btn btn-outline" data-a="csv-card" ${c ? '' : 'disabled'}>${icon('download')}Xuất CSV</button></div>`;
    if (!c) return `<div class="stk-filters">${head}</div><div class="empty"><span class="empty-title">Chưa chọn mặt hàng</span></div>`;
    const tIn = c.rows.reduce((s, r) => s + r.inQty, 0); const tOut = c.rows.reduce((s, r) => s + r.outQty, 0);
    const vIn = c.rows.reduce((s, r) => s + r.inVal, 0); const vOut = c.rows.reduce((s, r) => s + r.outVal, 0);
    return `<div class="stk-filters">${head}</div>
      <div class="print-head"><h2>THẺ KHO</h2><p>${esc(co.name)} · MST ${esc(co.mst)} · Kỳ ${E.periodLabel(state.period)}</p><p>${esc(g.code)} – ${esc(g.name)} · Kho ${esc(whName(ui.card.wh))} · ĐVT ${esc(g.unit)} · Phương pháp ${esc(METHOD_NAME[g.method] || g.method)}</p></div>
      <div class="stk-card-head"><span class="strong">${esc(g.name)}</span><span class="od-cluster">${badge('brand', `Phương pháp: ${METHOD_NAME[g.method] || g.method}`)}${g.lot ? badge('info', 'Theo lô') : ''}<span class="muted">Kho ${esc(whName(ui.card.wh))} · ĐVT ${esc(g.unit)}</span></span></div>
      <div class="table-wrap"><table class="tbl" id="stk-card-table"><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="num">SL nhập</th><th class="num">Tiền nhập</th><th class="num">SL xuất</th><th class="num">Tiền xuất</th><th class="num">SL tồn</th><th class="num">Giá trị tồn</th><th class="num">Đơn giá tồn</th></tr></thead>
        <tbody><tr class="is-sub"><td colspan="7">Tồn đầu kỳ</td><td class="num">${fmtQ(c.openQty)}</td><td class="num">${money(c.openVal)}</td><td class="num">${c.openQty > 0 ? money(c.openVal / c.openQty) : ''}</td></tr>
        ${c.rows.map((r) => `<tr><td class="mono">${dmy(r.mv.date)}</td><td><button type="button" class="link-btn mono" data-go="vouchers">${esc(r.mv.no)}</button></td><td>${esc(r.mv.desc)}${r.mv.adj ? ` ${badge('warning', 'Điều chỉnh giá')}` : ''}</td><td class="num">${r.inQty ? fmtQ(r.inQty) : ''}</td><td class="num">${r.inVal ? money(r.inVal) : ''}</td><td class="num">${r.outQty ? fmtQ(r.outQty) : ''}</td><td class="num">${r.outVal ? money(r.outVal) : ''}</td><td class="num${r.qty < 0 ? ' text-danger' : ''}">${fmtQ(r.qty)}</td><td class="num">${money(r.val)}</td><td class="num">${r.qty > 0 ? money(r.val / r.qty) : ''}</td></tr>`).join('')}
        ${c.rows.length ? '' : `<tr><td colspan="10" class="muted">Không có phát sinh nhập xuất trong kỳ.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="3">Cộng phát sinh · tồn cuối kỳ</td><td class="num">${fmtQ(tIn)}</td><td class="num">${money(vIn)}</td><td class="num">${fmtQ(tOut)}</td><td class="num">${money(vOut)}</td><td class="num">${fmtQ(c.endQty)}</td><td class="num">${money(c.endVal)}</td><td class="num">${c.endQty > 0 ? money(c.endVal / c.endQty) : ''}</td></tr></tfoot></table></div>`;
  }

  function whTab() {
    const d = db();
    const end = E.lastDay(state.period);
    const bal = E.lotBalances(d, end);
    const days = (iso) => Math.round((new Date(iso) - new Date(end)) / 86400000);
    const stockQty = Object.fromEntries(d.warehouses.map((w) => [w.code, E.stockTable(state.period).filter((r) => r.wh === w.code).reduce((s, r) => s + r.endQty, 0)]));
    const lotRows = d.lots.map((l) => ({ l, left: bal.filter((b) => b.lot === l.code && b.wh === l.wh).reduce((s, b) => s + b.qty, 0) }));
    const can = E.canWrite();
    return `<div class="stk-two">
      <section class="card"><div class="card-head"><div class="od-fill"><span class="card-title">Danh mục kho</span><span class="card-sub">Thủ kho lấy từ danh sách nhân viên.</span></div><button type="button" class="btn btn-outline" data-a="add-wh" ${can ? '' : 'disabled'}>${icon('plus')}Thêm kho</button></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên kho</th><th>Thủ kho</th><th class="num">Tồn cuối kỳ (SL)</th><th>Trạng thái</th></tr></thead>
        <tbody>${d.warehouses.map((w) => `<tr class="is-click" tabindex="0" data-a="edit-wh" data-code="${esc(w.code)}"><td class="mono">${esc(w.code)}</td><td>${esc(w.name)}</td><td>${esc(w.keeper || '–')}</td><td class="num">${fmtQ(stockQty[w.code])}</td><td>${w.active ? badge('success', 'Đang dùng') : badge('neutral', 'Ngừng dùng')}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-head"><div class="od-fill"><span class="card-title">Lô và hạn dùng</span><span class="card-sub">Tồn theo lô tính xuất trước hết hạn trước (FEFO) vì dòng xuất không ghi lô.</span></div><button type="button" class="btn btn-outline" data-a="add-lot" ${can && d.goods.some((g) => g.lot && g.active) ? '' : 'disabled'}>${icon('plus')}Thêm lô</button></div>
        ${lotRows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã lô</th><th>Mặt hàng</th><th>Kho</th><th>Hạn dùng</th><th class="num">Còn lại</th><th>Tình trạng</th></tr></thead>
        <tbody>${lotRows.map(({ l, left }) => { const dd = l.expiry ? days(l.expiry) : null; return `<tr><td class="mono">${esc(l.code)}</td><td>${esc(goodsLabel(l.item))}</td><td>${esc(l.wh)}</td><td class="mono">${l.expiry ? dmy(l.expiry) : '–'}</td><td class="num">${fmtQ(left)}</td><td>${dd == null ? '–' : left <= 0 ? badge('neutral', 'Hết hàng') : dd < 0 ? badge('danger', 'Quá hạn', 'circle-alert') : dd <= 90 ? badge('warning', `Còn ${dd} ngày`, 'alert') : badge('success', 'Còn hạn')}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="empty">${icon('package')}<span class="empty-title">Chưa có lô</span><span class="empty-text">Chỉ hàng có cờ theo lô mới khai báo lô được.</span></div>`}</section></div>`;
  }

  E.views.stock = {
    render(params = {}) {
      if (params.tab) ui.tab = params.tab;
      if (params.item) ui.card = { item: params.item, wh: params.wh || ui.card.wh };
      const d = db();
      const ran = d.runs.cogs === state.period || d.runs.cogs === true;
      const can = E.canWrite();
      const body = ui.tab === 'stock' ? stockTab() : ui.tab === 'card' ? cardTab() : ui.tab === 'wh' ? whTab() : catalogTab();
      return `<div class="page">
        <div class="page-header">
          <div class="od-fill" style="min-width:240px"><h1 class="page-title">Hàng hóa & kho</h1><span class="page-sub">${esc(E.company().name)} · kỳ ${E.periodLabel(state.period)} · tồn kho tính từ bút toán đã ghi sổ</span></div>
          <div class="page-actions">
            <button type="button" class="btn btn-outline" data-a="methods">${icon('book-open')}Phương pháp tính giá</button>
            <span class="od-stack" style="--od-gap:2px;align-items:flex-end"><button type="button" class="btn" data-a="cogs" data-primary-action ${can && !ran ? '' : 'disabled'} ${ran ? 'aria-describedby="stk-cogs-why"' : ''}>${icon('play')}Tính giá xuất kho tháng</button>${ran ? `<span class="help" id="stk-cogs-why">Đã chạy kỳ này. Hủy đề xuất giá vốn ở màn Duyệt để chạy lại.</span>` : ''}</span>
          </div>
        </div>
        <div class="card">
          <div class="tabs" role="tablist" style="padding:0 12px">${TABS.map(([k, l]) => `<button type="button" role="tab" data-a="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join('')}</div>
          ${ui.tab === 'catalog' || ui.tab === 'card' ? '' : ''}${body}
        </div>
      </div>`;
    },

    mount(host) {
      const d = db();
      const go = (extra = {}) => E.refresh({ tab: ui.tab, ...extra });
      const itemByCode = (c) => d.goods.find((g) => g.code === c);

      const acEl = host.querySelector('[data-ac-item]');
      if (acEl) {
        acEl.dataset.acOnFocus = 'true';
        E.autocomplete(acEl, {
          items: (q) => d.goods.filter((g) => !q || E.matches(`${g.code} ${g.name}`, q)).map((g) => ({ value: g.code, code: g.code, name: g.name, meta: g.group })),
          onPick: (it) => { ui.card = { ...ui.card, item: it.code }; go(); },
        });
        acEl.addEventListener('focus', () => acEl.select());
      }

      host.addEventListener('change', (e) => {
        const f = e.target.dataset && e.target.dataset.f;
        if (!f) return;
        if (f === 'card-wh') ui.card = { ...ui.card, wh: e.target.value };
        else ui[f] = e.target.value;
        go();
      });
      host.addEventListener('input', (e) => {
        if (e.target.dataset && e.target.dataset.f === 'q') {
          ui.q = e.target.value; const pos = e.target.selectionStart; go();
          const n = document.querySelector('[data-f="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
        }
      });
      host.addEventListener('keydown', (e) => {
        const row = e.target.closest('tr[data-a]');
        if (row && (e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); row.click(); }
      });
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t || t.disabled) return;
        const a = t.dataset.a;
        if (a === 'tab') { ui.tab = t.dataset.tab; go(); }
        else if (a === 'add-item') itemDialog(null);
        else if (a === 'edit-item') itemDialog(itemByCode(t.dataset.code));
        else if (a === 'open-card') { ui.card = { item: t.dataset.item, wh: t.dataset.wh }; ui.tab = 'card'; go(); }
        else if (a === 'methods') methodsDialog();
        else if (a === 'cogs') cogsDialog();
        else if (a === 'add-wh') whDialog(null);
        else if (a === 'edit-wh') whDialog(d.warehouses.find((w) => w.code === t.dataset.code));
        else if (a === 'add-lot') lotDialog();
        else if (a === 'csv-stock') E.downloadCsv(`ton-kho-${state.period}.csv`, E.tableRows(document.getElementById('stk-table')));
        else if (a === 'csv-card') E.downloadCsv(`the-kho-${ui.card.item}-${ui.card.wh}-${state.period}.csv`, [[`Thẻ kho ${goodsLabel(ui.card.item)}`, `Kho ${ui.card.wh}`, `Kỳ ${E.periodLabel(state.period)}`], ...E.tableRows(document.getElementById('stk-card-table'))]);
        else if (a === 'print-card') E.printPage(`The kho ${ui.card.item} ${ui.card.wh} ${state.period}`);
      });
    },
  };

  /* ---------- dialogs ---------- */
  const fieldErr = (el, msg) => {
    const err = el.closest('.field').querySelector('.field-error');
    if (err) { err.textContent = msg; err.hidden = !msg; }
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };
  const wireBlur = (api, rules) => Object.keys(rules).forEach((id) => {
    const el = api.el.querySelector(`#${id}`); if (!el) return;
    el.addEventListener('blur', () => fieldErr(el, rules[id](el.value, el)));
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') fieldErr(el, rules[id](el.value, el)); });
  });
  const runRules = (api, rules) => {
    const els = Object.keys(rules).map((id) => api.el.querySelector(`#${id}`)).filter(Boolean);
    const bad = els.filter((el) => !fieldErr(el, rules[el.id](el.value, el)));
    if (bad.length) bad[0].focus();
    return !bad.length;
  };
  const accOpts = (list, cur) => list.map((a) => opt(a.code, `${a.code} · ${a.name}`, a.code === cur)).join('');

  function methodsDialog() {
    E.openDialog({
      eyebrow: 'Hàng hóa & kho', title: 'Phương pháp tính giá xuất kho', size: 'lg',
      body: `<p class="muted">Smart Pro có 13 phương pháp. Bản này tính thật 3 phương pháp, phần còn lại hiện để đối chiếu nhưng chưa chọn được. Chọn phương pháp riêng cho từng mặt hàng trong danh mục VTHH.</p>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Phương pháp</th><th>Mã</th><th>Số mặt hàng</th><th>Trạng thái</th></tr></thead><tbody>${METHODS.map(([k, n, on]) => `<tr class="${on ? '' : 'is-sub'}"><td>${esc(n)}</td><td class="mono">${k}</td><td class="num">${on ? db().goods.filter((g) => g.method === k).length : '–'}</td><td>${on ? badge('success', 'Đang hỗ trợ') : badge('neutral', 'Chưa hỗ trợ')}</td></tr>`).join('')}</tbody></table></div>
        <p class="help">Bình quân gia quyền tính giá chung cho mọi kho của mặt hàng. Khi xuất, hệ thống ghi giá tạm tính (bình quân di động) rồi chạy "Tính giá xuất kho tháng" để điều chỉnh chênh lệch.</p>`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
    });
  }

  function itemDialog(g) {
    const d = db();
    const isNew = !g;
    const used = !isNew && usedItem(g.code);
    const kho = STOCK_ACCS.map((c) => E.acc(c)).filter((a) => a && a.postable);
    const dt = postable('511'); const gv = postable('632');
    const units = isNew ? [] : g.units;
    const unitRow = (i) => `<div class="field span-6"><label class="label" for="it-u${i}">ĐVT quy đổi ${i + 1}</label><input id="it-u${i}" class="input" value="${esc((units[i] || {}).unit || '')}" placeholder="Ví dụ: kg"></div><div class="field span-6"><label class="label" for="it-h${i}">Hệ số (1 ĐVT chính = … ĐVT quy đổi)</label><input id="it-h${i}" class="input mono" inputmode="decimal" value="${(units[i] || {}).factor != null ? esc(fmtQ(units[i].factor)) : ''}"><span class="field-error" hidden></span></div>`;
    const rules = {
      'it-code': (v) => (!v.trim() ? 'Nhập mã hàng.' : !/^[A-Za-z0-9_.]+$/.test(v.trim()) ? 'Mã chỉ gồm chữ không dấu, số, dấu gạch dưới và dấu chấm. Không dùng @ $ # - hoặc khoảng trắng.' : d.goods.some((x) => x.code === v.trim() && x !== g) ? 'Mã này đã có, đặt mã khác.' : ''),
      'it-name': (v) => (v.trim() ? '' : 'Nhập tên hàng hóa.'),
      'it-unit': (v) => (v.trim() ? '' : 'Nhập đơn vị tính chính.'),
      'it-vat': (v) => (v === '' || Number.isNaN(Number(v)) ? 'Chọn thuế suất.' : ''),
      'it-price': (v) => (parseNum(v) >= 0 ? '' : 'Giá không âm.'),
    };
    [0, 1, 2].forEach((i) => { rules[`it-h${i}`] = (v, el) => { const n = el.closest('.dlg').querySelector(`#it-u${i}`).value.trim(); return !n && !v.trim() ? '' : !n ? 'Nhập tên ĐVT quy đổi ở ô bên cạnh.' : !(parseNum(v) > 0) ? 'Hệ số phải lớn hơn 0.' : ''; }; });
    E.openDialog({
      eyebrow: 'Danh mục VTHH', title: isNew ? 'Thêm hàng hóa' : `Sửa ${g.code}`, size: 'lg',
      body: `<div class="form-grid">
        <div class="field span-4"><label class="label" for="it-code">Mã hàng<span class="req">*</span></label><input id="it-code" class="input mono" value="${esc(g ? g.code : '')}" ${used ? 'disabled' : ''} placeholder="HH006"><span class="field-error" hidden></span>${used ? '<span class="help">Đã có phát sinh, không đổi mã được.</span>' : ''}</div>
        <div class="field span-8"><label class="label" for="it-name">Tên hàng hóa<span class="req">*</span></label><input id="it-name" class="input" value="${esc(g ? g.name : '')}"><span class="field-error" hidden></span></div>
        <div class="field span-4"><label class="label" for="it-group">Nhóm</label><input id="it-group" class="input" value="${esc(g ? g.group : '')}" list="it-groups"><datalist id="it-groups">${[...new Set(d.goods.map((x) => x.group))].map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div class="field span-4"><label class="label" for="it-unit">ĐVT chính<span class="req">*</span></label><input id="it-unit" class="input" value="${esc(g ? g.unit : '')}"><span class="field-error" hidden></span></div>
        <div class="field span-4"><label class="label" for="it-vat">Thuế suất mặc định</label><select id="it-vat" class="select">${[0, 5, 8, 10].map((v) => opt(v, `${v}%`, (g ? g.vat : 10) === v)).join('')}</select><span class="field-error" hidden></span></div>
        <div class="field span-4"><label class="label" for="it-tk">TK kho</label><select id="it-tk" class="select" ${used ? 'disabled' : ''}>${accOpts(kho, g ? g.tkKho : '1561')}</select><span class="field-error" hidden></span>${used ? '<span class="help">Đã có phát sinh, không đổi TK kho.</span>' : ''}</div>
        <div class="field span-4"><label class="label" for="it-dt">TK doanh thu</label><select id="it-dt" class="select">${accOpts(dt, g ? g.tkDt : '5111')}</select></div>
        <div class="field span-4"><label class="label" for="it-gv">TK giá vốn</label><select id="it-gv" class="select">${accOpts(gv, g ? g.tkGv : '632')}</select></div>
        <div class="field span-6"><label class="label" for="it-method">Phương pháp tính giá xuất</label><select id="it-method" class="select">${METHODS.map(([k, n, on]) => `<option value="${k}" ${on ? '' : 'disabled'} ${(g ? g.method : 'BQGQ') === k ? 'selected' : ''}>${esc(n)}${on ? '' : ' (Chưa hỗ trợ)'}</option>`).join('')}</select></div>
        <div class="field span-6"><label class="label" for="it-price">Đơn giá vốn tham chiếu (đ)</label><input id="it-price" class="input mono" inputmode="numeric" value="${g ? esc(money(g.price)) : ''}"><span class="field-error" hidden></span><span class="help">Dùng khi xuất mà kho chưa có tồn để tính giá.</span></div>
        <div class="field span-12"><label class="od-row" style="--od-gap:8px"><input type="checkbox" id="it-lot" class="check" ${g && g.lot ? 'checked' : ''}><span>Theo dõi theo lô và hạn dùng</span></label></div>
        ${[0, 1, 2].map(unitRow).join('')}
      </div>`,
      actions: [
        ...(!isNew ? [{ label: g.active ? 'Ngừng dùng' : 'Dùng lại', variant: 'btn-danger-outline', run(api) {
          if (g.active) {
            const left = E.stockTable(state.period).filter((r) => r.item === g.code).reduce((s, r) => s + r.endQty, 0);
            if (left > 0) { E.toast('Còn tồn kho, chưa ngừng dùng được', { error: true, text: `${g.code} còn ${fmtQ(left)} ${g.unit}. Xuất hết hoặc điều chỉnh trước.` }); return false; }
          }
          g.active = !g.active; E.toast(g.active ? `${g.code} dùng lại` : `${g.code} ngừng dùng`); E.refresh({ tab: 'catalog' }); return undefined;
        } }] : []),
        { spacer: true }, { label: 'Hủy', variant: 'btn-outline' },
        { label: isNew ? 'Thêm hàng hóa' : 'Lưu', run(api) {
          if (!runRules(api, rules)) return false;
          const q = (id) => api.el.querySelector(`#${id}`);
          const u = [0, 1, 2].map((i) => ({ unit: q(`it-u${i}`).value.trim(), factor: parseNum(q(`it-h${i}`).value) })).filter((x) => x.unit);
          if (u.some((x) => x.unit === q('it-unit').value.trim())) { fieldErr(q('it-u0'), 'ĐVT quy đổi phải khác ĐVT chính.'); return false; }
          const next = { name: q('it-name').value.trim(), group: q('it-group').value.trim() || 'Khác', unit: q('it-unit').value.trim(), units: u, tkKho: q('it-tk').value, tkDt: q('it-dt').value, tkGv: q('it-gv').value, vat: Number(q('it-vat').value), method: q('it-method').value, lot: q('it-lot').checked, price: parseNum(q('it-price').value) };
          if (isNew) { const code = q('it-code').value.trim(); d.goods.push({ code, buyPrice: next.price, active: true, ...next }); E.toast(`Đã thêm ${code}`, { text: next.name }); } else { Object.assign(g, next); E.toast(`Đã lưu ${g.code}`); }
          E.refresh({ tab: 'catalog' }); return undefined;
        } },
      ],
      onMount(api) { wireBlur(api, rules); },
      initialFocus: isNew ? '#it-code' : '#it-name',
    });
  }

  function whDialog(w) {
    const d = db(); const isNew = !w;
    const rules = {
      'wh-code': (v) => (!v.trim() ? 'Nhập mã kho.' : !/^[A-Za-z0-9]+$/.test(v.trim()) ? 'Mã kho chỉ gồm chữ và số không dấu.' : d.warehouses.some((x) => x.code === v.trim() && x !== w) ? 'Mã kho đã có.' : ''),
      'wh-name': (v) => (v.trim() ? '' : 'Nhập tên kho.'),
    };
    E.openDialog({
      eyebrow: 'Kho & Lô', title: isNew ? 'Thêm kho' : `Sửa kho ${w.code}`,
      body: `<div class="form-grid">
        <div class="field span-4"><label class="label" for="wh-code">Mã kho<span class="req">*</span></label><input id="wh-code" class="input mono" value="${esc(w ? w.code : '')}" ${w && usedWh(w.code) ? 'disabled' : ''}><span class="field-error" hidden></span></div>
        <div class="field span-8"><label class="label" for="wh-name">Tên kho<span class="req">*</span></label><input id="wh-name" class="input" value="${esc(w ? w.name : '')}"><span class="field-error" hidden></span></div>
        <div class="field span-12"><label class="label" for="wh-keeper">Thủ kho</label><select id="wh-keeper" class="select">${opt('', 'Chưa chỉ định', !w || !w.keeper)}${d.employees.map((e) => opt(e.name, `${e.name} · ${e.dept}`, w && w.keeper === e.name)).join('')}${w && w.keeper && !d.employees.some((e) => e.name === w.keeper) ? opt(w.keeper, w.keeper, true) : ''}</select></div>
      </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: isNew ? 'Thêm kho' : 'Lưu', run(api) {
        if (!runRules(api, rules)) return false;
        const q = (id) => api.el.querySelector(`#${id}`);
        const next = { name: q('wh-name').value.trim(), keeper: q('wh-keeper').value };
        if (isNew) d.warehouses.push({ code: q('wh-code').value.trim(), active: true, ...next }); else Object.assign(w, next);
        E.toast(isNew ? 'Đã thêm kho' : 'Đã lưu kho'); E.refresh({ tab: 'wh' }); return undefined;
      } }],
      onMount(api) { wireBlur(api, rules); },
      initialFocus: '#wh-name',
    });
  }
  const usedWh = (code) => db().entries.some((e) => e.lines.some((l) => l.wh === code || l.whTo === code));

  function lotDialog() {
    const d = db();
    const items = d.goods.filter((g) => g.lot && g.active);
    const rules = {
      'lot-code': (v) => (!v.trim() ? 'Nhập mã lô.' : !/^[A-Za-z0-9_.]+$/.test(v.trim()) ? 'Mã lô chỉ gồm chữ không dấu, số, _ và dấu chấm.' : d.lots.some((l) => l.code === v.trim()) ? 'Mã lô đã có.' : ''),
      'lot-exp': (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '' : 'Chọn hạn dùng.'),
    };
    E.openDialog({
      eyebrow: 'Kho & Lô', title: 'Thêm lô',
      body: `<div class="form-grid">
        <div class="field span-12"><label class="label" for="lot-item">Mặt hàng (chỉ hàng theo lô)</label><select id="lot-item" class="select">${items.map((g) => opt(g.code, `${g.code} · ${g.name}`)).join('')}</select></div>
        <div class="field span-6"><label class="label" for="lot-wh">Kho</label><select id="lot-wh" class="select">${d.warehouses.map((w) => opt(w.code, `${w.code} · ${w.name}`)).join('')}</select></div>
        <div class="field span-6"><label class="label" for="lot-code">Mã lô<span class="req">*</span></label><input id="lot-code" class="input mono"><span class="field-error" hidden></span></div>
        <div class="field span-6"><label class="label" for="lot-exp">Hạn dùng<span class="req">*</span></label><input id="lot-exp" class="input" type="date"><span class="field-error" hidden></span></div>
      </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: 'Thêm lô', run(api) {
        if (!runRules(api, rules)) return false;
        const q = (id) => api.el.querySelector(`#${id}`);
        d.lots.push({ code: q('lot-code').value.trim(), item: q('lot-item').value, wh: q('lot-wh').value, expiry: q('lot-exp').value });
        E.toast('Đã thêm lô', { text: q('lot-code').value.trim() }); E.refresh({ tab: 'wh' }); return undefined;
      } }],
      onMount(api) { wireBlur(api, rules); },
      initialFocus: '#lot-code',
    });
  }

  function cogsDialog() {
    const plan = E.stockCostPlan(state.period);
    const rows = plan.rows;
    const diff = rows.reduce((s, r) => s + r.diff, 0);
    const changed = plan.lines.length;
    E.openDialog({
      eyebrow: `Kỳ ${E.periodLabel(state.period)}`, title: 'Tính giá xuất kho tháng', size: 'lg',
      body: `<p class="muted">Hệ thống tính lại giá mọi lần xuất trong kỳ theo phương pháp của từng mặt hàng, rồi chỉ đề xuất phần chênh lệch so với giá đã ghi để không ghi giá vốn hai lần. Đề xuất được duyệt ở màn Duyệt.</p>
        ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Mặt hàng</th><th>Kho</th><th>Ghi Nợ</th><th class="num">SL xuất</th><th class="num">Đơn giá tính lại</th><th class="num">GT tính lại</th><th class="num">GT đã ghi</th><th class="num">Chênh lệch</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.item)} · ${esc(goodsLabel(r.item))}</td><td>${esc(r.wh)}</td><td><span class="acc-chip">${esc(r.dr)}</span></td><td class="num">${fmtQ(r.qty)}</td><td class="num">${money(r.dgStd)}</td><td class="num">${money(r.std)}</td><td class="num">${money(r.posted)}</td><td class="num ${r.diff ? 'strong' : ''}">${E.signed(r.diff)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5">Cộng</td><td class="num">${money(rows.reduce((s, r) => s + r.std, 0))}</td><td class="num">${money(rows.reduce((s, r) => s + r.posted, 0))}</td><td class="num">${E.signed(diff)}</td></tr></tfoot></table></div>`
          : `<div class="empty">${icon('warehouse')}<span class="empty-title">Kỳ này chưa có xuất kho</span><span class="empty-text">Không có gì để tính giá.</span></div>`}
        <p class="${changed ? 'muted' : 'balance-ok'}">${changed ? `Sẽ tạo 1 đề xuất điều chỉnh gồm ${changed} dòng, tổng chênh lệch ${E.signed(diff)} đ.` : `${icon('circle-check')}Giá đã ghi khớp giá tính lại, không cần đề xuất điều chỉnh. Bước giá xuất kho vẫn được đánh dấu đã chạy.`}</p>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: changed ? 'Tạo đề xuất giá vốn' : 'Ghi nhận đã tính', icon: 'play', run() {
        const r = E.runCogs();
        if (r.lines) E.toast('Đã tạo đề xuất giá vốn, chờ duyệt', { text: `${r.lines} dòng điều chỉnh, chênh lệch ${E.signed(r.diff)} đ.`, action: { label: 'Mở Duyệt', run: () => E.go('review', { source: 'job' }) } });
        else E.toast('Giá xuất đã khớp', { text: 'Không có chênh lệch nên không tạo đề xuất.' });
        E.refresh({ tab: ui.tab }); E.refreshChrome(); return undefined;
      } }],
    });
  }

  /* ======================= Nhập xuất kho ======================= */
  const KINDS = ['PNK', 'PXK', 'HDBR', 'HTL', 'XTH', 'PCK'];
  const KIND_HINT = {
    PNK: 'Mua hàng nhập kho: Nợ TK kho, Nợ 1331 / Có công nợ hoặc tiền. Có thể phân bổ chi phí mua hàng vào giá trị nhập.',
    PXK: 'Xuất kho nội bộ: chỉ cần số lượng, giá lấy theo phương pháp tính giá của mặt hàng.',
    HDBR: 'Hóa đơn bán ra kiêm xuất kho: tự sinh bút toán giá vốn Nợ 632 / Có TK kho theo giá xuất tính được.',
    HTL: 'Hàng bán trả lại: đảo doanh thu, thuế và nhập lại kho đúng giá vốn đã xuất của hóa đơn gốc.',
    XTH: 'Xuất trả hàng cho người bán: Nợ 331 / Có TK kho, đảo thuế đầu vào.',
    PCK: 'Điều chuyển hàng giữa hai kho cùng mặt hàng, giá trị giữ nguyên.',
  };
  const PAY_PURCHASE = [['331', '331 · Phải trả người bán'], ['1111', '1111 · Tiền mặt'], ['11211', '11211 · TGNH Vietcombank'], ['11212', '11212 · TGNH Techcombank']];
  const PAY_SALE = [['131', '131 · Phải thu khách hàng'], ['1111', '1111 · Tiền mặt'], ['11211', '11211 · TGNH Vietcombank'], ['11212', '11212 · TGNH Techcombank']];
  const PXK_DEST = [['621', '621 · Chi phí NVL trực tiếp'], ['154', '154 · Chi phí SXKD dở dang'], ['627', '627 · Chi phí sản xuất chung'], ['6421', '6421 · Chi phí bán hàng'], ['6422', '6422 · Chi phí quản lý DN'], ['811', '811 · Chi phí khác']];
  const forms = {};
  const vt = (code) => db().vtypes.find((v) => v.code === code) || { code, active: true, coVthh: true, coXuatKho: code !== 'PNK', coLoNhap: code === 'PNK' || code === 'HTL' };
  const kindsActive = () => KINDS.filter((k) => vt(k).active);

  const blankRow = () => ({ item: '', wh: (db().warehouses.find((w) => w.active) || {}).code || '', whTo: '', lot: '', exp: '', qty: 0, price: 0, vat: null });
  function blankForm(kind) {
    const d = db();
    return {
      kind, date: E.lastDay(state.period), cp: '', desc: '', serial: '', no: '', invDate: E.lastDay(state.period), pay: kind === 'PNK' || kind === 'XTH' ? (kind === 'PNK' ? '331' : '331') : '131', dest: '621', ct: '',
      rows: [blankRow(), blankRow()], xcost: 0, xacc: '331', xcp: '', xby: 'value', ckPct: 0, ckAmt: 0, ckBefore: true, orig: '', tried: false, errors: [], whDefault: (d.warehouses[0] || {}).code,
    };
  }
  const formOf = (kind) => { const k = `${state.companyId}|${kind}`; return (forms[k] = forms[k] || blankForm(kind)); };

  const itemsAc = (q) => db().goods.filter((g) => g.active && (!q || E.matches(`${g.code} ${g.name}`, q))).map((g) => ({ value: g.code, code: g.code, name: g.name, meta: `${g.tkKho} · ${g.unit}` }));
  const cpAc = (kinds) => (q) => db().cps.filter((c) => c.active && kinds.includes(c.kind) && (!q || E.matches(`${c.code} ${c.name} ${c.mst}`, q))).map((c) => ({ value: c.code, code: c.code, name: c.name, meta: c.mst ? `MST ${c.mst}` : 'Chưa có MST' }));

  /* Largest-remainder style spread: last row absorbs rounding so parts add up to total. */
  const spread = (total, weights) => {
    const sum = weights.reduce((s, w) => s + w, 0);
    let left = total; const last = weights.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0).pop();
    return weights.map((w, i) => { if (i === last) return left; const v = sum > 0 ? r0((total * w) / sum) : 0; left -= v; return v; });
  };
  const probe = (date, lines) => [{ id: 'probe', status: 'posted', date, no: '(mới)', type: 'PXK', lines: lines.filter((l) => l.item) }];
  const costWith = (date, item, wh, qty, built) => E.issueCost(db(), { item, wh, qty, date, extra: probe(date, built) });

  /* Original sale data for HTL: sold qty/net per item, cost lines, and what was already returned. */
  function origInfo(entryId) {
    const d = db();
    const e = d.entries.find((x) => x.id === entryId); if (!e) return null;
    const items = {};
    e.lines.forEach((l) => {
      if (!l.item) return;
      const g = E.goodsOf(l.item); if (!g) return;
      const it = items[l.item] = items[l.item] || { item: l.item, sold: 0, net: 0, cost: 0, costQty: 0, wh: '', returned: 0, payAcc: '131', cp: null };
      if (l.cr === g.tkDt) { it.sold += l.qty || 0; it.net += l.amt; it.payAcc = l.dr; it.cp = l.cp; }
      if (l.dr === g.tkGv && E.isStockAcc(l.cr)) { it.cost += l.amt; it.costQty += l.qty || 0; it.wh = l.wh; }
    });
    d.entries.filter((x) => x.type === 'HTL' && x.ref === e.id).forEach((x) => x.lines.forEach((l) => { if (l.item && items[l.item] && E.isStockAcc(l.dr)) items[l.item].returned += l.qty || 0; }));
    const vatLine = e.lines.find((l) => l.cr === '33311' || l.dr === '33311');
    const netAll = Object.values(items).reduce((s, x) => s + x.net, 0);
    const rate = vatLine && netAll ? Math.round((vatLine.amt / netAll) * 100) : 0;
    return { entry: e, items: Object.values(items).filter((x) => x.sold > 0), rate };
  }

  /* Build ledger lines + local field errors for the current form. */
  function build(f) {
    const d = db(); const rm = E.rm();
    const errs = []; const lines = [];
    const err = (key, msg) => errs.push({ key, msg });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) err('date', 'Chọn ngày chứng từ.');
    const k = f.kind;
    const needCp = ['PNK', 'HDBR', 'HTL', 'XTH'].includes(k);
    const cpRec = E.cp(f.cp);
    if (needCp && !cpRec) err('cp', k === 'PNK' || k === 'XTH' ? 'Chọn nhà cung cấp.' : 'Chọn khách hàng.');
    const rows = k === 'HTL' ? [] : f.rows.map((r, i) => ({ r, i, g: E.goodsOf(r.item) })).filter(({ r }) => r.item || r.qty || r.price);
    if (k !== 'HTL' && !rows.length) err('rows', 'Nhập ít nhất một dòng hàng.');
    const date = f.date;
    const vatRows = []; // [rate, net]
    const invoice = ['PNK', 'HDBR', 'XTH'].includes(k);
    const base = { desc: f.desc || '' };
    const cpTag = cpRec ? cpRec.code : null;
    rows.forEach(({ r, i, g }) => {
      if (!g) { err(`r${i}:item`, 'Chọn mã hàng có trong danh mục.'); return; }
      if (!(r.qty > 0)) err(`r${i}:qty`, 'Nhập số lượng lớn hơn 0.');
      if (!r.wh) err(`r${i}:wh`, 'Chọn kho.');
      if (k === 'PCK') { if (!r.whTo) err(`r${i}:whTo`, 'Chọn kho nhận.'); else if (r.whTo === r.wh) err(`r${i}:whTo`, 'Kho nhận phải khác kho xuất.'); }
      if (k === 'PNK' && g.lot && vt('PNK').coLoNhap) { if (!r.lot) err(`r${i}:lot`, 'Hàng theo lô cần số lô.'); else if (!d.lots.some((l) => l.code === r.lot) && !r.exp) err(`r${i}:exp`, 'Lô mới cần hạn dùng.'); }
      if (['PNK', 'HDBR', 'XTH'].includes(k) && !(r.price > 0)) err(`r${i}:price`, 'Nhập đơn giá lớn hơn 0.');
    });
    if (errs.some((e) => e.key.startsWith('r'))) return { lines, errs, vatRows, rows };

    if (k === 'PNK' || k === 'HDBR') {
      const gross = rows.map(({ r }) => r0(r.qty * r.price));
      const total = gross.reduce((s, v) => s + v, 0);
      const ck = f.ckAmt > 0 ? Math.min(f.ckAmt, total) : 0;
      const parts = ck && f.ckBefore ? spread(ck, gross) : gross.map(() => 0);
      const nets = gross.map((v, i) => v - parts[i]);
      let allocs = rows.map(() => 0);
      if (k === 'PNK' && f.xcost > 0) allocs = spread(f.xcost, f.xby === 'qty' ? rows.map(({ r }) => r.qty) : nets);
      if (k === 'PNK' && f.xcost > 0 && f.xacc === '331' && !E.cp(f.xcp)) err('xcp', 'Chi phí trả cho nhà vận chuyển cần chọn đối tượng (TK 331).');
      const payAcc = f.pay;
      if ((payAcc === '331' || payAcc === '131') && !cpTag) err('cp', 'TK công nợ cần đối tượng.');
      rows.forEach(({ r, g }, j) => {
        const net = nets[j]; const vatR = r.vat == null ? g.vat : r.vat;
        vatRows.push([vatR, net]);
        if (k === 'PNK') {
          lines.push(E.L(g.tkKho, payAcc, net, cpTag, g.name, { item: g.code, wh: r.wh, qty: r.qty, lot: g.lot ? r.lot : undefined }));
          if (allocs[j] > 0) lines.push(E.L(g.tkKho, f.xacc, allocs[j], E.cp(f.xcp) ? f.xcp : null, `Phân bổ chi phí mua hàng ${g.code}`, { item: g.code, wh: r.wh, qty: 0, alloc: true, lot: g.lot ? r.lot : undefined }));
        } else {
          lines.push(E.L(payAcc, g.tkDt, net, cpTag, `${g.name} × ${fmtQ(r.qty)} ${g.unit}`, { item: g.code, qty: r.qty }));
        }
      });
      const byRate = {};
      vatRows.forEach(([rate, net]) => { byRate[rate] = (byRate[rate] || 0) + net; });
      Object.entries(byRate).forEach(([rate, net]) => { const v = E.pct(net, Number(rate)); if (v > 0) lines.push(k === 'PNK' ? E.L(E.rm().vatIn, payAcc, v, cpTag, `Thuế GTGT ${rate}%`) : E.L(payAcc, E.rm().vatOut, v, cpTag, `Thuế GTGT ${rate}%`)); });
      if (ck && !f.ckBefore) lines.push(k === 'PNK' ? E.L(payAcc, '711', ck, cpTag, 'Chiết khấu thương mại được hưởng') : E.L(rm.discount, payAcc, ck, cpTag, 'Chiết khấu thương mại bán hàng'));
      if (k === 'HDBR') {
        rows.forEach(({ r, g }) => {
          const c = costWith(date, g.code, r.wh, r.qty, lines);
          lines.push(E.L(g.tkGv, g.tkKho, c, null, `Giá vốn ${g.name}`, { item: g.code, wh: r.wh, qty: r.qty }));
        });
      }
    } else if (k === 'PXK') {
      rows.forEach(({ r, g }) => {
        const c = costWith(date, g.code, r.wh, r.qty, lines);
        lines.push(E.L(f.dest, g.tkKho, c, null, f.desc || `Xuất ${g.name}`, { item: g.code, wh: r.wh, qty: r.qty, ct: f.ct || undefined }));
      });
    } else if (k === 'PCK') {
      rows.forEach(({ r, g }) => {
        const c = costWith(date, g.code, r.wh, r.qty, lines);
        lines.push(E.L(g.tkKho, g.tkKho, c, null, f.desc || `Chuyển kho ${g.name}`, { item: g.code, wh: r.wh, whTo: r.whTo, qty: r.qty, lot: g.lot ? r.lot || undefined : undefined }));
      });
    } else if (k === 'XTH') {
      const nets = rows.map(({ r }) => r0(r.qty * r.price));
      if (!cpTag) err('cp', 'TK 331 cần đối tượng.');
      const byRate = {};
      rows.forEach(({ r, g }, j) => {
        lines.push(E.L('331', g.tkKho, nets[j], cpTag, `Trả lại ${g.name}`, { item: g.code, wh: r.wh, qty: r.qty }));
        const rate = r.vat == null ? g.vat : r.vat; byRate[rate] = (byRate[rate] || 0) + nets[j];
      });
      Object.entries(byRate).forEach(([rate, net]) => { const v = E.pct(net, Number(rate)); if (v > 0) lines.push(E.L('331', E.rm().vatIn, v, cpTag, `Đảo thuế GTGT ${rate}%`)); });
    } else if (k === 'HTL') {
      const info = origInfo(f.orig);
      if (!info) { err('orig', 'Chọn hóa đơn bán ra gốc.'); return { lines, errs, vatRows, rows }; }
      let any = false; let netTotal = 0;
      info.items.forEach((it, idx) => {
        const r = f.rows[idx] || {}; const q = Number(r.qty) || 0; if (q <= 0) return;
        const g = E.goodsOf(it.item); any = true;
        const room = it.sold - it.returned;
        if (q > room + 1e-9) { err(`r${idx}:qty`, `Chỉ còn ${fmtQ(room)} ${g.unit} được trả (đã bán ${fmtQ(it.sold)}, đã trả ${fmtQ(it.returned)}).`); return; }
        if (g.lot && !r.lot) { err(`r${idx}:lot`, 'Hàng theo lô cần số lô nhập lại.'); return; }
        const net = q >= room - 1e-9 && it.returned === 0 ? it.net : r0((it.net * q) / it.sold);
        const cost = it.costQty ? (q >= room - 1e-9 && it.returned === 0 ? it.cost : r0((it.cost * q) / it.costQty)) : r0(q * g.price);
        netTotal += net;
        lines.push(E.L(rm.returnRev, it.payAcc, net, it.cp, `Hàng bán trả lại ${g.name}`, { item: g.code, qty: q }));
        lines.push(E.L(g.tkKho, g.tkGv, cost, null, `Nhập lại kho hàng bán trả lại ${g.name}`, { item: g.code, wh: it.wh || r.wh, qty: q, lot: g.lot ? r.lot : undefined }));
      });
      if (!any && !errs.length) err('rows', 'Nhập số lượng trả lại cho ít nhất một mặt hàng.');
      const rate = f.vatRate == null ? info.rate : f.vatRate;
      const v = E.pct(netTotal, rate);
      const head = info.items[0];
      if (v > 0) lines.push(E.L('33311', head.payAcc, v, head.cp, `Đảo thuế GTGT ${rate}%`));
    }

    if (invoice) {
      const hasVat = lines.some((l) => l.dr === '1331' || l.cr === '33311' || l.cr === '1331');
      if (hasVat) {
        if (!f.serial) err('serial', 'Có thuế GTGT nên bắt buộc nhập Seri hóa đơn.');
        if (!f.no) err('no', 'Có thuế GTGT nên bắt buộc nhập Số hóa đơn.');
        if (cpRec && !cpRec.mst) err('cp', 'Hóa đơn cần đối tượng có mã số thuế.');
      }
      const inv = f.no ? { serial: f.serial, no: f.no, date: f.invDate } : null;
      if (inv) lines.forEach((l) => { if (l.dr === '1331' || l.cr === '33311' || l.item || l.dr === rm.discount) l.inv = inv; });
    }
    lines.forEach((l) => { Object.assign(l, base, { desc: l.desc || base.desc }); });
    return { lines, errs, vatRows, rows };
  }

  const sumByKind = (lines, kind) => {
    const stock = lines.filter((l) => l.item && (E.isStockAcc(l.dr) || E.isStockAcc(l.cr)));
    return stock.reduce((s, l) => s + l.amt, 0);
  };

  function fieldErrs(f, key) {
    if (!f.tried) return '';
    const e = f.cache.errs.filter((x) => x.key === key);
    return e.length ? `<span class="field-error" id="stk-e-${esc(key.replace(':', '-'))}">${esc(e[0].msg)}</span>` : '';
  }
  const inv = (f, key) => (f.tried && f.cache.errs.some((x) => x.key === key) ? 'aria-invalid="true"' : '');

  function rowHtml(f, r, i, k, cols, info) {
    const g = E.goodsOf(r.item); const d = db();
    const whOpts = d.warehouses.filter((w) => w.active).map((w) => opt(w.code, `${w.code} · ${w.name}`, r.wh === w.code)).join('');
    const cell = (key, html) => `<td>${html}${fieldErrs(f, `r${i}:${key}`)}</td>`;
    const out = (c) => `<td class="num" data-out="r${i}:${c}"></td>`;
    if (k === 'HTL') {
      const it = info.items[i]; const gg = E.goodsOf(it.item);
      return `<tr><td><span class="mono">${esc(it.item)}</span> ${esc(gg.name)}</td><td class="num">${fmtQ(it.sold)}</td><td class="num">${fmtQ(it.returned)}</td><td class="num">${money(it.sold ? it.net / it.sold : 0)}</td>
        ${cell('qty', `<input class="input num" data-r="${i}" data-k="qty" inputmode="decimal" value="${r.qty ? esc(fmtQ(r.qty)) : ''}" aria-label="SL trả lại ${esc(gg.name)}" ${inv(f, `r${i}:qty`)}>`)}
        ${gg.lot && vt('HTL').coLoNhap ? cell('lot', `<input class="input mono" data-r="${i}" data-k="lot" list="stk-lots-${i}" value="${esc(r.lot)}" aria-label="Số lô ${esc(gg.name)}" ${inv(f, `r${i}:lot`)}><datalist id="stk-lots-${i}">${d.lots.filter((l) => l.item === gg.code).map((l) => `<option value="${esc(l.code)}">`).join('')}</datalist>`) : '<td>–</td>'}
        ${out('amt')}${out('cost')}</tr>`;
    }
    return `<tr>
      ${cell('item', `<input class="input" data-r="${i}" data-k="item" data-ac="item" value="${esc(g ? `${g.code} · ${g.name}` : r.item)}" placeholder="Gõ mã hoặc tên hàng" aria-label="Mặt hàng dòng ${i + 1}" ${inv(f, `r${i}:item`)}>`)}
      ${cell('wh', `<select class="select" data-r="${i}" data-k="wh" aria-label="${k === 'PCK' ? 'Kho xuất' : 'Kho'} dòng ${i + 1}">${whOpts}</select>`)}
      ${k === 'PCK' ? cell('whTo', `<select class="select" data-r="${i}" data-k="whTo" aria-label="Kho nhận dòng ${i + 1}">${opt('', 'Chọn kho nhận', !r.whTo)}${d.warehouses.filter((w) => w.active).map((w) => opt(w.code, `${w.code} · ${w.name}`, r.whTo === w.code)).join('')}</select>`) : ''}
      ${cols.lot ? cell('lot', g && g.lot ? `<input class="input mono" data-r="${i}" data-k="lot" list="stk-lots-${i}" value="${esc(r.lot)}" placeholder="Số lô" aria-label="Số lô dòng ${i + 1}" ${inv(f, `r${i}:lot`)}><datalist id="stk-lots-${i}">${d.lots.filter((l) => l.item === g.code).map((l) => `<option value="${esc(l.code)}">`).join('')}</datalist>${r.lot && !d.lots.some((l) => l.code === r.lot) ? `<input class="input" type="date" data-r="${i}" data-k="exp" value="${esc(r.exp)}" aria-label="Hạn dùng lô mới dòng ${i + 1}" ${inv(f, `r${i}:exp`)}>` : ''}` : '–') : ''}
      <td class="stk-unit">${g ? esc(g.unit) : ''}</td>
      ${cell('qty', `<input class="input num" data-r="${i}" data-k="qty" inputmode="decimal" value="${r.qty ? esc(fmtQ(r.qty)) : ''}" aria-label="Số lượng dòng ${i + 1}" ${inv(f, `r${i}:qty`)}>`)}
      ${cols.price ? cell('price', `<input class="input num" data-r="${i}" data-k="price" inputmode="numeric" value="${r.price ? esc(money(r.price)) : ''}" aria-label="Đơn giá dòng ${i + 1}" ${inv(f, `r${i}:price`)}>`) + out('amt') : ''}
      ${cols.vat ? `<td><select class="select" data-r="${i}" data-k="vat" aria-label="Thuế suất dòng ${i + 1}">${[0, 5, 8, 10].map((v) => opt(v, `${v}%`, (r.vat == null ? (g ? g.vat : 10) : r.vat) === v)).join('')}</select></td>` : ''}
      ${cols.cost ? out('cost') : ''}${k === 'HDBR' ? out('gm') : ''}
      <td class="is-tight"><button type="button" class="btn btn-ghost btn-icon" data-a="del-row" data-r="${i}" aria-label="Xóa dòng ${i + 1}">${icon('trash')}</button></td></tr>`;
  }

  function recentHtml() {
    const d = db();
    const list = d.entries.filter((e) => e.status === 'posted' && e.type !== 'SDDK' && E.periodOf(e.date) === state.period && e.lines.some((l) => l.item && (E.isStockAcc(l.dr) || E.isStockAcc(l.cr)))).slice(-10).reverse();
    return `<section class="card"><div class="card-head"><div class="od-fill"><span class="card-title">Phiếu kho gần đây</span><span class="card-sub">Kỳ ${E.periodLabel(state.period)} · ${list.length} phiếu mới nhất có phát sinh hàng hóa</span></div><button type="button" class="btn btn-outline" data-go="vouchers">Danh sách chứng từ${icon('arrow-right')}</button></div>
      ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Số CT</th><th>Loại</th><th>Diễn giải</th><th class="num">Giá trị kho</th></tr></thead><tbody>${list.map((e) => `<tr><td class="mono">${dmy(e.date)}</td><td class="mono">${esc(e.no)}</td><td>${esc(E.TYPE_NAMES[e.type] || e.type)}</td><td>${esc(e.desc)}</td><td class="num">${money(sumByKind(e.lines))}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><span class="empty-title">Chưa có phiếu kho trong kỳ</span><span class="empty-text">Lập phiếu ở form phía trên.</span></div>`}</section>`;
  }

  E.views.stockmove = {
    render(params = {}) {
      const kinds = kindsActive();
      const kind = kinds.includes(params.kind) ? params.kind : kinds.includes(state.route.params && state.route.params.kind) ? state.route.params.kind : (formOf._last && kinds.includes(formOf._last) ? formOf._last : kinds[0]);
      formOf._last = kind;
      const f = formOf(kind);
      const t = vt(kind); const d = db();
      f.cache = build(f);
      const can = E.canWrite();
      const info = kind === 'HTL' ? origInfo(f.orig) : null;
      const cols = { lot: t.coLoNhap && kind !== 'HTL' && kind !== 'PCK' || (kind === 'PCK' && false), price: ['PNK', 'HDBR', 'XTH'].includes(kind), vat: ['PNK', 'HDBR', 'XTH'].includes(kind), cost: ['PXK', 'PCK', 'HDBR'].includes(kind) && t.coXuatKho };
      const cpKinds = kind === 'PNK' || kind === 'XTH' ? ['supplier', 'other'] : ['customer', 'other'];
      const needCp = ['PNK', 'HDBR', 'HTL', 'XTH'].includes(kind);
      const origs = d.entries.filter((e) => e.type === 'HDBR' && e.status === 'posted');
      const lotsOn = cols.lot && f.rows.some((r) => (E.goodsOf(r.item) || {}).lot);
      const head = kind === 'HTL'
        ? `<th>Mặt hàng</th><th class="num">Đã bán</th><th class="num">Đã trả</th><th class="num">Đơn giá bán</th><th class="num">SL trả lại</th><th>Lô nhập lại</th><th class="num">Giá trị hàng trả</th><th class="num">Nhập kho theo giá vốn gốc</th>`
        : `<th>Mặt hàng</th><th>${kind === 'PCK' ? 'Kho xuất' : 'Kho'}</th>${kind === 'PCK' ? '<th>Kho nhận</th>' : ''}${cols.lot ? '<th>Lô</th>' : ''}<th>ĐVT</th><th class="num">Số lượng</th>${cols.price ? `<th class="num">${kind === 'HDBR' ? 'Đơn giá bán' : 'Đơn giá'}</th><th class="num">Thành tiền</th>` : ''}${cols.vat ? '<th>Thuế</th>' : ''}${cols.cost ? '<th class="num">Giá vốn tạm tính</th>' : ''}${kind === 'HDBR' ? '<th class="num">Lãi gộp</th>' : ''}<th></th>`;
      const rowsHtml = kind === 'HTL' ? (info ? info.items.map((it, i) => { f.rows[i] = f.rows[i] || blankRow(); return rowHtml(f, f.rows[i], i, kind, cols, info); }).join('') : '') : f.rows.map((r, i) => rowHtml(f, r, i, kind, cols)).join('');
      return `<div class="page">
        <div class="page-header">
          <div class="od-fill" style="min-width:240px"><h1 class="page-title">Nhập xuất kho</h1><span class="page-sub">${esc(E.company().name)} · kỳ ${E.periodLabel(state.period)} · ghi sổ qua cùng bộ kiểm tra như màn Nhập chứng từ</span></div>
          <div class="page-actions"><button type="button" class="btn btn-outline" data-go="stock">${icon('warehouse')}Hàng hóa & kho</button></div>
        </div>
        <div class="seg stk-kinds" role="group" aria-label="Loại phiếu">${kinds.map((k) => `<button type="button" data-a="kind" data-k="${k}" aria-pressed="${kind === k}">${k}<span class="count">${esc(vt(k).name || E.TYPE_NAMES[k] || '')}</span></button>`).join('')}</div>
        <section class="card">
          <div class="card-head"><div class="od-fill"><span class="card-title">${esc(vt(kind).name || kind)} <span class="mono muted">${kind}</span></span><span class="card-sub">${esc(KIND_HINT[kind])}</span></div>${t.coLoNhap ? badge('info', 'Nhập theo lô') : ''}${t.coXuatKho ? badge('warning', 'Có xuất kho') : ''}</div>
          ${E.isLocked() ? `<div class="banner" style="border-radius:0">${icon('lock')}<span>Kỳ ${E.periodLabel(state.period)} đã khóa, không ghi được phiếu kho.</span></div>` : ''}
          <div class="card-body od-stack" style="--od-gap:16px">
            <div class="form-grid">
              <div class="field span-3"><label class="label" for="stk-date">Ngày chứng từ<span class="req">*</span></label><input id="stk-date" class="input" type="date" data-h="date" value="${esc(f.date)}" ${inv(f, 'date')}>${fieldErrs(f, 'date')}</div>
              ${needCp ? `<div class="field span-5"><label class="label" for="stk-cp">${kind === 'PNK' || kind === 'XTH' ? 'Nhà cung cấp' : 'Khách hàng'}<span class="req">*</span></label><input id="stk-cp" class="input" data-ac="cp" value="${esc(f.cp ? `${f.cp} · ${E.cpName(f.cp)}` : '')}" placeholder="Gõ mã, tên hoặc MST" ${inv(f, 'cp')}>${fieldErrs(f, 'cp')}</div>` : ''}
              ${kind === 'PNK' || kind === 'HDBR' ? `<div class="field span-4"><label class="label" for="stk-pay">${kind === 'PNK' ? 'TK ghi Có (thanh toán)' : 'TK ghi Nợ (thu tiền)'}</label><select id="stk-pay" class="select" data-h="pay">${(kind === 'PNK' ? PAY_PURCHASE : PAY_SALE).map(([v, l]) => opt(v, l, f.pay === v)).join('')}</select></div>` : ''}
              ${['PNK', 'HDBR', 'XTH'].includes(kind) ? `<div class="field span-3"><label class="label" for="stk-serial">Seri hóa đơn</label><input id="stk-serial" class="input mono" data-h="serial" value="${esc(f.serial)}" placeholder="1C27TAA" ${inv(f, 'serial')}>${fieldErrs(f, 'serial')}</div>
                <div class="field span-3"><label class="label" for="stk-no">Số hóa đơn</label><input id="stk-no" class="input mono" data-h="no" value="${esc(f.no)}" placeholder="0000457" ${inv(f, 'no')}>${fieldErrs(f, 'no')}</div>
                <div class="field span-3"><label class="label" for="stk-invdate">Ngày hóa đơn</label><input id="stk-invdate" class="input" type="date" data-h="invDate" value="${esc(f.invDate)}"></div>` : ''}
              ${kind === 'PXK' ? `<div class="field span-5"><label class="label" for="stk-dest">TK đích (ghi Nợ)</label><select id="stk-dest" class="select" data-h="dest">${PXK_DEST.map(([v, l]) => opt(v, l, f.dest === v)).join('')}</select></div>
                <div class="field span-4"><label class="label" for="stk-ct">Công trình, sản phẩm</label><select id="stk-ct" class="select" data-h="ct">${opt('', 'Không gắn đối tượng', !f.ct)}${d.costObjects.map((o) => opt(o.code, `${o.code} · ${o.name}`, f.ct === o.code)).join('')}${d.costObjects.length ? '' : d.projects.map((o) => opt(o.code, `${o.code} · ${o.name}`, f.ct === o.code)).join('')}</select></div>` : ''}
              ${kind === 'HTL' ? `<div class="field span-12"><label class="label" for="stk-orig">Hóa đơn bán ra gốc<span class="req">*</span></label><select id="stk-orig" class="select" data-h="orig" ${inv(f, 'orig')}>${opt('', origs.length ? 'Chọn phiếu HDBR đã ghi sổ' : 'Chưa có hóa đơn bán hàng nào để trả lại', !f.orig)}${origs.map((e) => opt(e.id, `${e.no} · ${dmy(e.date)} · ${e.desc}`, f.orig === e.id)).join('')}</select>${fieldErrs(f, 'orig')}</div>` : ''}
              <div class="field span-12"><label class="label" for="stk-desc">Diễn giải</label><input id="stk-desc" class="input" data-h="desc" value="${esc(f.desc)}" placeholder="Để trống thì dùng tên hàng"></div>
            </div>
            ${kind === 'HTL' && !info ? `<div class="empty"><span class="empty-title">Chọn hóa đơn gốc để lập phiếu trả lại</span><span class="empty-text">Số lượng trả tối đa bằng số đã bán trừ số đã trả. Giá nhập lại kho lấy đúng giá vốn đã xuất.</span></div>` : `
            <div class="table-wrap"><table class="tbl stk-rows"><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
            ${fieldErrs(f, 'rows')}
            ${kind !== 'HTL' ? `<div><button type="button" class="btn btn-outline" data-a="add-row">${icon('plus')}Thêm dòng</button></div>` : `<div class="form-grid"><div class="field span-3"><label class="label" for="stk-vr">Thuế suất hàng trả lại</label><select id="stk-vr" class="select" data-h="vatRate">${[0, 5, 8, 10].map((v) => opt(v, `${v}%`, (f.vatRate == null ? info.rate : f.vatRate) === v)).join('')}</select></div></div>`}`}
            ${kind === 'PNK' || kind === 'HDBR' ? `<div class="form-grid stk-extra">
              <div class="field span-3"><label class="label" for="stk-ckpct">Chiết khấu cả hóa đơn (%)</label><input id="stk-ckpct" class="input num" data-h="ckPct" inputmode="decimal" value="${f.ckPct ? esc(fmtQ(f.ckPct)) : ''}"></div>
              <div class="field span-3"><label class="label" for="stk-ckamt">Tiền chiết khấu (đ)</label><input id="stk-ckamt" class="input num" data-h="ckAmt" inputmode="numeric" value="${f.ckAmt ? esc(money(f.ckAmt)) : ''}"></div>
              <div class="field span-6"><label class="od-row" style="--od-gap:8px;margin-top:22px"><input type="checkbox" class="check" data-h="ckBefore" ${f.ckBefore ? 'checked' : ''}><span>CK trước thuế (giảm trực tiếp giá trị hàng). Bỏ chọn thì ${kind === 'PNK' ? 'ghi Nợ 331 / Có 711' : `ghi Nợ ${esc(E.rm().discount)} / Có công nợ`}</span></label></div>
              ${kind === 'PNK' ? `<div class="field span-3"><label class="label" for="stk-xcost">Chi phí mua hàng cần phân bổ (đ)</label><input id="stk-xcost" class="input num" data-h="xcost" inputmode="numeric" value="${f.xcost ? esc(money(f.xcost)) : ''}"></div>
              <div class="field span-3"><label class="label" for="stk-xacc">Trả bằng</label><select id="stk-xacc" class="select" data-h="xacc">${PAY_PURCHASE.map(([v, l]) => opt(v, l, f.xacc === v)).join('')}</select></div>
              <div class="field span-3"><label class="label" for="stk-xcp">Nhà vận chuyển</label><input id="stk-xcp" class="input" data-ac="xcp" value="${esc(f.xcp ? `${f.xcp} · ${E.cpName(f.xcp)}` : '')}" placeholder="Gõ tên hoặc mã" ${inv(f, 'xcp')}>${fieldErrs(f, 'xcp')}</div>
              <div class="field span-3"><label class="label" for="stk-xby">Phân bổ theo</label><select id="stk-xby" class="select" data-h="xby">${opt('value', 'Giá trị hàng', f.xby === 'value')}${opt('qty', 'Số lượng', f.xby === 'qty')}</select></div>` : ''}
            </div>` : ''}
            <div id="stk-errors" role="alert" class="od-stack" style="--od-gap:4px">${f.tried && f.errors.length ? f.errors.map((m) => `<div class="prop-err" style="padding:0">${icon('circle-x')}<span>${esc(m)}</span></div>`).join('') : ''}</div>
          </div>
          <div class="card-head" style="border-top:1px solid var(--ink-100);border-bottom:0"><div class="od-fill stk-sum" id="stk-sum"></div><button type="button" class="btn btn-outline" data-a="clear">${icon('x')}Làm lại</button><button type="button" class="btn" data-a="post" data-primary-action ${can ? '' : 'disabled'}>${icon('check')}Ghi sổ phiếu ${kind} <kbd>Ctrl S</kbd></button></div>
        </section>
        ${recentHtml()}
        ${lotsOn ? '' : ''}</div>`;
    },

    mount(host, params = {}) {
      const kinds = kindsActive();
      const kind = formOf._last && kinds.includes(formOf._last) ? formOf._last : kinds[0];
      const f = formOf(kind);
      const d = db();
      const t = vt(kind);
      const again = () => E.refresh({ kind });

      const updateOutputs = () => {
        f.cache = build(f);
        const set = (key, v) => { const el = host.querySelector(`[data-out="${key}"]`); if (el) el.textContent = v; };
        const stockLines = f.cache.lines.filter((l) => l.item && E.isStockAcc(l.cr) && l.dr !== undefined && !l.alloc);
        f.rows.forEach((r, i) => {
          const g = E.goodsOf(r.item);
          if (kind === 'HTL') {
            const info = origInfo(f.orig); const it = info && info.items[i]; if (!it) return;
            const q = Number(r.qty) || 0; const net = it.sold ? r0((it.net * q) / it.sold) : 0; const cost = it.costQty ? r0((it.cost * q) / it.costQty) : 0;
            set(`r${i}:amt`, q ? money(net) : ''); set(`r${i}:cost`, q ? money(cost) : ''); return;
          }
          if (!g) return;
          set(`r${i}:amt`, r.qty && r.price ? money(r0(r.qty * r.price)) : '');
          if (r.qty > 0 && r.wh) {
            const built = f.cache.lines.filter((l) => l.item === g.code && l.wh === r.wh && E.isStockAcc(l.cr) && !l.alloc);
            const l = built.shift(); const idx = f.rows.slice(0, i).filter((x) => x.item === r.item && x.wh === r.wh).length;
            const line = f.cache.lines.filter((x) => x.item === g.code && x.wh === r.wh && E.isStockAcc(x.cr) && !x.alloc)[idx] || l;
            const c = line ? line.amt : costWith(f.date, g.code, r.wh, r.qty, []);
            set(`r${i}:cost`, money(c));
            if (kind === 'HDBR') { const rev = r.price ? r0(r.qty * r.price) : 0; set(`r${i}:gm`, rev ? money(rev - c) : ''); }
          } else { set(`r${i}:cost`, ''); set(`r${i}:gm`, ''); }
        });
        const dr = f.cache.lines.reduce((s, l) => s + l.amt, 0);
        const sumEl = host.querySelector('#stk-sum');
        const vatTotal = f.cache.lines.filter((l) => l.dr === '1331' || l.cr === '33311' || (l.dr === '33311') || (l.cr === '1331')).reduce((s, l) => s + l.amt, 0);
        const goodsVal = sumByKind(f.cache.lines);
        if (sumEl) sumEl.innerHTML = `<span>${f.cache.lines.length} dòng hạch toán · tổng phát sinh <b class="mono">${money(dr)}</b> đ</span> · <span>giá trị kho <b class="mono">${money(goodsVal)}</b> đ</span>${vatTotal ? ` · <span>thuế <b class="mono">${money(vatTotal)}</b> đ</span>` : ''}`;
        void stockLines;
      };
      updateOutputs();

      /* autocompletes */
      const hookItem = (inp) => {
        const i = Number(inp.dataset.r);
        E.autocomplete(inp, {
          items: itemsAc, minWidth: 360,
          onPick: (it) => {
            const g = E.goodsOf(it.code); const r = f.rows[i];
            r.item = it.code; r.vat = null; if (!r.price) r.price = kind === 'PNK' ? g.buyPrice : 0;
            if (kind === 'XTH' && !r.price) r.price = g.buyPrice;
            if (kind === 'PXK' && g.tkKho === '155') f.dest = f.dest === '621' ? '632' : f.dest;
            again();
          },
        });
      };
      host.querySelectorAll('[data-ac="item"]').forEach(hookItem);
      const cpIn = host.querySelector('[data-ac="cp"]');
      if (cpIn) E.autocomplete(cpIn, { items: cpAc(kind === 'PNK' || kind === 'XTH' ? ['supplier', 'other'] : ['customer', 'other']), minWidth: 380, onPick: (it) => { f.cp = it.code; if (!f.desc) f.desc = ''; again(); } });
      const xcpIn = host.querySelector('[data-ac="xcp"]');
      if (xcpIn) E.autocomplete(xcpIn, { items: cpAc(['supplier', 'other']), minWidth: 380, onPick: (it) => { f.xcp = it.code; again(); } });

      const apply = (el) => {
        const hk = el.dataset.h; const rk = el.dataset.k;
        if (hk) {
          if (el.type === 'checkbox') f[hk] = el.checked;
          else if (['ckPct', 'ckAmt', 'xcost'].includes(hk)) f[hk] = parseNum(el.value);
          else if (hk === 'vatRate') f[hk] = Number(el.value);
          else f[hk] = el.value;
          return hk;
        }
        if (rk) {
          const r = f.rows[Number(el.dataset.r)];
          if (['qty', 'price'].includes(rk)) r[rk] = parseNum(el.value);
          else if (rk === 'vat') r.vat = Number(el.value);
          else r[rk] = el.value;
          return rk;
        }
        return null;
      };
      const total = () => f.rows.reduce((s, r) => s + r0((r.qty || 0) * (r.price || 0)), 0);
      host.addEventListener('input', (e) => {
        const key = apply(e.target); if (!key) return;
        if (key === 'ckPct') { f.ckAmt = r0((total() * f.ckPct) / 100); const el = host.querySelector('#stk-ckamt'); if (el) el.value = f.ckAmt ? money(f.ckAmt) : ''; }
        if (key === 'ckAmt') { const tt = total(); f.ckPct = tt ? Math.round((f.ckAmt / tt) * 10000) / 100 : 0; const el = host.querySelector('#stk-ckpct'); if (el) el.value = f.ckPct ? fmtQ(f.ckPct) : ''; }
        updateOutputs();
        if (f.tried) showErrors();
      });
      host.addEventListener('change', (e) => {
        const key = apply(e.target); if (!key) return;
        if (['qty', 'price', 'ckAmt', 'xcost'].includes(key)) { e.target.value = ['qty'].includes(key) ? (parseNum(e.target.value) ? fmtQ(parseNum(e.target.value)) : '') : (parseNum(e.target.value) ? money(parseNum(e.target.value)) : ''); updateOutputs(); return; }
        if (['wh', 'vat', 'whTo', 'dest', 'ct', 'xby', 'ckBefore', 'vatRate', 'pay', 'xacc', 'date', 'invDate', 'desc', 'serial', 'no', 'lot', 'exp'].includes(key)) {
          if (key === 'orig') return;
          if (key === 'lot' || key === 'exp' || key === 'wh' || key === 'date') { updateOutputs(); if (key === 'lot') again(); if (key === 'wh') updateOutputs(); return; }
          if (['pay', 'xacc', 'ckBefore', 'xby'].includes(key)) { updateOutputs(); return; }
          updateOutputs();
        }
        if (key === 'orig') { f.rows = []; again(); }
      });
      host.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('input.num, input.mono') && !e.target.closest('.pop')) { e.preventDefault(); const els = [...host.querySelectorAll('.stk-rows input, .stk-rows select')]; const n = els[els.indexOf(e.target) + 1]; if (n) n.focus(); }
      });

      const showErrors = () => {
        const el = host.querySelector('#stk-errors');
        if (el) el.innerHTML = f.errors.map((m) => `<div class="prop-err" style="padding:0">${icon('circle-x')}<span>${esc(m)}</span></div>`).join('');
      };

      const post = () => {
        if (!E.canWrite()) return;
        f.tried = true; f.cache = build(f);
        const errs = f.cache.errs.map((x) => x.msg);
        let list = [];
        if (!errs.length) list = E.validateLines(f.cache.lines, { period: f.date.slice(0, 7), date: f.date }).map((x) => x.msg);
        f.errors = [...new Set([...errs.length ? [`Còn ${errs.length} lỗi ở các ô đánh dấu đỏ, sửa rồi ghi lại.`] : [], ...list])];
        if (f.errors.length) { again(); const first = document.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }
        f.cache.rows.forEach(({ r, g }) => {
          if (g && g.lot && r.lot && !d.lots.some((l) => l.code === r.lot)) d.lots.push({ code: r.lot, item: g.code, wh: r.wh, expiry: r.exp });
        });
        const cpRec = E.cp(f.cp);
        const desc = f.desc || `${vt(kind).name}${cpRec ? ` – ${cpRec.name}` : ''}`;
        const en = E.postEntry({ type: kind, date: f.date, desc, lines: f.cache.lines, source: 'manual', ref: kind === 'HTL' ? f.orig : '', cp: f.cp || null });
        forms[`${state.companyId}|${kind}`] = blankForm(kind);
        E.refresh({ kind }); E.refreshChrome();
        E.toast(`Đã ghi phiếu ${en.no}`, { text: `${en.lines.length} dòng hạch toán, giá trị kho ${money(sumByKind(en.lines))} đ.`, action: { label: 'Xem thẻ kho', run: () => { const l = en.lines.find((x) => x.item); if (l) E.go('stock', { tab: 'card', item: l.item, wh: l.wh }); } } });
      };

      host.addEventListener('click', (e) => {
        const tg = e.target.closest('[data-a]');
        if (!tg || tg.disabled) return;
        const a = tg.dataset.a;
        if (a === 'kind') { formOf._last = tg.dataset.k; E.refresh({ kind: tg.dataset.k }); }
        else if (a === 'add-row') { f.rows.push(blankRow()); again(); }
        else if (a === 'del-row') { f.rows.splice(Number(tg.dataset.r), 1); if (!f.rows.length) f.rows.push(blankRow()); again(); }
        else if (a === 'clear') { forms[`${state.companyId}|${kind}`] = blankForm(kind); again(); }
        else if (a === 'post') post();
      });
      void t; void params;
    },

    onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); const b = document.querySelector('[data-a="post"]'); if (b) b.click(); }
    },
  };
})(window.EYN);
