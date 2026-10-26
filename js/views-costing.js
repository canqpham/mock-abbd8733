/* Giá thành (Module C): tập hợp chi phí, phân bổ chi phí chung, dở dang, tính giá thành, kết chuyển. */
(function (E) {
  const { esc, icon, badge, money, state } = E;

  const TABS = [['collect', 'Tập hợp chi phí'], ['alloc', 'Phân bổ chi phí chung'], ['wip', 'Dở dang'], ['cards', 'Tính giá thành'], ['transfer', 'Kết chuyển']];
  const METHODS = [['NVL', 'Theo NVL chính'], ['SLHTTD', 'Theo sản lượng hoàn thành tương đương'], ['DINHMUC', 'Theo định mức']];
  const METHOD_TEXT = {
    NVL: 'DDCK = (DDĐK NVL + NVL phát sinh) ÷ (SL hoàn thành + SL dở dang) × SL dở dang. Chỉ NVL trực tiếp nằm trong dở dang, chi phí chế biến tính hết vào thành phẩm.',
    SLHTTD: 'DDCK từng khoản mục = (DDĐK + phát sinh) ÷ (SL hoàn thành + SL dở dang × % hoàn thành) × SL dở dang × % hoàn thành. NVL tính 100%, chi phí chế biến tính theo % hoàn thành.',
    DINHMUC: 'DDCK = SL dở dang × định mức đơn vị từng khoản mục. NVL tính 100%, chi phí chế biến nhân với % hoàn thành.',
  };
  const KINDS = ['Công trình', 'Sản phẩm', 'Đơn hàng'];
  const TRANSFER_TYPES = ['KCCP', 'KCGT', 'KC'];
  const ui = { key: 'NC', manual: {} };

  const fmtQty = (n) => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const parseNum = (s) => { const n = Number(String(s ?? '').trim().replace(/\./g, '').replace(',', '.')); return String(s ?? '').trim() === '' ? NaN : n; };
  const nameOf = (el) => (E.ELEMENTS.find((x) => x[0] === el) || [el, el])[1];
  const activeObjs = (d) => d.costObjects.filter((o) => o.active);
  const elems = (d, m) => E.ELEMENTS.map((x) => x[0]).filter((a) => a !== '623' || d.industry === 'Xây dựng' || (m && m.totals['623'] !== 0) || d.costObjects.some((o) => E.wipOpen(d, state.period, o.code)['623']));
  const goAttr = (view, params) => `data-go="${view}"${params ? ` data-params='${esc(JSON.stringify(params))}'` : ''}`;
  const unitsText = (objs) => {
    const by = {};
    objs.forEach((o) => { by[o.unit] = (by[o.unit] || 0) + o.qtyDone; });
    const t = Object.entries(by).map(([u, q]) => `${fmtQty(q)} ${u}`).join(' · ');
    return t || '–';
  };
  const printHead = (title) => `<div class="print-head"><h2>${esc(title)}</h2><p>${esc(E.company().name)} · MST ${esc(E.company().mst)} · Kỳ ${E.periodLabel(state.period)}</p></div>`;
  const pendingCost = (d) => d.proposals.some((p) => p.source.run === 'cost' && p.status === 'proposed');

  function ledgerNet(d, acc) {
    return d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && e.date.slice(0, 7) === state.period && !TRANSFER_TYPES.includes(e.type))
      .reduce((s, e) => s + e.lines.reduce((x, l) => x + (l.dr === acc ? l.amt : 0) - (l.cr === acc ? l.amt : 0), 0), 0);
  }

  function previewTransfer(d) {
    const period = state.period; const rm = E.rm(d);
    const m = E.costMatrix(period, d);
    const stuck = ['621', '622', '623', '627'].reduce((s, a) => s + m.unassigned.el[a], 0);
    const posted = (type, pred) => d.entries.filter((e) => e.status === 'posted' && e.type === type && e.date.slice(0, 7) === period).reduce((s, e) => s + e.lines.filter(pred).reduce((x, l) => x + l.amt, 0), 0);
    const rows = m.rows.map((r) => {
      const card = E.costCard(period, r.code, d, m);
      const kc = [];
      rm.elements.forEach((a) => { const v = r.el[a] - posted('KCCP', (l) => l.cr === a && l.ct === r.code); if (v > 0) kc.push({ acc: a, amt: v }); });
      const z = card.zTotal - posted('KCGT', (l) => l.cr === '154' && l.ct === r.code);
      const gt = z > 0 && r.obj.qtyDone > 0 ? { dr: r.obj.out === '155' ? rm.fg : rm.cogs, amt: z, qty: r.obj.qtyDone, item: r.obj.item } : null;
      return { obj: r.obj, kc, gt, card };
    });
    return { stuck, rows };
  }

  function statStrip(d, m) {
    const cards = activeObjs(d).map((o) => E.costCard(state.period, o.code, d, m));
    const inc = m.rows.reduce((s, r) => s + r.total, 0) + m.unassigned.total;
    const sum = (k) => cards.reduce((s, c) => s + c[k], 0);
    return `<div class="stats" style="--cols:5">
      <div class="stat"><span class="stat-label">Chi phí phát sinh</span><span class="stat-value">${money(inc)}</span><span class="stat-note">Đã gồm chi phí chưa phân đối tượng</span></div>
      <div class="stat"><span class="stat-label">Dở dang đầu kỳ</span><span class="stat-value">${money(sum('openTotal'))}</span><span class="stat-note">${activeObjs(d).length} đối tượng</span></div>
      <div class="stat"><span class="stat-label">Dở dang cuối kỳ</span><span class="stat-value">${money(sum('closeTotal'))}</span><span class="stat-note">Ước tính theo phương pháp đã chọn</span></div>
      <div class="stat"><span class="stat-label">Giá thành kỳ này</span><span class="stat-value">${money(sum('zTotal'))}</span><span class="stat-note">DDĐK + phát sinh − DDCK</span></div>
      <div class="stat"><span class="stat-label">SL hoàn thành</span><span class="stat-value cst-stat-qty">${esc(unitsText(activeObjs(d)))}</span><span class="stat-note">Theo từng đơn vị tính</span></div>
    </div>`;
  }

  /* ----- tab 1: tập hợp ----- */
  function collectTab(d, m) {
    const els = elems(d, m);
    const cell = (v, acc, ct) => (v ? `<button type="button" class="link-btn num cst-num" data-a="drill" data-acc="${acc}" data-ct="${esc(ct)}">${money(v)}</button>` : '<span class="muted num">–</span>');
    const row = (label, sub, r, ct, cls = '') => `<tr${cls}><td><span class="strong">${esc(label)}</span>${sub ? `<span class="muted cst-sub">${esc(sub)}</span>` : ''}</td>${els.map((a) => `<td class="num">${cell(r.el[a], a, ct)}</td>`).join('')}<td class="num strong">${money(r.total)}</td></tr>`;
    const tot = (r) => els.reduce((s, a) => s + r.el[a], 0);
    const rows = m.rows.map((r) => ({ ...r, total: tot(r) })); const un = { ...m.unassigned, total: tot(m.unassigned) };
    const totalsRow = els.map((a) => m.totals[a]);
    const ledger = els.map((a) => ledgerNet(d, a));
    const diff = els.map((a, i) => totalsRow[i] - ledger[i]);
    const bad = diff.some((x) => x !== 0);
    return `<section class="card cst-tab" aria-labelledby="cst-t1">
      <div class="card-head"><div class="od-fill"><span class="card-title" id="cst-t1">Tập hợp chi phí theo đối tượng</span><span class="card-sub">Lấy từ sổ theo cột công trình/YTCP trên chứng từ. Bấm một số để xem chứng từ.</span></div>
        <button type="button" class="btn btn-outline" data-a="objects">${icon('pencil')}Đối tượng tập hợp</button>
        <button type="button" class="btn btn-outline" data-a="csv">${icon('download')}Xuất CSV</button></div>
      ${printHead('Tập hợp chi phí theo đối tượng')}
      <div class="table-wrap"><table class="tbl cst-tbl" id="cst-collect"><thead><tr><th>Đối tượng</th>${els.map((a) => `<th class="num">${a}<span class="cst-sub">${esc(nameOf(a))}</span></th>`).join('')}<th class="num">Cộng</th></tr></thead>
        <tbody>${rows.map((r) => row(r.obj.name, `${r.code} · ${r.obj.kind}`, r, r.code)).join('')}
          ${row('Chưa phân đối tượng', 'Chi phí chung, cần phân bổ', un, '', ' class="is-sub"')}</tbody>
        <tfoot><tr><td>Tổng cộng</td>${totalsRow.map((v) => `<td class="num">${money(v)}</td>`).join('')}<td class="num">${money(totalsRow.reduce((s, v) => s + v, 0))}</td></tr></tfoot></table></div>
      <div class="card-body cst-recon ${bad ? 'is-bad' : ''}">
        ${bad ? badge('danger', 'Lệch sổ', 'circle-alert') : badge('success', 'Khớp sổ cái', 'circle-check')}
        <span>Đối chiếu sổ cái (Nợ − Có, không tính bút toán kết chuyển):
          ${els.map((a, i) => `<span class="acc-chip">${a}</span> <span class="mono">${money(ledger[i])}</span>${diff[i] ? ` <span class="text-danger mono">(lệch ${money(diff[i])})</span>` : ''}`).join(' · ')}</span>
        ${bad ? '<span class="help">Chênh lệch thường do đối tượng đã ngừng dùng vẫn còn chi phí.</span>' : ''}
      </div></section>`;
  }

  /* ----- tab 2: phân bổ ----- */
  function allocPool(d) { return d.opt.allocPool642 ? ['627', '6421', '6422'] : ['627']; }
  function allocTab(d) {
    const period = state.period; const can = E.canWrite();
    const pool = allocPool(d);
    const manualOk = ui.key !== 'TAY' || Object.values(ui.manual).some((v) => Number(v) > 0);
    const plan = E.costAllocPlan(period, { pool, key: ui.key, manual: ui.manual }, d);
    const ran = d.runs.alloc === period;
    const pend = d.proposals.some((p) => p.source.run === 'alloc' && p.status === 'proposed');
    const canRun = can && !pend && plan.lines.length > 0 && manualOk;
    const why = !can ? 'Kỳ đã khóa hoặc công ty chỉ đọc' : pend ? 'Đã tạo đề xuất phân bổ kỳ này. Từ chối đề xuất ở màn Duyệt để chạy lại.' : !manualOk ? 'Nhập tỷ lệ lớn hơn 0 cho ít nhất một đối tượng' : plan.totalBase <= 0 ? 'Tiêu thức phân bổ bằng 0 cho mọi đối tượng' : !plan.lines.length ? 'Không có chi phí chung chưa phân bổ' : '';
    const objs = activeObjs(d);
    const byAcc = pool.map((a) => ({ acc: a, amt: plan.poolAmt[a] || 0, rows: plan.rows.filter((r) => r.acc === a) }));
    return `<section class="card cst-tab" aria-labelledby="cst-t2">
      <div class="card-head"><div class="od-fill"><span class="card-title" id="cst-t2">Phân bổ chi phí chung</span><span class="card-sub">Chi phí chưa gắn đối tượng được chia cho các đối tượng theo tiêu thức, tạo bút toán PBCP để duyệt.</span></div>
        ${ran || pend ? badge('success', 'Đã tạo đề xuất kỳ này', 'circle-check') : ''}
        <button type="button" class="btn" data-a="alloc-run" ${canRun ? '' : 'disabled'}>${icon('play')}Tạo đề xuất phân bổ</button></div>
      <div class="card-body cst-form">
        <div class="field"><label class="label" for="cst-key">Tiêu thức phân bổ</label>
          <select id="cst-key" class="select" data-a-change="key" ${can ? '' : 'disabled'}>${E.ALLOC_KEYS.map(([k, n]) => `<option value="${k}" ${ui.key === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <label class="od-row cst-check"><input type="checkbox" class="check" data-a-change="pool642" ${d.opt.allocPool642 ? 'checked' : ''} ${can ? '' : 'disabled'}><span>Phân bổ cả chi phí quản lý 6421, 6422 chưa gắn đối tượng</span></label>
        ${ui.key === 'TAY' ? `<div class="cst-manual">${objs.map((o) => `<div class="field"><label class="label" for="cst-m-${esc(o.code)}">Tỷ lệ ${esc(o.name)} (%)</label><input id="cst-m-${esc(o.code)}" class="input mono" inputmode="decimal" data-a-change="manual" data-obj="${esc(o.code)}" value="${esc(ui.manual[o.code] ?? '')}" ${can ? '' : 'disabled'}></div>`).join('')}</div>` : ''}
        ${why && !canRun ? `<span class="help">${esc(why)}</span>` : ''}
      </div>
      ${printHead('Phân bổ chi phí chung')}
      <div class="table-wrap"><table class="tbl cst-tbl" id="cst-alloc"><thead><tr><th>TK</th><th>Đối tượng</th><th class="num">Cơ sở phân bổ</th><th class="num">Tỷ lệ</th><th class="num">Số phân bổ</th></tr></thead>
        <tbody>${byAcc.map((g) => (g.rows.length ? g.rows.map((r) => `<tr><td><span class="acc-chip">${g.acc}</span></td><td>${esc((d.costObjects.find((o) => o.code === r.obj) || {}).name || r.obj)}<span class="muted cst-sub">${esc(r.obj)}</span></td><td class="num">${money(r.base)}</td><td class="num">${r.pct.toFixed(2).replace('.', ',')}%</td><td class="num">${money(r.amt)}</td></tr>`).join('') + `<tr class="is-sub"><td colspan="4">Cộng ${g.acc}</td><td class="num">${money(g.rows.reduce((s, r) => s + r.amt, 0))} / ${money(g.amt)}</td></tr>` : `<tr class="is-sub"><td><span class="acc-chip">${g.acc}</span></td><td colspan="4" class="muted">${g.amt > 0 ? 'Chưa tính được: tiêu thức bằng 0' : 'Không còn chi phí chưa phân bổ'}</td></tr>`)).join('')}</tbody></table></div>
      <div class="card-body"><span class="help">Số làm tròn được dồn vào đối tượng cuối cùng để tổng phân bổ đúng bằng chi phí chung. Sau khi duyệt, ${pool.join(', ')} chưa phân đối tượng về 0.</span></div></section>`;
  }

  /* ----- tab 3: dở dang ----- */
  function wipTab(d, m) {
    const period = state.period; const can = E.canWrite(); const els = elems(d, m);
    const cards = activeObjs(d).map((o) => {
      const card = E.costCard(period, o.code, d, m);
      const set = (d.wip[period] || {})[o.code] || {};
      const method = set.method || o.method; const qtyWip = set.qtyWip != null ? set.qtyWip : o.qtyWip; const pct = set.pct != null ? set.pct : o.pct;
      const nm = d.norms[o.code] || {};
      const fld = (id, label, val, extra = '') => `<div class="field"><label class="label" for="cst-w-${esc(o.code)}-${id}">${label}</label><input id="cst-w-${esc(o.code)}-${id}" class="input mono" inputmode="decimal" data-f="${id}" value="${esc(val)}" ${can ? '' : 'disabled'} ${extra}><span class="field-error" data-err="${id}" hidden></span></div>`;
      return `<div class="card cst-obj" data-obj="${esc(o.code)}"><div class="card-head"><div class="od-fill"><span class="card-title">${esc(o.name)}</span><span class="card-sub">${esc(o.code)} · SL hoàn thành ${fmtQty(o.qtyDone)} ${esc(o.unit)}</span></div>
          <button type="button" class="btn" data-a="wip-save" data-obj="${esc(o.code)}" ${can ? '' : 'disabled'}>${icon('check')}Lưu</button></div>
        <div class="card-body cst-form">
          <div class="field"><label class="label" for="cst-w-${esc(o.code)}-method">Phương pháp đánh giá dở dang</label><select id="cst-w-${esc(o.code)}-method" class="select" data-f="method" ${can ? '' : 'disabled'}>${METHODS.map(([k, n]) => `<option value="${k}" ${method === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          ${fld('qtyWip', `SL dở dang cuối kỳ (${esc(o.unit)})`, fmtQty(qtyWip))}
          ${fld('pct', '% hoàn thành dở dang', fmtQty(pct))}
          <span class="help cst-formula">${esc(METHOD_TEXT[method])}</span>
          ${method === 'DINHMUC' ? `<div class="cst-manual">${['621', '622', '623', '627'].map((a) => fld(`n${a}`, `Định mức ${a} (đ/${esc(o.unit)})`, money(nm[a] || 0))).join('')}</div>` : ''}
          <label class="od-row cst-check"><input type="checkbox" class="check" data-f="manual" ${set.manual ? 'checked' : ''} ${can ? '' : 'disabled'}><span>Nhập tay giá trị dở dang cuối kỳ</span></label>
          <div class="cst-manual">${['621', '622', '623', '627'].map((a) => fld(`c${a}`, `DDCK ${a} (đ)`, money((set.manual ? set.close : card.close)[a] || 0))).join('')}</div>
        </div>
        <div class="table-wrap"><table class="tbl cst-tbl"><thead><tr><th>Khoản mục</th><th class="num">DDĐK</th><th class="num">Phát sinh</th><th class="num">DDCK</th></tr></thead>
          <tbody>${els.map((a) => `<tr><td>${a} · ${esc(nameOf(a))}</td><td class="num">${money(card.open[a] || 0)}</td><td class="num">${money(card.inc[a] || 0)}</td><td class="num">${money(card.close[a] || 0)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Cộng</td><td class="num">${money(card.openTotal)}</td><td class="num">${money(card.incTotal)}</td><td class="num">${money(card.closeTotal)}</td></tr></tfoot></table></div></div>`;
    });
    return `<div class="cst-tab od-stack" style="--od-gap:16px">${cards.join('')}</div>`;
  }

  /* ----- tab 4: giá thành ----- */
  function cardsTab(d, m) {
    const can = E.canWrite(); const els = elems(d, m);
    const blocks = activeObjs(d).map((o) => {
      const c = E.costCard(state.period, o.code, d, m);
      return `<section class="card cst-obj" data-obj="${esc(o.code)}"><div class="card-head"><div class="od-fill"><span class="card-title">Thẻ giá thành · ${esc(o.name)}</span><span class="card-sub">${esc(o.code)} · ${esc(o.kind)}${o.out === '155' ? ` · nhập kho thành phẩm ${esc(o.item || '(chưa chọn mã hàng)')}` : ' · kết chuyển giá vốn 632'}</span></div>
          <div class="field cst-qty"><label class="label" for="cst-q-${esc(o.code)}">SL hoàn thành (${esc(o.unit)})</label><input id="cst-q-${esc(o.code)}" class="input mono" inputmode="decimal" data-a-change="qty" data-obj="${esc(o.code)}" value="${fmtQty(o.qtyDone)}" ${can ? '' : 'disabled'}><span class="field-error" data-err="qty" hidden></span></div></div>
        <div class="table-wrap"><table class="tbl cst-tbl"><thead><tr><th>Khoản mục</th><th class="num">DDĐK</th><th class="num">Phát sinh</th><th class="num">DDCK</th><th class="num">Giá thành</th></tr></thead>
          <tbody>${els.map((a) => `<tr><td>${a} · ${esc(nameOf(a))}</td><td class="num">${money(c.open[a] || 0)}</td><td class="num">${money(c.inc[a] || 0)}</td><td class="num">${money(c.close[a] || 0)}</td><td class="num">${money(c.z[a] || 0)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Tổng giá thành</td><td class="num">${money(c.openTotal)}</td><td class="num">${money(c.incTotal)}</td><td class="num">${money(c.closeTotal)}</td><td class="num">${money(c.zTotal)}</td></tr>
            <tr><td colspan="4">Giá thành đơn vị = ${money(c.zTotal)} ÷ ${fmtQty(o.qtyDone)} ${esc(o.unit)}</td><td class="num">${o.qtyDone > 0 ? money(c.unit) : '–'}</td></tr></tfoot></table></div>
        ${o.qtyDone > 0 ? '' : `<div class="card-body"><span class="help">Chưa có sản lượng hoàn thành nên chưa tính giá thành đơn vị. Chi phí vẫn nằm trong TK 154 cho kỳ sau.</span></div>`}</section>`;
    });
    return `<div class="cst-tab od-stack" style="--od-gap:16px" id="cst-cards">
      <div class="od-row no-print" style="--od-gap:8px"><span class="od-fill"></span><button type="button" class="btn btn-outline" data-a="print">${icon('printer')}In</button><button type="button" class="btn btn-outline" data-a="csv">${icon('download')}Xuất CSV</button></div>
      ${printHead('Thẻ giá thành')}${blocks.join('')}</div>`;
  }

  /* ----- tab 5: kết chuyển ----- */
  function transferTab(d) {
    const period = state.period; const can = E.canWrite(); const rm = E.rm(d);
    const pv = previewTransfer(d);
    const ran = d.runs.cost === period; const pend = pendingCost(d);
    const noItem = pv.rows.filter((r) => r.obj.out === '155' && r.obj.qtyDone > 0 && !r.obj.item);
    const nothing = !pv.rows.some((r) => r.kc.length || r.gt);
    const canRun = can && !ran && !pend && !pv.stuck && !noItem.length && !nothing;
    const why = !can ? 'Kỳ đã khóa hoặc công ty chỉ đọc' : ran || pend ? 'Đã tạo đề xuất kết chuyển kỳ này. Từ chối đề xuất ở màn Duyệt để chạy lại.' : pv.stuck ? '' : noItem.length ? `Chọn mã thành phẩm cho: ${noItem.map((r) => r.obj.name).join(', ')}.` : nothing ? 'Không có chi phí hoặc giá thành cần kết chuyển' : '';
    const mapRows = [['Chế độ kế toán', rm.label], ['Giảm trừ doanh thu', rm.revDeduct.join(', ')], ['Chiết khấu thương mại', rm.discount], ['Hàng bán bị trả lại', rm.returnRev], ['Chi phí thuế TNDN', rm.cit], ['Bảo hiểm thất nghiệp', rm.bhtn], ['Chi phí dở dang', rm.wip], ['Thành phẩm', rm.fg], ['Giá vốn', rm.cogs], ['Chi phí kết chuyển sang 154', rm.elements.join(', ')]];
    return `<div class="cst-tab od-stack" style="--od-gap:16px">
      ${pv.stuck ? `<div class="banner is-danger" role="alert">${icon('circle-alert')}<span class="od-fill">Còn ${money(pv.stuck)} đ chi phí chung chưa gắn đối tượng. Phân bổ trước khi kết chuyển.</span><button type="button" class="btn btn-outline" data-a="tab" data-tab="alloc">Đến Phân bổ</button></div>` : ''}
      <section class="card"><div class="card-head"><div class="od-fill"><span class="card-title">Đối tượng nhận kết chuyển</span><span class="card-sub">Chọn đầu ra của 154 cho từng đối tượng trước khi tạo đề xuất.</span></div></div>
        <div class="table-wrap"><table class="tbl cst-tbl"><thead><tr><th>Đối tượng</th><th>Đầu ra của 154</th><th>Mã thành phẩm nhập kho</th></tr></thead>
          <tbody>${activeObjs(d).map((o) => `<tr><td>${esc(o.name)}<span class="muted cst-sub">${esc(o.code)}</span></td>
            <td><label class="sr-only" for="cst-o-${esc(o.code)}">Đầu ra ${esc(o.name)}</label><select id="cst-o-${esc(o.code)}" class="select" data-a-change="out" data-obj="${esc(o.code)}" ${can ? '' : 'disabled'}><option value="632" ${o.out === '632' ? 'selected' : ''}>Giá vốn ${rm.cogs} (dịch vụ, xây dựng)</option><option value="155" ${o.out === '155' ? 'selected' : ''}>Thành phẩm ${rm.fg} (nhập kho)</option></select></td>
            <td>${o.out === '155' ? `<label class="sr-only" for="cst-i-${esc(o.code)}">Mã thành phẩm ${esc(o.name)}</label><input id="cst-i-${esc(o.code)}" class="input mono" data-item-obj="${esc(o.code)}" value="${esc(o.item)}" placeholder="Gõ mã hoặc tên thành phẩm" ${can ? '' : 'disabled'}>` : '<span class="muted">Không dùng</span>'}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-head"><div class="od-fill"><span class="card-title">Bút toán sẽ tạo</span><span class="card-sub">${rm.elements.join(', ')} → ${rm.wip}, sau đó ${rm.wip} → ${rm.fg} hoặc ${rm.cogs}.</span></div>
          ${ran || pend ? badge('success', 'Đã tạo đề xuất kỳ này', 'circle-check') : ''}
          <button type="button" class="btn" data-a="transfer-run" ${canRun ? '' : 'disabled'}>${icon('play')}Tạo đề xuất kết chuyển</button></div>
        ${why && !canRun ? `<div class="card-body"><span class="help">${esc(why)}</span></div>` : ''}
        <div class="table-wrap"><table class="tbl cst-tbl"><thead><tr><th>Đối tượng</th><th>Bút toán</th><th class="num">Số tiền</th></tr></thead>
          <tbody>${pv.rows.map((r) => `${r.kc.map((x) => `<tr><td>${esc(r.obj.name)}</td><td>Nợ <span class="acc-chip">${rm.wip}</span> / Có <span class="acc-chip">${x.acc}</span></td><td class="num">${money(x.amt)}</td></tr>`).join('')}${r.gt ? `<tr><td>${esc(r.obj.name)}</td><td>Nợ <span class="acc-chip">${r.gt.dr}</span> / Có <span class="acc-chip">${rm.wip}</span>${r.obj.out === '155' ? ` · nhập kho ${esc(r.gt.item || '?')} × ${fmtQty(r.gt.qty)} ${esc(r.obj.unit)}` : ''}</td><td class="num">${money(r.gt.amt)}</td></tr>` : ''}`).join('') || '<tr><td colspan="3" class="muted">Không có bút toán cần tạo.</td></tr>'}</tbody></table></div></section>
      <section class="card"><div class="card-head"><div class="od-fill"><span class="card-title">Bảng ánh xạ tài khoản theo chế độ</span><span class="card-sub">Một bảng duy nhất cho TT133 và TT99, các bước kết chuyển đọc từ đây.</span></div></div>
        <div class="card-body"><dl class="dl">${mapRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd>`).join('')}</dl></div></section></div>`;
  }

  E.views.costing = {
    render(params = {}) {
      const d = E.db(); const tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'collect';
      const c = E.company(); const objs = activeObjs(d);
      const head = `<div class="page-header"><div class="od-fill" style="min-width:240px"><h1 class="page-title">Giá thành</h1><span class="page-sub">${esc(c.name)} · ${esc(E.rm(d).label)} · kỳ ${E.periodLabel(state.period)}</span></div>
        <div class="page-actions"><button type="button" class="btn btn-outline" data-a="objects">${icon('pencil')}Đối tượng tập hợp</button></div></div>`;
      if (!objs.length) {
        return `<div class="page">${head}<section class="card"><div class="empty">${icon('factory')}<span class="empty-title">Chưa có đối tượng tập hợp chi phí</span><span class="empty-text">${E.hasModule(c, 'costing') ? 'Thêm công trình, sản phẩm hoặc đơn hàng để tập hợp chi phí và tính giá thành.' : `Ngành ${esc(c.industry)} không tính giá thành, chi phí ghi thẳng vào 642.`}</span></div></section></div>`;
      }
      const m = E.costMatrix(state.period, d);
      const body = tab === 'collect' ? collectTab(d, m) : tab === 'alloc' ? allocTab(d) : tab === 'wip' ? wipTab(d, m) : tab === 'cards' ? cardsTab(d, m) : transferTab(d);
      return `<div class="page">${head}${statStrip(d, m)}
        <div class="card"><div class="tabs" role="tablist" style="padding:0 12px">${TABS.map(([k, n]) => `<button type="button" role="tab" data-a="tab" data-tab="${k}" aria-selected="${tab === k}">${n}</button>`).join('')}</div></div>
        ${body}</div>`;
    },

    mount(host, params = {}) {
      const d = E.db(); const period = state.period;
      const tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'collect';
      const rr = () => { E.refresh({ ...params, tab }); E.refreshChrome(); };
      const showErr = (root, key, msg) => { const el = root.querySelector(`[data-err="${key}"]`); if (!el) return; el.textContent = msg || ''; el.hidden = !msg; const inp = el.previousElementSibling; if (inp && inp.setAttribute) inp.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
      const reviewAction = { label: 'Mở Duyệt', run: () => E.go('review', { source: 'job' }) };

      function drill(acc, ct) {
        const rows = E.costLines(d, period, acc, ct);
        const total = rows.reduce((s, r) => s + r.amt, 0);
        E.openDialog({
          eyebrow: `TK ${acc} · ${ct ? ((d.costObjects.find((o) => o.code === ct) || {}).name || ct) : 'Chưa phân đối tượng'}`, title: 'Chứng từ tạo nên số này', size: 'lg',
          body: rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th>TK</th><th class="num">Số tiền</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="mono">${E.dmy(r.e.date)}</td><td><button type="button" class="link-btn mono" ${goAttr('vouchers')}>${esc(r.e.no)}</button></td><td>${esc(r.l.desc || r.e.desc)}</td><td><span class="acc-chip">${acc}</span></td><td class="num">${money(r.amt)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">Cộng</td><td class="num">${money(total)}</td></tr></tfoot></table></div>` : '<p class="muted">Không có chứng từ.</p>',
          actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
        });
      }

      function objectDialog(code) {
        const o = code ? d.costObjects.find((x) => x.code === code) : null;
        const projOpts = d.projects.filter((p) => p.active);
        const v = (id) => `#cst-od-${id}`;
        E.openDialog({
          eyebrow: 'Đối tượng tập hợp chi phí', title: o ? `Sửa ${o.code}` : 'Thêm đối tượng',
          body: `<div class="form-grid">
            <div class="field span-6"><label class="label" for="cst-od-code">Mã<span class="req">*</span></label><input id="cst-od-code" class="input mono" value="${esc(o ? o.code : '')}" ${o ? 'disabled' : ''}><span class="field-error" data-err="code" hidden></span></div>
            <div class="field span-6"><label class="label" for="cst-od-kind">Loại</label><select id="cst-od-kind" class="select">${KINDS.map((k) => `<option ${o && o.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
            <div class="field span-12"><label class="label" for="cst-od-name">Tên<span class="req">*</span></label><input id="cst-od-name" class="input" value="${esc(o ? o.name : '')}"><span class="field-error" data-err="name" hidden></span></div>
            <div class="field span-6"><label class="label" for="cst-od-unit">Đơn vị tính<span class="req">*</span></label><input id="cst-od-unit" class="input" value="${esc(o ? o.unit : '')}"><span class="field-error" data-err="unit" hidden></span></div>
            <div class="field span-6"><label class="label" for="cst-od-proj">Liên kết hợp đồng, công trình</label><select id="cst-od-proj" class="select"><option value="">Không liên kết</option>${projOpts.map((p) => `<option value="${esc(p.code)}" ${o && o.projectCode === p.code ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div>
            ${o ? `<label class="od-row span-12 cst-check"><input type="checkbox" class="check" id="cst-od-active" ${o.active ? 'checked' : ''}><span>Đang dùng. Bỏ chọn để ngừng tập hợp chi phí cho đối tượng này.</span></label>` : ''}
          </div>
          ${!o ? `<div class="od-stack" style="--od-gap:6px"><span class="label">Đối tượng hiện có</span><div class="od-cluster">${d.costObjects.map((x) => `<button type="button" class="chip" data-edit="${esc(x.code)}" ${x.active ? '' : 'aria-pressed="false"'}>${esc(x.code)}${x.active ? '' : ' (ngừng)'}</button>`).join('') || '<span class="muted">Chưa có.</span>'}</div></div>` : ''}`,
          actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
            label: o ? 'Lưu' : 'Thêm đối tượng', run(api) {
              const el = api.el; const get = (id) => el.querySelector(v(id));
              const code = o ? o.code : get('code').value.trim(); const name = get('name').value.trim(); const unit = get('unit').value.trim();
              let ok = true; const bad = (k, m) => { showErr(el, k, m); ok = false; };
              ['code', 'name', 'unit'].forEach((k) => showErr(el, k, ''));
              if (!o) {
                if (!code) bad('code', 'Nhập mã đối tượng.');
                else if (!/^[A-Za-z0-9_.-]+$/.test(code)) bad('code', 'Mã chỉ gồm chữ không dấu, số, dấu gạch ngang, gạch dưới hoặc chấm.');
                else if (d.costObjects.some((x) => x.code.toLowerCase() === code.toLowerCase())) bad('code', 'Mã này đã có, chọn mã khác.');
              }
              if (!name) bad('name', 'Nhập tên đối tượng.');
              if (!unit) bad('unit', 'Nhập đơn vị tính, ví dụ m², bộ, hộp.');
              if (!ok) return false;
              const patch = { name, unit, kind: get('kind').value, projectCode: get('proj').value || undefined };
              if (o) {
                const active = get('active').checked;
                Object.assign(o, patch, { active });
                if (!active) E.toast(`Đã ngừng ${o.code}`, { text: 'Chi phí đã ghi vẫn nằm trong sổ, đối tượng không còn trong bảng tập hợp.' });
              } else {
                d.costObjects.push({ code, ...patch, qtyDone: 0, qtyWip: 0, pct: 50, method: 'SLHTTD', out: '632', item: '', active: true });
                d.norms[code] = {};
                E.toast(`Đã thêm ${code}`);
              }
              setTimeout(rr, 0);
              return undefined;
            },
          }],
          onMount(api) { api.el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { api.close(); setTimeout(() => objectDialog(b.dataset.edit), 0); })); },
          initialFocus: o ? '#cst-od-name' : '#cst-od-code',
        });
      }

      function saveWip(card) {
        const code = card.dataset.obj; const o = d.costObjects.find((x) => x.code === code);
        const val = (f) => card.querySelector(`[data-f="${f}"]`);
        let ok = true; const bad = (k, m) => { showErr(card, k, m); ok = false; };
        card.querySelectorAll('[data-err]').forEach((el) => showErr(card, el.dataset.err, ''));
        const qtyWip = parseNum(val('qtyWip').value); const pct = parseNum(val('pct').value);
        if (!(qtyWip >= 0)) bad('qtyWip', 'Nhập số lượng dở dang từ 0 trở lên.');
        if (!(pct >= 0 && pct <= 100)) bad('pct', 'Tỷ lệ hoàn thành từ 0 đến 100.');
        const method = val('method').value; const manual = val('manual').checked;
        const els4 = ['621', '622', '623', '627'];
        const norms = {}; const close = { 154: 0 };
        if (method === 'DINHMUC') els4.forEach((a) => { const n = E.parseMoney(val(`n${a}`).value); if (n < 0) bad(`n${a}`, 'Định mức không âm.'); norms[a] = n; });
        if (manual) els4.forEach((a) => { const n = E.parseMoney(val(`c${a}`).value); if (n < 0) bad(`c${a}`, 'Giá trị không âm.'); close[a] = n; });
        if (!ok) return;
        d.wip[period] = d.wip[period] || {};
        d.wip[period][code] = { ...(d.wip[period][code] || {}), method, qtyWip, pct, manual };
        if (manual) d.wip[period][code].close = close;
        if (method === 'DINHMUC') d.norms[code] = { ...(d.norms[code] || {}), ...norms };
        E.toast('Đã lưu dở dang', { text: o.name });
        rr();
      }

      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
        const a = t.dataset.a;
        if (a === 'tab') { E.refresh({ ...params, tab: t.dataset.tab }); return; }
        if (a === 'drill') drill(t.dataset.acc, t.dataset.ct);
        if (a === 'objects') objectDialog(null);
        if (a === 'print') E.printPage(`Giá thành kỳ ${E.periodLabel(period)}`);
        if (a === 'csv') {
          const tables = [...host.querySelectorAll('.cst-tab table')];
          E.downloadCsv(`gia-thanh-${tab}-${period}.csv`, tables.flatMap((tb, i) => (i ? [[], ...E.tableRows(tb)] : E.tableRows(tb))));
        }
        if (a === 'wip-save') saveWip(t.closest('.cst-obj'));
        if (a === 'alloc-run') {
          const r = E.runCostAlloc({ pool: allocPool(d), key: ui.key, manual: ui.manual }, d);
          if (r.error) { E.toast('Chưa tạo được đề xuất', { error: true, text: r.error }); return; }
          E.toast('Đã tạo đề xuất phân bổ, chờ duyệt', { text: `${r.plan.lines.length} dòng phân bổ cho kỳ ${E.periodLabel(period)}.`, action: reviewAction });
          rr();
        }
        if (a === 'transfer-run') {
          const r = E.runCostTransfer(d);
          if (r.error) { E.toast('Chưa kết chuyển được', { error: true, text: r.error }); return; }
          E.toast('Đã tạo đề xuất kết chuyển, chờ duyệt', { text: `${r.kc} dòng kết chuyển chi phí, ${r.gt} dòng giá thành.`, action: reviewAction });
          rr();
        }
      });

      host.addEventListener('change', (e) => {
        const t = e.target.closest('[data-a-change]'); if (!t) return;
        const a = t.dataset.aChange; const o = d.costObjects.find((x) => x.code === t.dataset.obj);
        if (a === 'key') { ui.key = t.value; rr(); }
        if (a === 'pool642') { d.opt.allocPool642 = t.checked; rr(); }
        if (a === 'manual') { const n = parseNum(t.value); ui.manual[t.dataset.obj] = n >= 0 ? n : 0; rr(); }
        if (a === 'out') { o.out = t.value; rr(); }
        if (a === 'qty') {
          const n = parseNum(t.value);
          const card = t.closest('.cst-obj');
          if (!(n >= 0)) { showErr(card, 'qty', 'Nhập số lượng từ 0 trở lên.'); return; }
          o.qtyDone = n; E.toast('Đã lưu sản lượng hoàn thành', { text: `${o.name}: ${fmtQty(n)} ${o.unit}` }); rr();
        }
      });

      host.querySelectorAll('[data-item-obj]').forEach((inp) => {
        inp.dataset.acOnFocus = 'true';
        E.autocomplete(inp, {
          items: (q) => d.goods.filter((g) => g.active && g.tkKho === E.rm(d).fg && (!q || E.matches(`${g.code} ${g.name}`, q))).map((g) => ({ value: g.code, code: g.code, name: g.name, meta: g.unit })),
          onPick: (it) => { const o = d.costObjects.find((x) => x.code === inp.dataset.itemObj); o.item = it.code; rr(); },
        });
      });
    },
  };
})(window.EYN);
