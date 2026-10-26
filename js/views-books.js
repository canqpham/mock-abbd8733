/* Views: Hóa đơn điện tử, Import sao kê, Công nợ, Sổ sách & CĐPS, BCTC & Thuế GTGT. */
(function (E) {
  const { esc, icon, badge, money, dmy, state } = E;
  const d = () => E.db();
  const TODAY = '2027-01-31';
  const days = (iso) => Math.round((new Date(TODAY) - new Date(iso)) / 86400000);
  const inPeriod = (iso) => E.periodOf(iso) === state.period;
  const sub = () => `${esc(E.company().name)} · Kỳ ${E.periodLabel(state.period)}`;
  const emptyBox = (ic, title, text) => `<div class="empty">${icon(ic)}<span class="empty-title">${esc(title)}</span><span class="empty-text">${esc(text)}</span></div>`;
  const nz = (n) => (n ? money(n) : '');

  document.head.insertAdjacentHTML('beforeend', `<style>
    .map-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .check-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
    .item-mark { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--ink-300); display: grid; place-items: center; color: #fff; }
    .item-row.is-selected .item-mark { background: var(--ink-900); border-color: var(--ink-900); }
    .item-mark .od-icon { --od-icon-size: 12px; }
    .tbl tr.is-total td { font-weight: 600; color: var(--ink-900); background: var(--ink-50); }
    .tbl tr[data-id]:focus-visible td { background: var(--brand-50); }
    details.matched summary { cursor: pointer; padding: 10px 14px; font-size: 13px; color: var(--ink-500); }
    @media (max-width: 768px) { .map-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  </style>`);

  /* ======================= Hóa đơn điện tử (S07) ======================= */
  const INV_STATUS = { valid: ['success', 'Hợp lệ'], cancelled: ['danger', 'Đã hủy'] };
  const BOOK_STATUS = { posted: ['success', 'Đã ghi sổ'], proposed: ['warning', 'Chờ duyệt'], ignored: ['neutral', 'Bỏ qua'], new: ['info', 'Chưa xử lý'], rejected: ['neutral', 'Từ chối'] };

  function invoiceDialog(inv) {
    const party = E.cp(inv.party) || {};
    const st = E.invoiceStatus(inv);
    const entry = d().entries.find((e) => e.ref === inv.id);
    const prop = d().proposals.find((p) => p.doc && p.doc.kind === 'invoice' && p.doc.id === inv.id);
    const notes = [inv.sellerFlag, inv.cancelNote && `Hóa đơn đã hủy: ${inv.cancelNote}`, inv.ignored && `Bỏ qua: ${inv.ignored}`].filter(Boolean);
    const actions = [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }];
    if (st === 'proposed') actions.push({ label: 'Mở màn Duyệt', icon: 'inbox', run: () => E.go('review', { source: inv.dir }) });
    if (st === 'new' && inv.status === 'valid' && E.canWrite()) actions.splice(0, 0, { label: 'Bỏ qua hóa đơn', variant: 'btn-outline', icon: 'circle-minus', run: () => { setTimeout(() => ignoreDialog(inv), 30); } });
    E.openDialog({
      eyebrow: inv.dir === 'in' ? 'Hóa đơn mua vào' : 'Hóa đơn bán ra',
      title: `HĐ ${inv.no} · ${inv.serial}`,
      size: 'lg',
      body: `
        <div class="od-cluster">${badge(...INV_STATUS[inv.status])}${badge(...BOOK_STATUS[st])}${entry ? `<span class="muted">Bút toán <span class="mono">${esc(entry.no)}</span></span>` : ''}${prop && prop.entryNo ? `<span class="muted">Bút toán <span class="mono">${esc(prop.entryNo)}</span></span>` : ''}</div>
        ${notes.map((n) => `<p class="text-warning od-row">${icon('alert')}<span>${esc(n)}</span></p>`).join('')}
        <dl class="dl">
          <dt>${inv.dir === 'in' ? 'Người bán' : 'Người mua'}</dt><dd>${esc(party.name || inv.party)}</dd>
          <dt>MST</dt><dd class="mono">${esc(party.mst || '–')}</dd>
          <dt>Địa chỉ</dt><dd>${esc(party.address || '–')}</dd>
          <dt>Ngày hóa đơn</dt><dd class="mono">${dmy(inv.date)}</dd>
          <dt>Ký hiệu / Số</dt><dd class="mono">${esc(inv.serial)} / ${esc(inv.no)}</dd>
        </dl>
        <table class="doc-lines">
          <thead><tr><th>Tên hàng hóa, dịch vụ</th><th>ĐVT</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th></tr></thead>
          <tbody>${inv.items.map(([n, u, q, p]) => `<tr><td>${esc(n)}</td><td>${esc(u)}</td><td class="num">${q}</td><td class="num">${money(p)}</td><td class="num">${money(q * p)}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr><td colspan="4">Cộng tiền hàng</td><td class="num">${money(inv.net)}</td></tr>
            <tr><td colspan="4">Thuế GTGT ${inv.rate}%</td><td class="num">${money(inv.vat)}</td></tr>
            <tr><td colspan="4"><b>Tổng thanh toán</b></td><td class="num"><b>${money(inv.total)}</b></td></tr>
          </tfoot>
        </table>`,
      actions,
    });
  }

  function ignoreDialog(inv) {
    E.openDialog({
      eyebrow: `HĐ ${inv.no}`, title: 'Bỏ qua hóa đơn',
      body: `<div class="field"><label class="label" for="ign-reason">Lý do<span class="req">*</span></label>
        <textarea id="ign-reason" class="textarea" placeholder="Ví dụ: chi phí cá nhân, không hạch toán"></textarea>
        <span class="field-error" id="ign-err" hidden>Nhập lý do để người khác hiểu vì sao hóa đơn không vào sổ.</span></div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Bỏ qua hóa đơn', run: (api) => {
          const ta = api.el.querySelector('#ign-reason');
          const v = ta.value.trim();
          if (!v) { ta.setAttribute('aria-invalid', 'true'); api.el.querySelector('#ign-err').hidden = false; ta.focus(); return false; }
          inv.ignored = v;
          E.toast(`Đã bỏ qua HĐ ${inv.no}`, { icon: 'circle-minus' });
          E.refresh(state.route.params); E.refreshChrome();
          return undefined;
        },
      }],
    });
  }

  function syncInvoices(btn, tab) {
    btn.disabled = true; btn.classList.add('is-loading');
    btn.innerHTML = `${icon('loader')}Đang đồng bộ…`;
    setTimeout(() => {
      const db = d();
      const now = new Date();
      db.lastSync = `${TODAY} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (db.syncedOnce) {
        E.toast('Không có hóa đơn mới', { text: 'Đã khớp với dữ liệu hóa đơn trên CRM.', icon: 'refresh' });
      } else {
        db.syncedOnce = true;
        const id = E.uidp('inv');
        const net = 6500000; const vat = 650000;
        db.invoices.push({ id, dir: 'in', serial: '1C27THL', no: '0004633', date: '2027-01-30', party: 'NCC0008', rate: 10, net, vat, total: net + vat, items: [['Phí dịch vụ tòa nhà tháng 01/2027', 'tháng', 1, net]], status: 'valid' });
        db.proposals.push({ id: E.uidp('p'), type: 'HDMV', date: '2027-01-30', desc: 'Phí dịch vụ tòa nhà tháng 01/2027 – HĐ 0004633', cp: 'NCC0008', lines: [E.L('6422', '331', net, 'NCC0008', 'Tiền dịch vụ'), E.L('1331', '331', vat, 'NCC0008', 'Thuế GTGT 10%')], source: { kind: 'rule', label: 'Mặc định · HĐ mua vào', ruleId: 'r9' }, doc: { kind: 'invoice', id }, status: 'proposed', edited: false });
        E.toast('Đã đồng bộ 1 hóa đơn mới', { text: 'HĐ 0004633 · Tòa nhà Lạc Hồng, đã tạo đề xuất.', action: { label: 'Duyệt ngay', run: () => E.go('review', { source: 'in' }) } });
      }
      E.refreshChrome();
      E.refresh({ tab });
    }, 900);
  }

  E.views.invoices = {
    render(params) {
      const tab = params.tab || 'in';
      const all = d().invoices.filter((i) => inPeriod(i.date));
      const list = all.filter((i) => i.dir === tab).sort((a, z) => z.date.localeCompare(a.date));
      const st = (i) => E.invoiceStatus(i);
      const count = (f) => list.filter(f).length;
      const sum = (arr) => arr.reduce((s, i) => s + i.total, 0);
      const recon = [
        ['Hóa đơn trên CRM', all],
        ['Đã ghi sổ', all.filter((i) => st(i) === 'posted')],
        ['Chờ duyệt', all.filter((i) => st(i) === 'proposed')],
        ['Chưa xử lý', all.filter((i) => st(i) === 'new' && i.status === 'valid')],
        ['Bỏ qua', all.filter((i) => st(i) === 'ignored')],
        ['Đã hủy', all.filter((i) => i.status === 'cancelled')],
      ];
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Hóa đơn điện tử</h1><span class="page-sub">${sub()} · Đồng bộ gần nhất <span class="mono">${esc(d().lastSync)}</span></span></div>
          <div class="page-actions"><button type="button" class="btn" data-a="sync" ${E.isReadonly() ? 'disabled' : ''}>${icon('refresh')}Đồng bộ ngay</button></div>
        </div>
        <div class="stats" style="--cols:4">
          <div class="stat"><span class="stat-label">Tổng hóa đơn</span><span class="stat-value">${list.length}</span><span class="stat-note">${tab === 'in' ? 'Mua vào' : 'Bán ra'} trong kỳ</span></div>
          <div class="stat"><span class="stat-label">Đã ghi sổ</span><span class="stat-value">${count((i) => st(i) === 'posted')}</span><span class="stat-note mono">${money(sum(list.filter((i) => st(i) === 'posted')))} đ</span></div>
          <div class="stat"><span class="stat-label">Chờ duyệt</span><span class="stat-value">${count((i) => st(i) === 'proposed')}</span><span class="stat-note mono">${money(sum(list.filter((i) => st(i) === 'proposed')))} đ</span></div>
          <div class="stat"><span class="stat-label">Chưa xử lý / đã hủy</span><span class="stat-value">${count((i) => st(i) === 'new' && i.status === 'valid')} / ${count((i) => i.status === 'cancelled')}</span><span class="stat-note">Hóa đơn hủy không vào sổ</span></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="seg" role="group" aria-label="Loại hóa đơn">
              <button type="button" data-a="tab" data-tab="in" aria-pressed="${tab === 'in'}">Mua vào <span class="count">${all.filter((i) => i.dir === 'in').length}</span></button>
              <button type="button" data-a="tab" data-tab="out" aria-pressed="${tab === 'out'}">Bán ra <span class="count">${all.filter((i) => i.dir === 'out').length}</span></button>
            </div>
          </div>
          ${list.length ? `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>Ngày</th><th>Ký hiệu / Số</th><th>${tab === 'in' ? 'Người bán' : 'Người mua'}</th><th class="num">Thuế suất</th><th class="num">Tiền hàng</th><th class="num">Thuế</th><th class="num">Tổng</th><th>Hóa đơn</th><th>Sổ</th></tr></thead>
            <tbody>${list.map((i) => {
              const p = E.cp(i.party) || {};
              return `<tr class="is-click" data-a="open" data-id="${i.id}" tabindex="0">
                <td class="mono is-tight">${dmy(i.date)}</td>
                <td class="mono is-tight">${esc(i.serial)}<br><span class="strong">${esc(i.no)}</span></td>
                <td><span class="od-truncate" style="max-width:320px">${esc(p.name || i.party)}</span><span class="mono muted" style="font-size:12px">${esc(p.mst || 'Không có MST VN')}</span></td>
                <td class="num">${i.rate}%</td><td class="num">${money(i.net)}</td><td class="num">${money(i.vat)}</td><td class="num strong">${money(i.total)}</td>
                <td>${badge(...INV_STATUS[i.status])}</td><td>${badge(...BOOK_STATUS[st(i)])}</td></tr>`;
            }).join('')}</tbody>
            <tfoot><tr><td colspan="4">Cộng ${list.length} hóa đơn</td><td class="num">${money(list.reduce((s, i) => s + i.net, 0))}</td><td class="num">${money(list.reduce((s, i) => s + i.vat, 0))}</td><td class="num">${money(sum(list))}</td><td colspan="2"></td></tr></tfoot>
          </table></div>` : emptyBox('receipt', 'Chưa có hóa đơn trong kỳ', 'Bấm Đồng bộ ngay để lấy hóa đơn mới từ CRM. Job tự động chạy lúc 02:00 mỗi đêm.')}
        </div>
        <div class="card">
          <div class="card-head"><div><span class="card-title">Đối chiếu tháng: CRM ↔ sổ</span><span class="card-sub">Cả mua vào và bán ra, kỳ ${E.periodLabel(state.period)}</span></div></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Nhóm</th><th class="num">Số HĐ</th><th class="num">Tổng thanh toán</th></tr></thead>
            <tbody>${recon.map(([l, arr], i) => `<tr${i === 0 ? ' class="is-total"' : ''}><td>${esc(l)}</td><td class="num">${arr.length}</td><td class="num">${money(sum(arr))}</td></tr>`).join('')}</tbody></table></div>
        </div>
      </div>`;
    },
    mount(host, params) {
      const tab = params.tab || 'in';
      const open = (id) => invoiceDialog(d().invoices.find((i) => i.id === id));
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        if (t.dataset.a === 'tab') E.refresh({ tab: t.dataset.tab });
        if (t.dataset.a === 'open') open(t.dataset.id);
        if (t.dataset.a === 'sync') syncInvoices(t, tab);
      });
      host.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-id]')) { e.preventDefault(); open(e.target.dataset.id); } });
      if (params.sync) { const b = host.querySelector('[data-a="sync"]'); if (b && !b.disabled) syncInvoices(b, tab); }
    },
  };

  /* ======================= Import sao kê (S09) ======================= */
  const SAMPLE = [
    { date: '2027-01-30', content: 'CT CP DT BDS SONG HONG TT HD 0000087', dir: 'in', amt: 400000000, desc: 'Sông Hồng thanh toán một phần HĐ 0000087' },
    { date: '2027-01-30', content: 'PHI SMS BANKING T01/2027', dir: 'out', amt: 11000, desc: 'Phí SMS banking tháng 01/2027' },
    { date: '2027-01-31', content: 'TRA TIEN HD 00001245 THEP TAN PHAT', dir: 'out', amt: 201312000, desc: 'Thanh toán HĐ 00001245 – Thép Tân Phát' },
    { date: '2027-01-31', content: 'NOP TIEN MAT VAO TAI KHOAN', dir: 'in', amt: 30000000, desc: 'Nộp tiền mặt vào tài khoản' },
    { date: '2027-01-31', content: 'PHI CHUYEN TIEN', dir: 'out', amt: 22000, desc: 'Phí chuyển tiền' },
  ];
  const TEMPLATES = [['VCB', 'Vietcombank'], ['TCB', 'Techcombank'], ['MB', 'MB Bank'], ['ACB', 'ACB'], ['BIDV', 'BIDV']];
  const MAP_FIELDS = [['Ngày GD', 'A'], ['Nội dung', 'B'], ['Ghi nợ', 'D'], ['Ghi có', 'E'], ['Số dư', 'F']];
  const bankState = {};
  /* The statement file carries its own opening, per-row balances and closing; the check compares them with the ledger. */
  const balAt = (account, iso) => d().entries.filter((e) => e.status === 'posted' && e.date <= iso).reduce((n, e) => n + e.lines.reduce((x, l) => x + (l.dr === account ? l.amt : 0) - (l.cr === account ? l.amt : 0), 0), 0);
  function statement(account, variant) {
    const open = balAt(account, '2027-01-29');
    let run = open;
    const rows = SAMPLE.map((r) => { run += r.dir === 'in' ? r.amt : -r.amt; return { ...r, bal: run }; });
    const closing = variant === 'bad' ? run + 500000 : run;
    return { open, rows, closing };
  }
  function reconcile(account, variant) {
    const st = statement(account, variant);
    const tin = st.rows.filter((r) => r.dir === 'in').reduce((a, r) => a + r.amt, 0);
    const tout = st.rows.filter((r) => r.dir === 'out').reduce((a, r) => a + r.amt, 0);
    const calc = balAt(account, '2027-01-29') + tin - tout;
    return { ...st, tin, tout, calc, diff: st.closing - calc, ok: st.closing === calc };
  }
  const bs = () => (bankState[state.companyId] = bankState[state.companyId] || { step: 1, account: '11211', tpl: 'VCB', file: null });

  function suggest(r, account) {
    const t = E.fold(r.content);
    if (t.includes('phi')) return { type: 'CNH', dr: '6422', cr: account, cp: null, src: { kind: 'rule', label: 'Sao kê · Phí ngân hàng', ruleId: 'r5' } };
    if (t.includes('song hong')) return { type: 'TNH', dr: account, cr: '131', cp: 'KH0001', src: { kind: 'ai', label: 'AI', conf: 0.93, reason: 'Nội dung nhắc HĐ 0000087 của Sông Hồng; số tiền nhỏ hơn khoản còn phải thu nên ghi nhận thanh toán một phần.' } };
    if (t.includes('tan phat') || t.includes('thep')) return { type: 'UNC', dr: '331', cr: account, cp: 'NCC0001', src: { kind: 'ai', label: 'AI', conf: 0.9, reason: 'Nội dung nhắc HĐ 00001245 của Thép Tân Phát; số tiền bằng tổng thanh toán của hóa đơn.' } };
    if (t.includes('nop tien mat')) return { type: 'TNH', dr: account, cr: '1111', cp: null, src: { kind: 'ai', label: 'AI', conf: 0.88, reason: 'Nộp tiền mặt từ quỹ vào tài khoản ngân hàng.' } };
    return { type: r.dir === 'in' ? 'TNH' : 'CNH', dr: r.dir === 'in' ? account : '', cr: r.dir === 'in' ? '' : account, cp: null, src: { kind: 'manual', label: 'Chưa có rule' } };
  }

  function batches() {
    const map = {};
    d().proposals.filter((p) => p.batch).forEach((p) => {
      const b = (map[p.batch] = map[p.batch] || { id: p.batch, rows: 0, posted: 0, pending: 0, bank: p.doc && p.doc.bank, date: p.date });
      b.rows += 1; if (p.status === 'posted') b.posted += 1; if (p.status === 'proposed') b.pending += 1;
      if (p.date > b.date) b.date = p.date;
    });
    return Object.values(map).sort((a, z) => z.id.localeCompare(a.id));
  }

  E.views.bank = {
    render() {
      const s = bs();
      const db = d();
      const accName = (E.acc(s.account) || {}).name || s.account;
      const batchId = `${s.tpl}-02`;
      const rc = reconcile(s.account, s.variant);
      const { tin, tout } = rc;
      const steps = ['Chọn file', 'Xem trước & ánh xạ', 'Xác nhận'];
      const stepper = `<div class="wizard-steps">${steps.map((l, i) => `<span class="wstep ${s.step === i + 1 ? 'is-current' : s.step > i + 1 ? 'is-done' : ''}"><b>${s.step > i + 1 ? icon('check') : i + 1}</b>${esc(l)}</span>`).join('')}</div>`;
      let body = '';
      if (db.bankImported) {
        body = `<div class="card card-pad">${emptyBox('circle-check', `Lô ${db.bankImported} đã nhập`, 'Các dòng sao kê đã thành đề xuất. Duyệt chúng ở màn Duyệt đề xuất.')}
          <div class="od-row" style="justify-content:center"><button type="button" class="btn" data-go="review" data-params='${esc(JSON.stringify({ batch: db.bankImported }))}'>${icon('inbox')}Duyệt lô ${esc(db.bankImported)}</button></div></div>`;
      } else if (s.step === 1) {
        body = `<div class="card"><div class="card-body od-stack" style="--od-gap:16px">
          <div class="form-grid">
            <div class="field span-6"><label class="label" for="bk-acc">Tài khoản ngân hàng<span class="req">*</span></label>
              <select id="bk-acc" class="select" data-a="acc">${['11211', '11212'].map((c) => `<option value="${c}" ${s.account === c ? 'selected' : ''}>${c} · ${esc((E.acc(c) || {}).name)}</option>`).join('')}</select></div>
            <div class="field span-6"><label class="label" for="bk-tpl">Mẫu sao kê</label>
              <select id="bk-tpl" class="select" data-a="tpl">${TEMPLATES.map(([c, n]) => `<option value="${c}" ${s.tpl === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          </div>
          <label class="dropzone" id="bk-drop" for="bk-file">${icon('upload')}<span class="strong">Kéo thả file sao kê vào đây</span><span class="help">hoặc bấm để chọn file .xlsx, .xls, .csv</span>
            <input type="file" id="bk-file" accept=".xlsx,.xls,.csv" class="sr-only"></label>
          <div class="od-row"><span class="muted od-fill">Chưa có file trong máy?</span><button type="button" class="btn btn-outline" data-a="sample">${icon('sheet')}Dùng file mẫu sao_ke_${esc(s.tpl)}_T01_2027.xlsx</button><button type="button" class="btn btn-ghost" data-a="sample-bad">File mẫu lệch số dư</button></div>
        </div></div>`;
      } else if (s.step === 2) {
        body = `<div class="card">
          <div class="card-head"><div class="file-row od-fill">${icon('sheet')}<span class="od-fill"><span class="strong od-truncate">${esc(s.file)}</span><span class="help">${SAMPLE.length} dòng · ${esc(s.account)} ${esc(accName)}</span></span><button type="button" class="btn btn-ghost" data-a="back">Đổi file</button></div></div>
          <div class="card-body od-stack" style="--od-gap:12px">
            <span class="label">Ánh xạ cột</span>
            <div class="map-grid">${MAP_FIELDS.map(([f, col], i) => `<div class="field"><label class="label" for="map-${i}">${esc(f)}</label><select id="map-${i}" class="select">${'ABCDEF'.split('').map((c) => `<option ${c === col ? 'selected' : ''}>Cột ${c}</option>`).join('')}</select></div>`).join('')}</div>
            <div class="check-line">${rc.ok ? badge('success', 'Khớp', 'circle-check') : badge('danger', `Lệch ${money(Math.abs(rc.diff))}`, 'circle-alert')}<span>Số dư đầu <span class="mono">${money(rc.open)}</span> + thu <span class="mono">${money(tin)}</span> − chi <span class="mono">${money(tout)}</span> = <span class="mono">${money(rc.calc)}</span>; số dư cuối trong file <span class="mono strong">${money(rc.closing)}</span>${rc.ok ? '' : '. File sao kê sai số dư, kiểm tra lại file hoặc tải file khác.'}</span></div>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Ngày</th><th>Nội dung</th><th class="num">Thu</th><th class="num">Chi</th><th>Gợi ý định khoản</th><th>Trùng</th></tr></thead>
            <tbody>${SAMPLE.map((r) => { const g = suggest(r, s.account); return `<tr><td class="mono is-tight">${dmy(r.date)}</td><td class="mono">${esc(r.content)}</td><td class="num">${r.dir === 'in' ? money(r.amt) : ''}</td><td class="num">${r.dir === 'out' ? money(r.amt) : ''}</td>
              <td><span class="od-cluster" style="--od-gap:4px"><span class="acc-chip">${esc(g.dr || '?')}</span>/<span class="acc-chip">${esc(g.cr || '?')}</span>${g.cp ? `<span class="muted">${esc(E.cpName(g.cp))}</span>` : ''}</span><span class="help">${esc(g.src.kind === 'ai' ? `AI ${String(g.src.conf).replace('.', ',')}` : g.src.label)}</span></td>
              <td>${badge('neutral', 'Không')}</td></tr>`; }).join('')}</tbody>
          </table></div>
          <div class="list-foot"><button type="button" class="btn btn-outline" data-a="back">${icon('arrow-left')}Quay lại</button><span class="od-fill"></span><button type="button" class="btn" data-a="next" ${rc.ok ? '' : 'disabled'}>Tiếp tục${icon('arrow-right')}</button></div>
        </div>`;
      } else {
        body = `<div class="card"><div class="card-body od-stack" style="--od-gap:16px">
          <div class="stats" style="--cols:3">
            <div class="stat"><span class="stat-label">Số dòng</span><span class="stat-value">${SAMPLE.length}</span><span class="stat-note">Lô ${esc(batchId)}</span></div>
            <div class="stat"><span class="stat-label">Tổng thu</span><span class="stat-value">${money(tin)}</span><span class="stat-note">${SAMPLE.filter((r) => r.dir === 'in').length} dòng</span></div>
            <div class="stat"><span class="stat-label">Tổng chi</span><span class="stat-value">${money(tout)}</span><span class="stat-note">${SAMPLE.filter((r) => r.dir === 'out').length} dòng</span></div>
          </div>
          <p class="muted">Mỗi dòng thành một đề xuất chờ duyệt. Chưa có gì ghi vào sổ ở bước này.</p>
        </div>
        <div class="list-foot"><button type="button" class="btn btn-outline" data-a="back">${icon('arrow-left')}Quay lại</button><span class="od-fill"></span><button type="button" class="btn" data-a="commit" ${E.canWrite() ? '' : 'disabled'}>${icon('check')}Tạo ${SAMPLE.length} đề xuất</button></div></div>`;
      }
      const past = batches();
      return `<div class="page">
        <div class="page-header"><div><h1 class="page-title">Import sao kê</h1><span class="page-sub">${sub()}</span></div></div>
        ${db.bankImported ? '' : stepper}
        ${body}
        <div class="card">
          <div class="card-head"><span class="card-title">Các lô đã nhập</span></div>
          ${past.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Lô</th><th>Ngân hàng</th><th>Ngày cuối</th><th class="num">Số dòng</th><th class="num">Đã ghi sổ</th><th class="num">Chờ duyệt</th><th>Trạng thái</th></tr></thead>
            <tbody>${past.map((b) => `<tr class="is-click" data-go="review" data-params='${esc(JSON.stringify({ batch: b.id }))}'><td class="mono strong">${esc(b.id)}</td><td>${esc(b.bank || '')}</td><td class="mono">${dmy(b.date)}</td><td class="num">${b.rows}</td><td class="num">${b.posted}</td><td class="num">${b.pending}</td><td>${badge('success', 'Đã nhập')}</td></tr>`).join('')}</tbody></table></div>`
            : emptyBox('landmark', 'Chưa có lô nào', 'Lô sao kê đầu tiên sẽ hiện ở đây.')}
        </div>
      </div>`;
    },
    mount(host) {
      const s = bs();
      const loadFile = (name, variant = 'ok') => { s.file = name; s.variant = variant; s.step = 2; E.refresh({}); };
      host.addEventListener('change', (e) => {
        if (e.target.id === 'bk-acc') s.account = e.target.value;
        if (e.target.id === 'bk-tpl') { s.tpl = e.target.value; E.refresh({}); }
        if (e.target.id === 'bk-file' && e.target.files[0]) loadFile(e.target.files[0].name);
      });
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'sample') loadFile(`sao_ke_${s.tpl}_T01_2027.xlsx`);
        if (a === 'sample-bad') loadFile(`sao_ke_${s.tpl}_T01_2027_loi.xlsx`, 'bad');
        if (a === 'back') { s.step = Math.max(1, s.step - 1); E.refresh({}); }
        if (a === 'next') { s.step = 3; E.refresh({}); }
        if (a === 'commit') {
          const db = d();
          const batch = `${s.tpl}-02`;
          const bankName = (TEMPLATES.find(([c]) => c === s.tpl) || [])[1];
          SAMPLE.forEach((r) => {
            const g = suggest(r, s.account);
            db.proposals.push({ id: E.uidp('p'), type: g.type, date: r.date, desc: r.desc, cp: g.cp, lines: [E.L(g.dr, g.cr, r.amt, g.cp)], source: g.src, doc: { kind: 'bank', bank: bankName, account: s.account, dir: r.dir, amount: r.amt, content: r.content, date: r.date }, status: 'proposed', edited: false, batch });
          });
          db.bankImported = batch;
          s.step = 1; s.file = null;
          E.toast(`Đã tạo ${SAMPLE.length} đề xuất từ lô ${batch}`, { icon: 'circle-check' });
          E.go('review', { batch });
        }
      });
      const drop = host.querySelector('#bk-drop');
      if (drop) {
        ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
        ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
        drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) loadFile(f.name); });
      }
    },
  };

  /* ======================= Công nợ (S08) ======================= */
  const arSel = { key: '', D: null, C: null };
  const invSide = (acc) => (acc === '131' ? 'D' : 'C');

  function arRows(acc) {
    const items = d().items.filter((i) => i.acc === acc);
    const cps = [...new Set(items.map((i) => i.cp))];
    return cps.map((code) => {
      const its = items.filter((i) => i.cp === code);
      const dSum = its.filter((i) => i.side === 'D').reduce((s, i) => s + i.remaining, 0);
      const cSum = its.filter((i) => i.side === 'C').reduce((s, i) => s + i.remaining, 0);
      const bal = acc === '131' ? dSum - cSum : cSum - dSum;
      const aging = [0, 0, 0, 0];
      its.filter((i) => i.side === invSide(acc) && i.remaining > 0).forEach((i) => {
        const n = days(i.date);
        aging[n <= 30 ? 0 : n <= 60 ? 1 : n <= 90 ? 2 : 3] += i.remaining;
      });
      return { code, name: E.cpName(code), bal, aging, open: its.filter((i) => i.remaining > 0).length };
    }).sort((a, z) => z.bal - a.bal);
  }

  function doMatch(params) {
    const db = d();
    const a = db.items.find((i) => i.id === arSel.D);
    const b = db.items.find((i) => i.id === arSel.C);
    if (!a || !b) return;
    const amt = Math.min(a.remaining, b.remaining);
    a.remaining -= amt; b.remaining -= amt;
    a.matchedBy = b.matchedBy = 'manual';
    arSel.D = arSel.C = null;
    E.toast(`Đã khớp ${money(amt)} đ`, { text: `${a.ref} ↔ ${b.ref}`, icon: 'merge' });
    E.refresh(params); E.refreshChrome();
  }

  function autoMatch(acc, params) {
    const db = d();
    const paySide = acc === '131' ? 'C' : 'D';
    let n = 0;
    db.items.filter((p) => p.acc === acc && p.side === paySide && p.remaining > 0).forEach((p) => {
      const nums = (p.ref.match(/\d{5,}/g) || []);
      const inv = db.items.find((i) => i.acc === acc && i.cp === p.cp && i.side !== paySide && i.remaining > 0 && nums.some((x) => i.ref.includes(x)));
      if (!inv) return;
      const amt = Math.min(inv.remaining, p.remaining);
      inv.remaining -= amt; p.remaining -= amt;
      inv.matchedBy = p.matchedBy = 'auto_invoice';
      n += 1;
    });
    arSel.D = arSel.C = null;
    E.toast(n ? `Khớp tự động ${n} cặp` : 'Không có cặp nào khớp theo số hóa đơn', { icon: n ? 'merge' : 'info' });
    E.refresh(params); E.refreshChrome();
  }

  E.views.ar = {
    render(params) {
      const acc = params.acc || '131';
      const rows = arRows(acc);
      const cpCode = params.cp && rows.some((r) => r.code === params.cp) ? params.cp : (rows[0] || {}).code;
      const key = `${state.companyId}|${acc}|${cpCode}`;
      if (arSel.key !== key) { arSel.key = key; arSel.D = arSel.C = null; }
      const items = d().items.filter((i) => i.acc === acc && i.cp === cpCode);
      const write = E.canWrite();
      const total = rows.reduce((s, r) => s + r.bal, 0);
      const aging = [0, 1, 2, 3].map((k) => rows.reduce((s, r) => s + r.aging[k], 0));
      const itemCol = (side, title) => {
        const open = items.filter((i) => i.side === side && i.remaining > 0).sort((a, z) => a.date.localeCompare(z.date));
        const done = items.filter((i) => i.side === side && i.remaining === 0);
        return `<div class="card">
          <div class="card-head"><span class="card-title">${esc(title)}</span><span class="muted mono" style="margin-left:auto">${money(open.reduce((s, i) => s + i.remaining, 0))}</span></div>
          ${open.length ? open.map((i) => `<div class="item-row ${arSel[side] === i.id ? 'is-selected' : ''}" role="button" tabindex="0" aria-pressed="${arSel[side] === i.id}" data-a="pick" data-side="${side}" data-id="${i.id}" ${write ? '' : 'aria-disabled="true"'}>
              <span class="item-mark">${arSel[side] === i.id ? icon('check') : ''}</span>
              <span class="od-stack" style="--od-gap:0"><span class="od-truncate">${esc(i.ref)}</span><span class="help mono">${dmy(i.date)} · ${days(i.date)} ngày${i.remaining < i.amt ? ` · gốc ${money(i.amt)}` : ''}</span></span>
              <span class="num strong">${money(i.remaining)}</span></div>`).join('') : `<div class="empty" style="padding:24px">${icon('circle-check')}<span class="empty-text">Không còn khoản mở.</span></div>`}
          ${done.length ? `<details class="matched"><summary>Đã khớp (${done.length})</summary>${done.map((i) => `<div class="item-row is-matched"><span>${icon('check')}</span><span class="od-truncate">${esc(i.ref)}</span><span class="num">${money(i.amt)}</span></div>`).join('')}</details>` : ''}
        </div>`;
      };
      const selected = rows.find((r) => r.code === cpCode);
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Công nợ</h1><span class="page-sub">${sub()} · Tuổi nợ tính đến <span class="mono">${dmy(TODAY)}</span></span></div>
          <div class="page-actions">
            <div class="seg" role="group" aria-label="Tài khoản công nợ">${[['131', 'Phải thu 131'], ['331', 'Phải trả 331']].map(([c, l]) => `<button type="button" data-a="acc" data-acc="${c}" aria-pressed="${acc === c}">${l}</button>`).join('')}</div>
            <button type="button" class="btn btn-outline" data-a="export">${icon('download')}Xuất biên bản đối chiếu</button>
            <button type="button" class="btn" data-a="auto" ${write ? '' : 'disabled'}>${icon('merge')}Khớp tự động</button>
          </div>
        </div>
        <div class="card">
          ${rows.length ? `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>Đối tượng</th><th class="num">Số dư</th><th class="num">0–30 ngày</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">Trên 90</th><th class="num">Khoản mở</th></tr></thead>
            <tbody>${rows.map((r) => `<tr class="is-click" data-a="cp" data-cp="${r.code}" ${r.code === cpCode ? 'style="background:var(--brand-50)"' : ''}>
              <td><span class="strong">${esc(r.name)}</span> <span class="mono muted">${esc(r.code)}</span>${r.bal < 0 ? ` ${badge('warning', 'Dư ngược chiều', 'alert')}` : ''}</td>
              <td class="num strong">${E.signed(r.bal)}</td>${r.aging.map((a, k) => `<td class="num ${k === 3 && a ? 'text-danger' : ''}">${nz(a)}</td>`).join('')}<td class="num">${r.open}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>Cộng ${rows.length} đối tượng</td><td class="num">${E.signed(total)}</td>${aging.map((a) => `<td class="num">${nz(a)}</td>`).join('')}<td></td></tr></tfoot>
          </table></div>` : emptyBox('merge', 'Chưa có công nợ', 'Công nợ hiện ở đây khi có hóa đơn hoặc thanh toán ghi vào TK này.')}
        </div>
        ${selected ? `<div class="od-row" style="flex-wrap:wrap">
            <span class="section-title od-fill">${esc(selected.name)}</span>
            <span class="muted">Chọn một khoản mỗi bên rồi bấm Khớp hoặc <kbd>Enter</kbd></span>
            <button type="button" class="btn" data-a="match" ${write && arSel.D && arSel.C ? '' : 'disabled'}>${icon('merge')}Khớp</button>
          </div>
          <div class="match-cols">${itemCol('D', acc === '131' ? 'Phát sinh Nợ · hóa đơn' : 'Phát sinh Nợ · thanh toán')}${itemCol('C', acc === '131' ? 'Phát sinh Có · thanh toán' : 'Phát sinh Có · hóa đơn')}</div>` : ''}
      </div>`;
    },
    mount(host, params) {
      const acc = params.acc || '131';
      const pick = (el) => {
        if (!E.canWrite()) { E.toast('Kỳ đã khóa hoặc công ty chỉ đọc', { error: true }); return; }
        const side = el.dataset.side;
        arSel[side] = arSel[side] === el.dataset.id ? null : el.dataset.id;
        E.refresh(params);
        const again = document.querySelector(`.item-row[data-id="${el.dataset.id}"]`) || document.querySelector('[data-a="match"]');
        if (again) again.focus();
      };
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'acc') E.refresh({ acc: t.dataset.acc });
        if (a === 'cp') E.refresh({ acc, cp: t.dataset.cp });
        if (a === 'pick') pick(t);
        if (a === 'match') doMatch(params);
        if (a === 'auto') autoMatch(acc, params);
        if (a === 'export') E.downloadCsv(`cong-no-${params.acc || '131'}-${state.period}.csv`, E.tableRows(host.querySelector('table')));
      });
      host.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && e.target.matches('.item-row[data-id]') && !(e.key === 'Enter' && arSel.D && arSel.C)) { e.preventDefault(); pick(e.target); }
      });
    },
    onKey(e) {
      if (e.key === 'Enter' && arSel.D && arSel.C && E.canWrite() && !e.target.matches('input, textarea, select, button')) { e.preventDefault(); doMatch(state.route.params); }
    },
  };

  /* ======================= Sổ sách & CĐPS (S10) ======================= */
  const BOOK_TABS = [['journal', 'Nhật ký chung'], ['ledger', 'Sổ cái'], ['detail', 'Sổ chi tiết TK'], ['cash', 'Sổ quỹ tiền mặt'], ['tb', 'Cân đối phát sinh']];

  function entryDialog(id) {
    const e = d().entries.find((x) => x.id === id);
    if (!e) return;
    const canRev = E.canWrite() && !e.reversedBy && !['smartpro_import', 'reversal'].includes(e.source);
    const actions = [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }];
    if (canRev) actions.splice(0, 0, { label: 'Đảo bút toán', variant: 'btn-outline', icon: 'undo', run: () => { const r = E.reverseEntry(e.id); E.toast(`Đã tạo bút toán đảo ${r.no}`, { text: `Đảo ${e.no}. Bút toán gốc giữ nguyên trong sổ.`, icon: 'undo' }); E.refresh(state.route.params); E.refreshChrome(); } });
    const total = e.lines.reduce((s, l) => s + l.amt, 0);
    E.openDialog({
      eyebrow: E.TYPE_NAMES[e.type] || e.type, title: `${e.no} · ${dmy(e.date)}`, size: 'lg',
      body: `<div class="od-cluster">${badge('success', 'Đã ghi sổ', 'lock')}${e.reversedBy ? badge('neutral', `Đã đảo bởi ${e.reversedBy}`, 'undo') : ''}${e.source === 'reversal' ? badge('info', 'Bút toán đảo') : ''}</div>
        <dl class="dl"><dt>Diễn giải</dt><dd>${esc(e.desc)}</dd><dt>Người ghi</dt><dd>${esc(e.createdBy || '')}</dd><dt>Nguồn</dt><dd>${esc(e.source)}</dd></dl>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>TK Nợ</th><th>TK Có</th><th>Đối tượng</th><th>Diễn giải</th><th class="num">Số tiền</th></tr></thead>
          <tbody>${e.lines.map((l) => `<tr><td><span class="acc-chip">${esc(l.dr || '')}</span></td><td><span class="acc-chip">${esc(l.cr || '')}</span></td><td>${esc(E.cpName(l.cp))}</td><td>${esc(l.desc || '')}</td><td class="num">${money(l.amt)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">Cộng</td><td class="num">${money(total)}</td></tr></tfoot></table></div>
        ${e.reversedBy || !canRev ? '' : '<p class="help">Bút toán đã ghi sổ không sửa được. Muốn sửa thì đảo rồi nhập lại.</p>'}`,
      actions,
    });
  }

  function ledgerTable(prefix, cpCode, mode) {
    const l = E.ledger(prefix, state.period, cpCode);
    if (!l.rows.length && !l.open) return emptyBox('book-open', 'Không có số liệu', 'Tài khoản này chưa có số dư hay phát sinh trong kỳ.');
    const tD = l.rows.reduce((s, r) => s + r.d, 0);
    const tC = l.rows.reduce((s, r) => s + r.c, 0);
    const cash = mode === 'cash';
    return `<div class="table-wrap"><table class="tbl">
      <thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th>${cash ? '' : '<th>TK đối ứng</th>'}<th class="num">${cash ? 'Thu' : 'PS Nợ'}</th><th class="num">${cash ? 'Chi' : 'PS Có'}</th><th class="num">${cash ? 'Tồn' : 'Số dư'}</th></tr></thead>
      <tbody>
        <tr class="is-total"><td colspan="${cash ? 5 : 6}">Số dư đầu kỳ</td><td class="num">${E.signed(l.open)}</td></tr>
        ${l.rows.map((r) => `<tr class="is-click" data-id="${r.e.id}" tabindex="0" title="Nhấp đúp để mở chứng từ"><td class="mono is-tight">${dmy(r.e.date)}</td><td class="mono is-tight">${esc(r.e.no)}</td><td>${esc(r.l.desc ? `${r.e.desc} · ${r.l.desc}` : r.e.desc)}${!cash && r.l.cp && !cpCode ? `<span class="help">${esc(E.cpName(r.l.cp))}</span>` : ''}</td>${cash ? '' : `<td><span class="acc-chip">${esc(r.contra || '')}</span></td>`}<td class="num">${nz(r.d)}</td><td class="num">${nz(r.c)}</td><td class="num ${r.bal < 0 && cash ? 'text-danger' : ''}">${E.signed(r.bal)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="${cash ? 3 : 4}">Cộng phát sinh · Số dư cuối kỳ</td><td class="num">${money(tD)}</td><td class="num">${money(tC)}</td><td class="num">${E.signed(l.end)}</td></tr></tfoot>
    </table></div>`;
  }

  E.views.books = {
    render(params) {
      const tab = params.tab || 'journal';
      const db = d();
      let body = '';
      let toolbar = '';
      if (tab === 'journal') {
        const rows = db.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && inPeriod(e.date))
          .sort((a, z) => a.date.localeCompare(z.date) || a.no.localeCompare(z.no))
          .flatMap((e) => e.lines.map((l, i) => ({ e, l, first: i === 0 })));
        toolbar = `<div class="search-input" style="width:min(360px,100%)">${icon('search')}<input class="input" data-search data-a="filter" placeholder="Tìm số CT, diễn giải, TK (F7)" aria-label="Tìm trong nhật ký chung"></div>`;
        body = rows.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Ngày</th><th>Số CT</th><th>Loại</th><th>Diễn giải</th><th>TK Nợ</th><th>TK Có</th><th class="num">Số tiền</th></tr></thead>
          <tbody>${rows.map((r) => `<tr class="is-click" data-id="${r.e.id}" tabindex="0" data-text="${esc(`${r.e.no} ${r.e.desc} ${r.l.desc} ${r.l.dr} ${r.l.cr} ${E.cpName(r.l.cp)}`)}">
            <td class="mono is-tight">${dmy(r.e.date)}</td><td class="mono is-tight">${esc(r.e.no)}</td><td>${badge('neutral', r.e.type)}</td>
            <td>${esc(r.e.desc)}${r.l.desc ? `<span class="help">${esc(r.l.desc)}</span>` : ''}</td><td><span class="acc-chip">${esc(r.l.dr || '')}</span></td><td><span class="acc-chip">${esc(r.l.cr || '')}</span></td><td class="num">${money(r.l.amt)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="6">Cộng phát sinh (<span data-count>${rows.length}</span> dòng)</td><td class="num">${money(rows.reduce((s, r) => s + r.l.amt, 0))}</td></tr></tfoot>
        </table></div>` : emptyBox('book-open', 'Chưa có bút toán trong kỳ', 'Bút toán hiện ở đây sau khi chứng từ được duyệt hoặc ghi sổ.');
      } else if (tab === 'ledger' || tab === 'detail') {
        const code = params.acc || (tab === 'ledger' ? '131' : '11211');
        const a = E.acc(code);
        const cps = a && a.cp ? Object.keys((E.balances()[code] || { byCp: {} }).byCp) : [];
        const cpCode = tab === 'detail' && params.cp && cps.includes(params.cp) ? params.cp : null;
        toolbar = `<div class="field" style="width:min(320px,100%)"><label class="label" for="bk-accpick">Tài khoản</label><input id="bk-accpick" class="input mono" data-search value="${esc(code)}" placeholder="Gõ mã hoặc tên TK"></div>
          ${tab === 'detail' && cps.length ? `<div class="field" style="width:min(320px,100%)"><label class="label" for="bk-cp">Đối tượng</label><select id="bk-cp" class="select" data-a="cpsel"><option value="">Tất cả đối tượng</option>${cps.map((c) => `<option value="${c}" ${c === cpCode ? 'selected' : ''}>${esc(E.cpName(c))}</option>`).join('')}</select></div>` : ''}`;
        body = a ? `<div class="card-body" style="padding-bottom:0"><span class="strong">${esc(a.code)} · ${esc(a.name)}</span>${cpCode ? `<span class="muted"> · ${esc(E.cpName(cpCode))}</span>` : ''}${a.postable ? '' : '<span class="help">TK tổng hợp: gồm mọi TK chi tiết bên dưới.</span>'}</div>${ledgerTable(code, cpCode, 'ledger')}`
          : emptyBox('search', `Không có TK ${code}`, 'Chọn tài khoản khác trong hệ thống tài khoản.');
      } else if (tab === 'cash') {
        body = `<div class="card-body" style="padding-bottom:0"><span class="strong">1111 · Tiền Việt Nam</span></div>${ledgerTable('1111', null, 'cash')}`;
      } else {
        const level = params.level || 'top';
        const rows = E.trialBalance(state.period, level);
        const t = E.totals();
        const diff = (t.endD - t.endC) || (t.psD - t.psC) || (t.openD - t.openC);
        toolbar = `<div class="seg" role="group" aria-label="Cấp tài khoản">${[['top', 'Cấp 1'], ['detail', 'Chi tiết']].map(([v, l]) => `<button type="button" data-a="level" data-level="${v}" aria-pressed="${level === v}">${l}</button>`).join('')}</div>
          <span class="check-line">${diff ? badge('danger', `Chưa cân: lệch ${money(Math.abs(diff))}`, 'circle-alert') : badge('success', 'Đã cân', 'circle-check')}</span>`;
        body = rows.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>TK</th><th>Tên tài khoản</th><th class="num">Dư đầu Nợ</th><th class="num">Dư đầu Có</th><th class="num">PS Nợ</th><th class="num">PS Có</th><th class="num">Dư cuối Nợ</th><th class="num">Dư cuối Có</th></tr></thead>
          <tbody>${diff ? `<tr class="is-danger"><td colspan="8">Chưa cân: tổng Nợ khác tổng Có ${money(Math.abs(diff))} đ</td></tr>` : ''}
            ${rows.map((r) => `<tr class="is-click" data-a="tbrow" data-acc="${r.code}" tabindex="0"><td class="mono is-tight ${level === 'detail' ? `indent-${Math.min(r.depth, 2)}` : ''} ${r.postable ? '' : 'strong'}">${esc(r.code)}</td><td class="${r.postable && level === 'detail' ? '' : 'strong'}">${esc(r.name)}</td>
              <td class="num">${nz(r.openD)}</td><td class="num">${nz(r.openC)}</td><td class="num">${nz(r.psD)}</td><td class="num">${nz(r.psC)}</td><td class="num">${nz(r.endD)}</td><td class="num">${nz(r.endC)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">Tổng cộng</td><td class="num">${money(t.openD)}</td><td class="num">${money(t.openC)}</td><td class="num">${money(t.psD)}</td><td class="num">${money(t.psC)}</td><td class="num">${money(t.endD)}</td><td class="num">${money(t.endC)}</td></tr></tfoot>
        </table></div>` : emptyBox('scale', 'Chưa có số liệu', 'Bảng cân đối hiện khi có số dư hoặc phát sinh.');
      }
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">Sổ sách & CĐPS</h1><span class="page-sub">${sub()}</span></div>
          <div class="page-actions"><button type="button" class="btn btn-outline" data-a="export">${icon('download')}Xuất Excel</button></div>
        </div>
        <div class="card">
          <div class="tabs" role="tablist" style="padding:0 12px">${BOOK_TABS.map(([v, l]) => `<button type="button" role="tab" data-a="tab" data-tab="${v}" aria-selected="${tab === v}">${l}</button>`).join('')}</div>
          ${toolbar ? `<div class="card-body od-cluster" style="--od-gap:12px;align-items:flex-end">${toolbar}</div>` : ''}
          ${body}
        </div>
        <p class="help">Nhấp đúp một dòng hoặc nhấn <kbd>Enter</kbd> để mở chứng từ gốc. Bấm một TK trong CĐPS để mở sổ chi tiết.</p>
      </div>`;
    },
    mount(host, params) {
      const tab = params.tab || 'journal';
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'tab') E.refresh({ tab: t.dataset.tab });
        if (a === 'level') E.refresh({ tab: 'tb', level: t.dataset.level });
        if (a === 'tbrow') E.go('books', { tab: 'detail', acc: t.dataset.acc });
        if (a === 'export') E.downloadCsv(`so-sach-${tab}-${state.period}.csv`, E.tableRows(host.querySelector('table')));
      });
      host.addEventListener('dblclick', (e) => { const r = e.target.closest('tr[data-id]'); if (r) entryDialog(r.dataset.id); });
      host.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const r = e.target.closest('tr[data-id]');
        if (r) { e.preventDefault(); entryDialog(r.dataset.id); return; }
        const tb = e.target.closest('tr[data-a="tbrow"]');
        if (tb) { e.preventDefault(); E.go('books', { tab: 'detail', acc: tb.dataset.acc }); }
      });
      host.addEventListener('change', (e) => { if (e.target.id === 'bk-cp') E.refresh({ ...params, cp: e.target.value || null }); });
      const filter = host.querySelector('[data-a="filter"]');
      if (filter) {
        filter.addEventListener('input', () => {
          const q = filter.value;
          let n = 0;
          host.querySelectorAll('tbody tr[data-text]').forEach((tr) => { const show = !q || E.matches(tr.dataset.text, q); tr.hidden = !show; if (show) n++; });
          const c = host.querySelector('[data-count]'); if (c) c.textContent = n;
        });
      }
      const pick = host.querySelector('#bk-accpick');
      if (pick) {
        pick.dataset.acOnFocus = 'false';
        E.autocomplete(pick, {
          items: (q) => d().accounts.filter((a) => !q || E.matches(`${a.code} ${a.name}`, q)).map((a) => ({ code: a.code, name: a.name, meta: a.postable ? '' : 'TK tổng hợp' })),
          onPick: (it) => E.go('books', { tab, acc: it.code }),
        });
      }
    },
  };

  /* ======================= BCTC & Thuế GTGT (S11) ======================= */
  const RPT_TABS = [['b02', 'Kết quả kinh doanh'], ['b01', 'Tình hình tài chính'], ['b03', 'Lưu chuyển tiền tệ'], ['b09', 'Thuyết minh B09'], ['kho', 'Sổ kho, thẻ kho'], ['vat', 'Tờ khai 01/GTGT'], ['quy', 'Thuế theo quý']];

  /* Period movement excluding closing (KC) entries, so the P&L stays right after kết chuyển. */
  function flow(prefix, natural) {
    let dr = 0; let cr = 0;
    d().entries.forEach((e) => {
      if (e.status !== 'posted' || e.source === 'smartpro_import' || e.type === 'KC' || !inPeriod(e.date)) return;
      e.lines.forEach((l) => { if (l.dr && l.dr.startsWith(prefix)) dr += l.amt; if (l.cr && l.cr.startsWith(prefix)) cr += l.amt; });
    });
    return natural === 'C' ? cr - dr : dr - cr;
  }

  function sourceDialog(title, prefixes) {
    const rows = prefixes.flatMap((p) => E.ledger(p).rows.filter((r) => r.e.type !== 'KC').map((r) => ({ ...r, p })));
    E.openDialog({
      eyebrow: 'Chỉ tiêu tạo từ', title, size: 'lg',
      body: `<div class="od-cluster">${prefixes.map((p) => `<span class="acc-chip">${esc(p)}</span>`).join('')}<span class="muted">${prefixes.map((p) => (E.acc(p) || {}).name).filter(Boolean).map(esc).join(' · ')}</span></div>
        ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th>TK</th><th class="num">Nợ</th><th class="num">Có</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td class="mono">${dmy(r.e.date)}</td><td class="mono">${esc(r.e.no)}</td><td>${esc(r.e.desc)}</td><td><span class="acc-chip">${esc(r.p)}</span></td><td class="num">${nz(r.d)}</td><td class="num">${nz(r.c)}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">Không có phát sinh trong kỳ.</p>'}`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
    });
  }

  function invoiceListDialog(title, list) {
    E.openDialog({
      eyebrow: 'Chỉ tiêu tạo từ', title, size: 'lg',
      body: list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Số HĐ</th><th>Đối tượng</th><th class="num">Tiền hàng</th><th class="num">Thuế</th></tr></thead>
        <tbody>${list.map((i) => `<tr><td class="mono">${dmy(i.date)}</td><td class="mono">${esc(i.no)}</td><td>${esc(E.cpName(i.party))}</td><td class="num">${money(i.net)}</td><td class="num">${money(i.vat)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Không có hóa đơn đã ghi sổ trong kỳ.</p>',
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
    });
  }

  function b02() {
    const v = {};
    v['01'] = flow('511', 'C'); v['02'] = flow('521', 'D'); v['10'] = v['01'] - v['02'];
    v['11'] = flow('632', 'D'); v['20'] = v['10'] - v['11'];
    v['21'] = flow('515', 'C'); v['22'] = flow('635', 'D'); v['24'] = flow('642', 'D');
    v['30'] = v['20'] + v['21'] - v['22'] - v['24'];
    v['31'] = flow('711', 'C'); v['32'] = flow('811', 'D'); v['40'] = v['31'] - v['32'];
    v['50'] = v['30'] + v['40']; v['51'] = flow('821', 'D'); v['60'] = v['50'] - v['51'];
    const rows = [
      ['01', 'Doanh thu bán hàng và cung cấp dịch vụ', ['511']], ['02', 'Các khoản giảm trừ doanh thu', ['521']], ['10', 'Doanh thu thuần', null],
      ['11', 'Giá vốn hàng bán', ['632']], ['20', 'Lợi nhuận gộp', null], ['21', 'Doanh thu hoạt động tài chính', ['515']],
      ['22', 'Chi phí tài chính', ['635']], ['24', 'Chi phí quản lý kinh doanh', ['642']], ['30', 'Lợi nhuận thuần từ hoạt động kinh doanh', null],
      ['31', 'Thu nhập khác', ['711']], ['32', 'Chi phí khác', ['811']], ['40', 'Lợi nhuận khác', null],
      ['50', 'Tổng lợi nhuận kế toán trước thuế', null], ['51', 'Chi phí thuế TNDN', ['821']], ['60', 'Lợi nhuận sau thuế TNDN', null],
    ];
    const warn = v['01'] > 0 && v['11'] === 0 ? `<div class="banner" style="border-radius:0">${icon('alert')}<span>Có doanh thu nhưng giá vốn bằng 0. Chạy giá vốn ở màn Chốt sổ trước khi lập báo cáo.</span></div>` : '';
    return `${warn}<div class="table-wrap"><table class="tbl"><thead><tr><th>Chỉ tiêu</th><th>Mã số</th><th class="num">Kỳ ${E.periodLabel(state.period)}</th></tr></thead>
      <tbody>${rows.map(([c, l, src]) => `<tr class="${src ? 'is-click' : 'is-total'}" ${src && src.length ? `data-a="src" data-title="${esc(`${c} · ${l}`)}" data-src="${src.join(',')}" tabindex="0"` : ''}><td>${esc(l)}</td><td class="report-row-code">${c}</td><td class="num">${E.signed(v[c])}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function b01() {
    const top = Object.fromEntries(E.trialBalance(state.period, 'top').map((r) => [r.code, r]));
    const g = (c, k) => (top[c] ? top[c][k] : 0);
    const n = (p) => E.net(p);
    const pl = -['5', '63', '64', '7', '8', '9'].reduce((s, p) => s + n(p), 0);
    const A = [
      ['110', 'Tiền và các khoản tương đương tiền', n('111') + n('112'), ['111', '112']],
      ['131', 'Phải thu của khách hàng', g('131', 'endD'), ['131']],
      ['132', 'Trả trước cho người bán', g('331', 'endD'), ['331']],
      ['136', 'Phải thu khác, tạm ứng', n('1388') + n('141'), ['1388', '141']],
      ['141', 'Hàng tồn kho', n('152') + n('153') + n('154') + n('155') + n('156') + n('62'), ['152', '153', '154', '155', '156', '621', '622', '623', '627']],
      ['151', 'TSCĐ – nguyên giá', n('211'), ['211']],
      ['152', 'TSCĐ – giá trị hao mòn lũy kế', n('214'), ['214']],
      ['181', 'Thuế GTGT được khấu trừ', n('133'), ['133']],
      ['182', 'Chi phí trả trước', n('242'), ['242']],
    ];
    const N = [
      ['311', 'Phải trả người bán', g('331', 'endC'), ['331']],
      ['312', 'Người mua trả tiền trước', g('131', 'endC'), ['131']],
      ['313', 'Thuế và các khoản phải nộp Nhà nước', -n('333'), ['333']],
      ['314', 'Phải trả người lao động', -n('334'), ['334']],
      ['319', 'Phải trả khác', -n('338'), ['338']],
      ['411', 'Vốn góp của chủ sở hữu', -n('411'), ['411']],
      ['417', 'Lợi nhuận sau thuế chưa phân phối', -n('421') + pl, ['421']],
    ];
    const tA = A.reduce((s, r) => s + r[2], 0);
    const tN = N.reduce((s, r) => s + r[2], 0);
    const row = ([c, l, v, src]) => `<tr class="is-click" data-a="src" data-title="${esc(`${c} · ${l}`)}" data-src="${src.join(',')}" tabindex="0"><td class="indent-1">${esc(l)}</td><td class="report-row-code">${c}</td><td class="num">${E.signed(v)}</td></tr>`;
    return `<div class="card-body check-line">${tA === tN ? badge('success', 'Tổng tài sản = Tổng nguồn vốn', 'circle-check') : badge('danger', `Lệch ${money(Math.abs(tA - tN))}`, 'circle-alert')}${pl ? `<span class="muted">Lợi nhuận chưa kết chuyển <span class="mono">${E.signed(pl)}</span> đã cộng vào chỉ tiêu 417.</span>` : ''}</div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Chỉ tiêu</th><th>Mã số</th><th class="num">Cuối kỳ</th></tr></thead>
      <tbody><tr class="is-group"><td colspan="3">Tài sản</td></tr>${A.map(row).join('')}<tr class="is-total"><td>Tổng cộng tài sản</td><td class="report-row-code">200</td><td class="num">${money(tA)}</td></tr>
        <tr class="is-group"><td colspan="3">Nợ phải trả và vốn chủ sở hữu</td></tr>${N.map(row).join('')}<tr class="is-total"><td>Tổng cộng nguồn vốn</td><td class="report-row-code">500</td><td class="num">${money(tN)}</td></tr></tbody></table></div>`;
  }

  function vatData() {
    const posted = (dir) => d().invoices.filter((i) => i.dir === dir && i.status === 'valid' && inPeriod(i.date) && E.invoiceStatus(i) === 'posted');
    const inv = posted('in'); const out = posted('out');
    const v = {};
    v['22'] = 0; v['23'] = inv.reduce((s, i) => s + i.net, 0); v['24'] = E.net('1331', state.period, d(), 'psD'); v['25'] = v['24'];
    v['26'] = 0;
    const o5 = out.filter((i) => i.rate === 5); const o10 = out.filter((i) => i.rate !== 5);
    v['30'] = o5.reduce((s, i) => s + i.net, 0); v['31'] = o5.reduce((s, i) => s + i.vat, 0);
    v['32'] = o10.reduce((s, i) => s + i.net, 0); v['33'] = o10.reduce((s, i) => s + i.vat, 0);
    v['34'] = v['26'] + v['30'] + v['32']; v['35'] = v['31'] + v['33'];
    v['36'] = v['35'] - v['25'] - v['22'];
    v['40a'] = Math.max(v['36'], 0); v['43'] = Math.max(-v['36'], 0);
    return { v, inv, out };
  }

  function vatTab() {
    const { v, inv, out } = vatData();
    const ledgerOut = E.net('33311', state.period, d(), 'psC');
    const ledgerInInv = inv.reduce((s, i) => s + i.vat, 0);
    const rows = [
      ['22', 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang', null],
      ['23', 'Giá trị HHDV mua vào', 'in'], ['24', 'Thuế GTGT của HHDV mua vào', '1331'], ['25', 'Thuế GTGT được khấu trừ kỳ này', '1331'],
      ['26', 'HHDV bán ra không chịu thuế', null],
      ['30', 'HHDV bán ra chịu thuế suất 5% – giá trị', 'out'], ['31', 'Thuế GTGT 5%', 'out'],
      ['32', 'HHDV bán ra chịu thuế suất 10% – giá trị', 'out'], ['33', 'Thuế GTGT 10%', '33311'],
      ['34', 'Tổng doanh thu HHDV bán ra', 'out'], ['35', 'Tổng thuế GTGT của HHDV bán ra', '33311'],
      ['36', 'Thuế GTGT phát sinh trong kỳ', null], ['40a', 'Thuế GTGT phải nộp', null], ['43', 'Thuế GTGT còn được khấu trừ chuyển kỳ sau', null],
    ];
    const warns = [];
    if (ledgerOut !== v['35']) warns.push(['warning', `Sổ 33311 phát sinh ${money(ledgerOut)} đ khác bảng kê bán ra ${money(v['35'])} đ.`]);
    if (ledgerInInv !== v['24']) warns.push(['warning', `Sổ 1331 phát sinh ${money(v['24'])} đ khác bảng kê mua vào ${money(ledgerInInv)} đ.`]);
    ['3334', '3335'].forEach((c) => { const b = -E.net(c); if (b > 0) warns.push(['info', `Số dư Có TK ${c} ${money(b)} đ chưa nộp, lên chỉ tiêu 313 của B01.`]); });
    const listCard = (title, list) => `<div class="card"><div class="card-head"><span class="card-title">${esc(title)}</span><span class="muted" style="margin-left:auto">${list.length} hóa đơn</span></div>
      ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Ký hiệu / Số</th><th>Đối tượng</th><th>MST</th><th class="num">Thuế suất</th><th class="num">Tiền hàng</th><th class="num">Thuế</th></tr></thead>
        <tbody>${list.map((i) => `<tr><td class="mono">${dmy(i.date)}</td><td class="mono">${esc(i.serial)} / ${esc(i.no)}</td><td>${esc(E.cpName(i.party))}</td><td class="mono">${esc((E.cp(i.party) || {}).mst || '')}</td><td class="num">${i.rate}%</td><td class="num">${money(i.net)}</td><td class="num">${money(i.vat)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5">Cộng</td><td class="num">${money(list.reduce((s, i) => s + i.net, 0))}</td><td class="num">${money(list.reduce((s, i) => s + i.vat, 0))}</td></tr></tfoot></table></div>` : emptyBox('receipt', 'Chưa có hóa đơn đã ghi sổ', 'Duyệt hóa đơn ở màn Duyệt đề xuất để đưa vào bảng kê.')}</div>`;
    return `${warns.length ? `<div class="card-body od-stack">${warns.map(([t, m]) => `<span class="check-line">${badge(t, t === 'info' ? 'Lưu ý' : 'Cần kiểm tra', t === 'info' ? 'info' : 'alert')}<span>${esc(m)}</span></span>`).join('')}</div>` : ''}
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Chỉ tiêu</th><th>Mã</th><th class="num">Số tiền</th></tr></thead>
        <tbody>${rows.map(([c, l, src]) => `<tr class="${src ? 'is-click' : ['36', '40a', '43'].includes(c) ? 'is-total' : ''}" ${src ? `data-a="vatsrc" data-code="${c}" data-src="${src}" data-title="${esc(`[${c}] ${l}`)}" tabindex="0"` : ''}><td>${esc(l)}</td><td class="report-row-code">[${c}]</td><td class="num">${E.signed(v[c])}</td></tr>`).join('')}</tbody></table></div>
      <div class="card-body od-stack" style="--od-gap:16px">${listCard('Bảng kê hóa đơn mua vào', inv)}${listCard('Bảng kê hóa đơn bán ra', out)}</div>`;
  }

  E.views.reports = {
    render(params) {
      const tab = params.tab || 'b02';
      const extra = E.reportTabs[tab];
      const body = tab === 'b01' ? b01() : tab === 'vat' ? vatTab() : tab === 'b02' ? b02() : extra.render(params);
      const note = { b02: 'Mẫu B02-DNN · Thông tư 133', b01: 'Mẫu B01a-DNN rút gọn · Thông tư 133', vat: 'Mẫu 01/GTGT · khai theo tháng' }[tab] || extra.note;
      const title = (RPT_TABS.find(([v]) => v === tab) || [])[1];
      return `<div class="page">
        <div class="page-header">
          <div><h1 class="page-title">BCTC & Thuế GTGT</h1><span class="page-sub">${sub()} · ${esc(note)}</span></div>
          <div class="page-actions">
            <button type="button" class="btn btn-outline" data-a="print">${icon('printer')}In</button>
            <button type="button" class="btn" data-a="csv">${icon('download')}Xuất CSV</button>
          </div>
        </div>
        <div class="card" id="rpt-body">
          <div class="print-head"><h2>${esc(title)}</h2><p>${esc(E.company().name)} · MST ${esc(E.company().mst)} · kỳ ${E.periodLabel(state.period)}</p></div>
          <div class="tabs" role="tablist" style="padding:0 12px">${RPT_TABS.map(([v, l]) => `<button type="button" role="tab" data-a="tab" data-tab="${v}" aria-selected="${tab === v}">${l}</button>`).join('')}</div>
          ${body}
        </div>
        <p class="help">Bấm một chỉ tiêu để xem tài khoản và chứng từ tạo ra nó. Nhân viên tự nộp tờ khai qua eTax.</p>
      </div>`;
    },
    mount(host, params) {
      const tab = params.tab || 'b02';
      const open = (t) => {
        if (t.dataset.a === 'src') sourceDialog(t.dataset.title, t.dataset.src.split(','));
        if (t.dataset.a === 'vatsrc') {
          const { inv, out } = vatData();
          const s = t.dataset.src;
          if (s === 'in') invoiceListDialog(t.dataset.title, inv);
          else if (s === 'out') invoiceListDialog(t.dataset.title, t.dataset.code === '30' || t.dataset.code === '31' ? out.filter((i) => i.rate === 5) : out);
          else sourceDialog(t.dataset.title, [s]);
        }
      };
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'tab') E.refresh({ tab: t.dataset.tab });
        if (a === 'csv') {
          const rows = [[`${(RPT_TABS.find(([v]) => v === tab) || [])[1]} – ${E.company().name} – kỳ ${E.periodLabel(state.period)}`]];
          host.querySelectorAll('#rpt-body table').forEach((tb) => { rows.push([], ...E.tableRows(tb)); });
          E.downloadCsv(`${tab}-${E.company().mst}-${state.period}.csv`, rows);
        }
        if (a === 'print') E.printPage(`${(RPT_TABS.find(([v]) => v === tab) || [])[1]} ${E.periodLabel(state.period)}`);
        open(t);
      });
      host.addEventListener('keydown', (e) => { const t = e.target.closest('tr[data-a="src"], tr[data-a="vatsrc"]'); if (t && e.key === 'Enter') { e.preventDefault(); open(t); } });
      const ex = E.reportTabs[tab]; if (ex && ex.mount) ex.mount(host, params);
    },
  };
})(window.EYN);
