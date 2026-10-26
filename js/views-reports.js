/* Extra reports for the BCTC & Thuế screen: B03, B09, Sổ kho / Thẻ kho, tờ khai thuế theo quý. Rendered by E.views.reports. */
(function (E) {
  const { esc, icon, badge, money, dmy, state } = E;
  const d = () => E.db();
  E.reportTabs = {};

  const signed = (n) => (n ? E.signed(n) : '–');
  const emptyBox = (ic, title, text) => `<div class="empty">${icon(ic)}<span class="empty-title">${esc(title)}</span><span class="empty-text">${esc(text)}</span></div>`;
  const posted = (from, to) => d().entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && e.date >= from && e.date <= to);
  const bal = (prefix) => { const end = E.net(prefix); const ps = E.net(prefix, state.period, d(), 'ps'); return { open: end - ps, end, ps, psD: E.net(prefix, state.period, d(), 'psD'), psC: E.net(prefix, state.period, d(), 'psC') }; };

  /* Sum of Nợ (natural D) or Có (natural C) movement for a prefix in a date range, closing entries excluded. */
  function flowR(prefix, natural, from, to) {
    let dr = 0; let cr = 0;
    posted(from, to).forEach((e) => { if (e.type === 'KC') return; e.lines.forEach((l) => { if (l.dr && l.dr.startsWith(prefix)) dr += l.amt; if (l.cr && l.cr.startsWith(prefix)) cr += l.amt; }); });
    return natural === 'C' ? cr - dr : dr - cr;
  }

  /* ======================= B03: lưu chuyển tiền tệ, phương pháp trực tiếp ======================= */
  const CF_LABELS = {
    '01': 'Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác', '02': 'Tiền chi trả cho người cung cấp hàng hóa và dịch vụ', '03': 'Tiền chi trả cho người lao động', '04': 'Tiền lãi vay đã trả',
    '05': 'Thuế thu nhập doanh nghiệp đã nộp', '06': 'Tiền thu khác từ hoạt động kinh doanh', '07': 'Tiền chi khác cho hoạt động kinh doanh',
    '21': 'Tiền chi để mua sắm, xây dựng TSCĐ và tài sản dài hạn khác', '22': 'Tiền thu từ thanh lý, nhượng bán TSCĐ', '27': 'Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia',
    '31': 'Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu', '32': 'Tiền trả lại vốn góp cho chủ sở hữu', '33': 'Tiền thu từ đi vay', '34': 'Tiền trả nợ gốc vay',
  };
  const CF_IN = [[/^(131|511|521|333)/, '01'], [/^515/, '27'], [/^411/, '31'], [/^341/, '33'], [/^(211|214|2111)/, '22']];
  const CF_OUT = [[/^3334/, '05'], [/^333/, '07'], [/^334/, '03'], [/^635/, '04'], [/^(211|241)/, '21'], [/^341/, '34'], [/^411/, '32'], [/^(141|138|338|811)/, '07'], [/^(331|15|133|6)/, '02']];
  const classify = (table, acc, dflt) => { const hit = table.find(([re]) => re.test(acc)); return hit ? hit[1] : dflt; };

  function cashFlow() {
    const from = `${state.period}-01`; const to = E.lastDay(state.period);
    const isCash = (c) => /^11[12]/.test(c || '');
    const sums = {}; const detail = {};
    posted(from, to).forEach((e) => e.lines.forEach((l) => {
      const inC = isCash(l.dr); const outC = isCash(l.cr);
      if (inC === outC) return;
      const code = inC ? classify(CF_IN, l.cr || '', '06') : classify(CF_OUT, l.dr || '', '07');
      const amt = inC ? l.amt : -l.amt;
      sums[code] = (sums[code] || 0) + amt;
      (detail[code] = detail[code] || []).push({ e, l, amt });
    }));
    const open = bal('111').open + bal('112').open; const close = E.net('111') + E.net('112');
    const sec = (codes) => codes.reduce((s, c) => s + (sums[c] || 0), 0);
    const t20 = sec(['01', '02', '03', '04', '05', '06', '07']); const t30 = sec(['21', '22', '27']); const t40 = sec(['31', '32', '33', '34']);
    return { sums, detail, open, close, t20, t30, t40, t50: t20 + t30 + t40 };
  }

  function cashDialog(code) {
    const cf = cashFlow(); const rows = cf.detail[code] || [];
    E.openDialog({
      eyebrow: 'Chỉ tiêu tạo từ', title: `${code} · ${CF_LABELS[code]}`, size: 'lg',
      body: rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th>TK đối ứng</th><th class="num">Số tiền</th></tr></thead><tbody>${rows.map(({ e, l, amt }) => `<tr><td class="mono">${dmy(e.date)}</td><td class="mono">${esc(e.no)}</td><td>${esc(l.desc || e.desc)}</td><td><span class="acc-chip">${esc(amt > 0 ? l.cr : l.dr)}</span></td><td class="num">${E.signed(amt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Không có phát sinh tiền trong kỳ.</p>',
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
    });
  }

  E.reportTabs.b03 = {
    label: 'Lưu chuyển tiền tệ', note: 'Mẫu B03-DNN · phương pháp trực tiếp',
    render() {
      const cf = cashFlow();
      const line = (code) => `<tr class="is-click" tabindex="0" data-a="cash" data-code="${code}"><td class="indent-1">${esc(CF_LABELS[code])}</td><td class="report-row-code">${code}</td><td class="num">${signed(cf.sums[code])}</td></tr>`;
      const total = (code, label, v) => `<tr class="is-total"><td>${esc(label)}</td><td class="report-row-code">${code}</td><td class="num">${E.signed(v)}</td></tr>`;
      const ok = cf.open + cf.t50 === cf.close;
      return `<div class="card-body check-line">${ok ? badge('success', 'Khớp', 'circle-check') : badge('danger', `Lệch ${money(Math.abs(cf.open + cf.t50 - cf.close))}`, 'circle-alert')}<span>Tiền đầu kỳ <span class="mono">${money(cf.open)}</span> + lưu chuyển thuần <span class="mono">${E.signed(cf.t50)}</span> = <span class="mono">${money(cf.open + cf.t50)}</span>; tiền cuối kỳ trên sổ (111 + 112) <span class="mono strong">${money(cf.close)}</span>. Chuyển quỹ ↔ ngân hàng được loại trừ.</span></div>
        <div class="table-wrap"><table class="tbl" id="rpt-b03"><thead><tr><th>Chỉ tiêu</th><th>Mã số</th><th class="num">Kỳ ${E.periodLabel(state.period)}</th></tr></thead><tbody>
        <tr class="is-group"><td colspan="3">I. Lưu chuyển tiền từ hoạt động kinh doanh</td></tr>${['01', '02', '03', '04', '05', '06', '07'].map(line).join('')}${total('20', 'Lưu chuyển tiền thuần từ hoạt động kinh doanh', cf.t20)}
        <tr class="is-group"><td colspan="3">II. Lưu chuyển tiền từ hoạt động đầu tư</td></tr>${['21', '22', '27'].map(line).join('')}${total('30', 'Lưu chuyển tiền thuần từ hoạt động đầu tư', cf.t30)}
        <tr class="is-group"><td colspan="3">III. Lưu chuyển tiền từ hoạt động tài chính</td></tr>${['31', '32', '33', '34'].map(line).join('')}${total('40', 'Lưu chuyển tiền thuần từ hoạt động tài chính', cf.t40)}
        ${total('50', 'Lưu chuyển tiền thuần trong kỳ', cf.t50)}${total('60', 'Tiền và tương đương tiền đầu kỳ', cf.open)}${total('70', 'Tiền và tương đương tiền cuối kỳ', cf.open + cf.t50)}
        </tbody></table></div>`;
    },
    mount(host) {
      const open = (t) => cashDialog(t.dataset.code);
      host.addEventListener('click', (e) => { const t = e.target.closest('[data-a="cash"]'); if (t) open(t); });
      host.addEventListener('keydown', (e) => { const t = e.target.closest('tr[data-a="cash"]'); if (t && e.key === 'Enter') { e.preventDefault(); open(t); } });
    },
  };

  /* ======================= B09: thuyết minh dạng khung có số liệu liên kết ======================= */
  E.reportTabs.b09 = {
    label: 'Thuyết minh B09', note: 'Mẫu B09-DNN · khung thuyết minh, số liệu lấy từ sổ',
    render() {
      const dd = d(); const c = E.company(); const rm = E.rm();
      const methods = dd.goods.reduce((a, g) => { a[g.method] = (a[g.method] || 0) + 1; return a; }, {});
      const methodName = { BQGQ: 'bình quân gia quyền cuối kỳ', BQDD: 'bình quân di động', FIFO: 'nhập trước xuất trước' };
      const row = (label, accs, extra = {}) => {
        const o = accs.reduce((s, a) => s + bal(a).open, 0); const e = accs.reduce((s, a) => s + bal(a).end, 0);
        return `<tr class="is-click" tabindex="0" data-a="src" data-title="${esc(label)}" data-src="${accs.join(',')}"><td class="indent-1">${esc(label)}</td><td class="num">${signed(extra.neg ? -o : o)}</td><td class="num">${signed(extra.neg ? -e : e)}</td></tr>`;
      };
      const table = (title, head, rows) => `<div class="card-body od-stack" style="--od-gap:8px"><span class="label">${esc(title)}</span><div class="table-wrap"><table class="tbl" data-b09><thead><tr><th>${esc(head)}</th><th class="num">Đầu kỳ</th><th class="num">Cuối kỳ</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
      const fa = bal('211'); const dep = bal('214');
      const text = (h, p) => `<div class="card-body od-stack" style="--od-gap:4px"><span class="label">${esc(h)}</span><p>${p}</p></div>`;
      return `${text('I. Đặc điểm hoạt động của doanh nghiệp', `${esc(c.name)} (MST ${esc(c.mst)}), ngành ${esc(c.industry)}, hình thức sở hữu: công ty trách nhiệm hữu hạn hoặc cổ phần theo giấy chứng nhận đăng ký doanh nghiệp.`)}
        ${text('II. Kỳ kế toán, đơn vị tiền tệ', `Năm tài chính bắt đầu 01/01, kết thúc 31/12. Báo cáo kỳ ${E.periodLabel(state.period)}. Đơn vị tiền tệ: đồng Việt Nam (VND), không ghi số lẻ.`)}
        ${text('III. Chuẩn mực và chế độ kế toán áp dụng', `Chế độ kế toán doanh nghiệp theo ${esc(rm.label)}. Mã tài khoản dùng cho thuế TNDN ${esc(rm.cit)}, giảm trừ doanh thu ${esc(rm.revDeduct.join(', '))}, bảo hiểm thất nghiệp ${esc(rm.bhtn)}.`)}
        ${text('IV. Chính sách kế toán áp dụng', `Hàng tồn kho tính giá xuất theo ${Object.entries(methods).map(([m, n]) => `${methodName[m]} (${n} mặt hàng)`).join(', ') || 'chưa khai báo'}. TSCĐ và chi phí trả trước khấu hao, phân bổ theo đường thẳng. Thuế TNDN tạm tính theo thuế suất ${esc(String(dd.opt.citRate))}%.`)}
        <div class="card-body"><span class="label">V. Thông tin bổ sung cho các khoản mục trên báo cáo</span></div>
        ${table('1. Tiền', 'Khoản mục', `${row('Tiền mặt', ['111'])}${row('Tiền gửi ngân hàng', ['112'])}`)}
        ${table('2. Phải thu của khách hàng', 'Khoản mục', row('Phải thu khách hàng', ['131']))}
        ${table('3. Hàng tồn kho', 'Khoản mục', `${row('Nguyên liệu, vật liệu', ['152'])}${row('Công cụ, dụng cụ', ['153'])}${row('Chi phí SXKD dở dang', ['154'])}${row('Thành phẩm', ['155'])}${row('Hàng hóa', ['156'])}`)}
        <div class="card-body"><button type="button" class="btn btn-ghost" data-go="stock">${icon('warehouse')}Mở tồn kho chi tiết</button></div>
        ${table('4. Tài sản cố định hữu hình', 'Khoản mục', `<tr><td class="indent-1">Nguyên giá</td><td class="num">${signed(fa.open)}</td><td class="num">${signed(fa.end)}</td></tr><tr><td class="indent-2">Tăng trong kỳ</td><td class="num"></td><td class="num">${signed(fa.psD)}</td></tr><tr><td class="indent-2">Giảm trong kỳ</td><td class="num"></td><td class="num">${signed(fa.psC)}</td></tr><tr><td class="indent-1">Giá trị hao mòn lũy kế</td><td class="num">${signed(-dep.open)}</td><td class="num">${signed(-dep.end)}</td></tr><tr class="is-total"><td>Giá trị còn lại</td><td class="num">${signed(fa.open + dep.open)}</td><td class="num">${signed(fa.end + dep.end)}</td></tr>`)}
        ${table('5. Chi phí trả trước', 'Khoản mục', row('Chi phí trả trước', ['242']))}
        ${table('6. Phải trả người bán', 'Khoản mục', row('Phải trả người bán', ['331'], { neg: true }))}
        ${table('7. Thuế và các khoản phải nộp Nhà nước', 'Khoản mục', `${row('Thuế GTGT phải nộp', ['3331'], { neg: true })}${row('Thuế TNDN', ['3334'], { neg: true })}${row('Thuế thu nhập cá nhân', ['3335'], { neg: true })}`)}
        ${table('8. Phải trả người lao động và bảo hiểm', 'Khoản mục', `${row('Phải trả người lao động', ['334'], { neg: true })}${row('Kinh phí công đoàn', ['3382'], { neg: true })}${row('Bảo hiểm xã hội', ['3383'], { neg: true })}${row('Bảo hiểm y tế', ['3384'], { neg: true })}${row('Bảo hiểm thất nghiệp', [rm.bhtn], { neg: true })}`)}
        ${table('9. Vốn chủ sở hữu', 'Khoản mục', `${row('Vốn góp của chủ sở hữu', ['4111'], { neg: true })}${row('Lợi nhuận sau thuế chưa phân phối', ['421'], { neg: true })}`)}
        <div class="card-body od-stack" style="--od-gap:8px"><span class="label">10. Doanh thu và chi phí kỳ ${E.periodLabel(state.period)} (không gồm bút toán kết chuyển)</span><div class="table-wrap"><table class="tbl" data-b09><thead><tr><th>Khoản mục</th><th class="num">Số tiền</th></tr></thead><tbody>
          ${[['Doanh thu bán hàng hóa', '5111', 'C'], ['Doanh thu bán thành phẩm', '5112', 'C'], ['Doanh thu cung cấp dịch vụ', '5113', 'C'], ['Các khoản giảm trừ doanh thu', '521', 'D'], ['Giá vốn hàng bán', '632', 'D'], ['Chi phí quản lý kinh doanh', '642', 'D'], ['Doanh thu hoạt động tài chính', '515', 'C'], ['Chi phí thuế TNDN', rm.cit, 'D']].map(([l, a, n]) => `<tr class="is-click" tabindex="0" data-a="src" data-title="${esc(l)}" data-src="${a}"><td class="indent-1">${esc(l)}</td><td class="num">${signed(flowR(a, n, `${state.period}-01`, E.lastDay(state.period)))}</td></tr>`).join('')}
        </tbody></table></div></div>`;
    },
  };

  /* ======================= Sổ kho, thẻ kho ======================= */
  E.reportTabs.kho = {
    label: 'Sổ kho, thẻ kho', note: 'Sổ chi tiết vật tư, hàng hóa · thẻ kho',
    render(params) {
      const dd = d(); const mode = params.mode || 'card';
      const item = dd.goods.find((g) => g.code === params.item) || dd.goods[0];
      const wh = (dd.warehouses.find((w) => w.code === params.wh) || dd.warehouses[0] || {}).code;
      if (!item) return emptyBox('warehouse', 'Chưa có hàng hóa', 'Thêm vật tư hàng hóa ở màn Hàng hóa & kho.');
      const ctl = `<div class="card-body"><div class="od-cluster" style="--od-gap:12px;align-items:end">
        <div class="field"><label class="label" for="rk-mode">Loại sổ</label><select id="rk-mode" class="select" data-rk="mode"><option value="card" ${mode === 'card' ? 'selected' : ''}>Thẻ kho (chi tiết)</option><option value="sum" ${mode === 'sum' ? 'selected' : ''}>Tổng hợp nhập xuất tồn</option></select></div>
        ${mode === 'card' ? `<div class="field"><label class="label" for="rk-item">Hàng hóa</label><select id="rk-item" class="select" data-rk="item">${dd.goods.map((g) => `<option value="${esc(g.code)}" ${g.code === item.code ? 'selected' : ''}>${esc(g.code)} · ${esc(g.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="label" for="rk-wh">Kho</label><select id="rk-wh" class="select" data-rk="wh">${dd.warehouses.map((w) => `<option value="${esc(w.code)}" ${w.code === wh ? 'selected' : ''}>${esc(w.code)} · ${esc(w.name)}</option>`).join('')}</select></div>` : ''}</div></div>`;
      if (mode === 'sum') {
        const t = E.stockTable(state.period).filter((r) => r.openQty || r.inQty || r.outQty || r.endQty);
        const g = (code) => E.goodsOf(code);
        const tot = t.reduce((a, r) => ({ ov: a.ov + r.openVal, iv: a.iv + r.inVal, xv: a.xv + r.outVal, ev: a.ev + r.endVal }), { ov: 0, iv: 0, xv: 0, ev: 0 });
        return `${ctl}<div class="table-wrap"><table class="tbl" id="rpt-kho"><thead><tr><th>Mã hàng</th><th>Tên</th><th>Kho</th><th>ĐVT</th><th class="num">Tồn đầu SL</th><th class="num">Tồn đầu GT</th><th class="num">Nhập SL</th><th class="num">Nhập GT</th><th class="num">Xuất SL</th><th class="num">Xuất GT</th><th class="num">Tồn cuối SL</th><th class="num">Tồn cuối GT</th></tr></thead><tbody>
          ${t.map((r) => `<tr><td class="mono">${esc(r.item)}</td><td>${esc(g(r.item).name)}</td><td class="mono">${esc(r.wh)}</td><td>${esc(g(r.item).unit)}</td><td class="num">${signed(r.openQty)}</td><td class="num">${signed(r.openVal)}</td><td class="num">${signed(r.inQty)}</td><td class="num">${signed(r.inVal)}</td><td class="num">${signed(r.outQty)}</td><td class="num">${signed(r.outVal)}</td><td class="num">${signed(r.endQty)}</td><td class="num">${signed(r.endVal)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">Cộng</td><td class="num">${money(tot.ov)}</td><td></td><td class="num">${money(tot.iv)}</td><td></td><td class="num">${money(tot.xv)}</td><td></td><td class="num">${money(tot.ev)}</td></tr></tfoot></table></div>`;
      }
      const card = E.stockCard(item.code, wh, state.period);
      const method = { BQGQ: 'Bình quân gia quyền cuối kỳ', BQDD: 'Bình quân di động', FIFO: 'Nhập trước xuất trước' }[item.method];
      return `${ctl}<div class="card-body"><dl class="dl"><dt>Hàng hóa</dt><dd>${esc(item.code)} · ${esc(item.name)} (${esc(item.unit)})</dd><dt>Kho</dt><dd class="mono">${esc(wh)}</dd><dt>Phương pháp tính giá</dt><dd>${esc(method)}</dd></dl></div>
        <div class="table-wrap"><table class="tbl" id="rpt-kho"><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="num">Nhập SL</th><th class="num">Nhập GT</th><th class="num">Xuất SL</th><th class="num">Xuất GT</th><th class="num">Tồn SL</th><th class="num">Tồn GT</th></tr></thead><tbody>
          <tr class="is-total"><td colspan="7">Số dư đầu kỳ</td><td class="num">${signed(card.openQty)}</td><td class="num">${signed(card.openVal)}</td></tr>
          ${card.rows.map((r) => `<tr><td class="mono">${dmy(r.mv.date)}</td><td class="mono">${esc(r.mv.no)}</td><td>${esc(r.mv.desc)}</td><td class="num">${signed(r.inQty)}</td><td class="num">${signed(r.inVal)}</td><td class="num">${signed(r.outQty)}</td><td class="num">${signed(r.outVal)}</td><td class="num">${signed(r.qty)}</td><td class="num">${signed(r.val)}</td></tr>`).join('')}
          </tbody><tfoot><tr><td colspan="3">Cộng phát sinh · tồn cuối kỳ</td><td class="num">${signed(card.rows.reduce((s, r) => s + r.inQty, 0))}</td><td class="num">${signed(card.rows.reduce((s, r) => s + r.inVal, 0))}</td><td class="num">${signed(card.rows.reduce((s, r) => s + r.outQty, 0))}</td><td class="num">${signed(card.rows.reduce((s, r) => s + r.outVal, 0))}</td><td class="num">${signed(card.endQty)}</td><td class="num">${signed(card.endVal)}</td></tr></tfoot></table></div>`;
    },
    mount(host, params) {
      host.addEventListener('change', (e) => {
        const k = e.target.dataset && e.target.dataset.rk; if (!k) return;
        E.refresh({ ...params, tab: 'kho', [k]: e.target.value });
      });
    },
  };

  /* ======================= Tờ khai thuế theo quý ======================= */
  E.reportTabs.quy = {
    label: 'Thuế theo quý', note: 'Tờ khai 01/GTGT theo quý · tạm tính 03/TNDN',
    render(params) {
      const dd = d(); const year = state.period.slice(0, 4);
      const q = Number(params.q) || Math.ceil(Number(state.period.slice(5, 7)) / 3);
      const months = [1, 2, 3].map((i) => `${year}-${String((q - 1) * 3 + i).padStart(2, '0')}`);
      const from = `${months[0]}-01`; const to = E.lastDay(months[2]);
      const have = months.filter((m) => dd.periods[m]);
      const inv = (dir) => dd.invoices.filter((i) => i.dir === dir && i.status === 'valid' && i.date >= from && i.date <= to && E.invoiceStatus(i) === 'posted');
      const iIn = inv('in'); const iOut = inv('out');
      const sum = (list, f) => list.reduce((s, i) => s + f(i), 0);
      const o5 = iOut.filter((i) => i.rate === 5); const o10 = iOut.filter((i) => i.rate !== 5);
      const v = { 23: sum(iIn, (i) => i.net), 24: sum(iIn, (i) => i.vat), 30: sum(o5, (i) => i.net), 31: sum(o5, (i) => i.vat), 32: sum(o10, (i) => i.net), 33: sum(o10, (i) => i.vat) };
      v[25] = v[24]; v[34] = v[30] + v[32]; v[35] = v[31] + v[33]; v[36] = v[35] - v[25]; v[40] = Math.max(v[36], 0); v[43] = Math.max(-v[36], 0);
      const vatRows = [['23', 'Giá trị HHDV mua vào'], ['24', 'Thuế GTGT của HHDV mua vào'], ['25', 'Thuế GTGT được khấu trừ trong quý'], ['30', 'HHDV bán ra chịu thuế suất 5% – giá trị'], ['31', 'Thuế GTGT 5%'], ['32', 'HHDV bán ra chịu thuế suất 10% – giá trị'], ['33', 'Thuế GTGT 10%'], ['34', 'Tổng doanh thu HHDV bán ra'], ['35', 'Tổng thuế GTGT của HHDV bán ra'], ['36', 'Thuế GTGT phát sinh trong quý'], ['40', 'Thuế GTGT phải nộp'], ['43', 'Thuế GTGT còn được khấu trừ chuyển quý sau']];
      const rev = flowR('511', 'C', from, to) - flowR('521', 'D', from, to);
      const fin = flowR('515', 'C', from, to); const other = flowR('711', 'C', from, to);
      const cost = flowR('632', 'D', from, to) + flowR('635', 'D', from, to) + flowR('642', 'D', from, to) + flowR('811', 'D', from, to);
      const profit = rev + fin + other - cost;
      const rate = Number(dd.opt.citRate) || 0;
      const taxDue = profit > 0 ? Math.round((profit * rate) / 100) : 0;
      const booked = flowR(E.rm().cit, 'D', from, to);
      const citRows = [['Doanh thu bán hàng và cung cấp dịch vụ (đã trừ giảm trừ)', rev], ['Doanh thu hoạt động tài chính', fin], ['Thu nhập khác', other], ['Giá vốn, chi phí tài chính, quản lý, chi phí khác', cost], ['Lợi nhuận kế toán trước thuế', profit], [`Thuế TNDN tạm tính phải nộp quý (${rate}%)`, taxDue], ['Đã tạm tính, ghi sổ trong các tháng của quý', booked], ['Còn phải nộp', taxDue - booked]];
      const seg = [1, 2, 3, 4].map((n) => `<button type="button" data-a="quarter" data-q="${n}" aria-pressed="${q === n}">Quý ${n}/${year}</button>`).join('');
      return `<div class="card-body od-stack" style="--od-gap:10px"><div class="seg" role="group" aria-label="Chọn quý">${seg}</div>
        ${have.length < 3 ? `<div class="check-line">${badge('warning', 'Chưa đủ dữ liệu', 'alert')}<span>Quý ${q} mới có số liệu ${have.length}/3 tháng (${have.length ? have.map(E.periodLabel).join(', ') : 'chưa có tháng nào'}). Tờ khai tính trên các tháng đã có.</span></div>` : ''}</div>
        <div class="table-wrap"><table class="tbl" id="rpt-quy-vat"><thead><tr><th>Tờ khai 01/GTGT quý ${q}/${year}</th><th>Chỉ tiêu</th><th class="num">Số tiền</th></tr></thead><tbody>${vatRows.map(([c, l]) => `<tr class="${['36', '40', '43'].includes(c) ? 'is-total' : ''}"><td>${esc(l)}</td><td class="report-row-code">[${c}]</td><td class="num">${signed(v[c])}</td></tr>`).join('')}</tbody></table></div>
        <div class="table-wrap"><table class="tbl" id="rpt-quy-cit"><thead><tr><th>Tạm tính 03/TNDN quý ${q}/${year}</th><th class="num">Số tiền</th></tr></thead><tbody>${citRows.map(([l, a], i) => `<tr class="${i === 4 || i === 7 ? 'is-total' : ''}"><td>${esc(l)}</td><td class="num">${signed(a)}</td></tr>`).join('')}</tbody></table></div>
        <p class="help" style="padding:12px 20px">Hóa đơn mua vào ${iIn.length}, bán ra ${iOut.length} đã ghi sổ trong quý. Nhân viên tự nộp tờ khai qua eTax.</p>`;
    },
    mount(host, params) {
      host.addEventListener('click', (e) => { const t = e.target.closest('[data-a="quarter"]'); if (t) E.refresh({ ...params, tab: 'quy', q: t.dataset.q }); });
    },
  };
})(window.EYN);
