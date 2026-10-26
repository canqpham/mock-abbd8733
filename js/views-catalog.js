/* Catalogue views: Hợp đồng & công trình (KTGTCT), Loại chứng từ (KTLCTG), Số dư đầu kỳ (SDDK). */
(function (E) {
  const { esc, icon, badge, money, dmy, state } = E;
  E.views = E.views || {};

  const readonlyToast = () => E.toast('Không ghi được lúc này', { error: true, text: E.isReadonly() ? 'Công ty đang ở chế độ chỉ đọc.' : `Kỳ ${E.periodLabel(state.period)} đã khóa.` });
  const fieldErr = (input, msg) => {
    const box = input.closest('.field');
    let el = box.querySelector('.field-error');
    if (!el) { el = document.createElement('span'); el.className = 'field-error'; box.appendChild(el); }
    el.textContent = msg || '';
    el.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };
  /* rules: { fieldId: value => errorMessage|'' }. Validates on blur, re-validates while invalid, and all at once on submit. */
  const bindRules = (el, rules) => {
    const check = (id) => { const inp = el.querySelector(`#${id}`); return fieldErr(inp, rules[id](inp.value.trim(), inp)); };
    Object.keys(rules).forEach((id) => {
      const inp = el.querySelector(`#${id}`);
      inp.addEventListener('blur', () => { if (inp.value || inp.getAttribute('aria-invalid')) check(id); });
      inp.addEventListener('input', () => { if (inp.getAttribute('aria-invalid') === 'true') check(id); });
    });
    return () => { const ok = Object.keys(rules).map(check).every(Boolean); if (!ok) { const bad = el.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); } return ok; };
  };
  const num = (s) => E.parseMoney(s);
  const tabsHtml = (tabs, cur) => `<div class="tabs" role="tablist" style="padding:0 12px">${tabs.map(([k, l]) => `<button type="button" role="tab" data-a="tab" data-tab="${k}" aria-selected="${cur === k}">${esc(l)}</button>`).join('')}</div>`;
  const csvBtn = (act = 'csv') => `<button type="button" class="btn btn-outline" data-a="${act}">${icon('download')}Xuất CSV</button>`;
  const printBtn = '<button type="button" class="btn btn-outline" data-a="print">' + icon('printer') + 'In</button>';
  const printHead = (title) => `<div class="print-head"><h2>${esc(title)}</h2><p>${esc(E.company().name)} · MST ${esc(E.company().mst)} · kỳ ${E.periodLabel(state.period)}</p></div>`;

  /* ======================= Hợp đồng & công trình ======================= */
  const PJ_STATUS = ['Đang thực hiện', 'Hoàn thành', 'Tạm dừng', 'Đã thanh lý'];
  const PJ_TONE = { 'Đang thực hiện': 'info', 'Hoàn thành': 'success', 'Tạm dừng': 'warning', 'Đã thanh lý': '' };
  const PJ_TABS = [['list', 'Danh mục'], ['pnl', 'Doanh thu − chi phí − lãi'], ['debt', 'Công nợ theo hợp đồng']];
  const TRANSFER = ['KCCP', 'KCGT', 'KC'];
  const COST_GROUPS = [['621', 'NVL'], ['622', 'Nhân công'], ['623', 'Máy thi công'], ['627', 'SXC'], ['154', 'TT 154'], ['632', 'Giá vốn'], ['642', 'Quản lý, bán hàng']];
  const pjName = (code) => { const d = E.db(); const p = d.projects.find((x) => x.code === code) || d.costObjects.find((x) => x.code === code); return p ? p.name : code ? code : 'Chưa gắn công trình'; };
  const pjUsed = (code) => E.db().entries.some((e) => e.lines.some((l) => l.ct === code || l.ctCr === code));

  /* Revenue and cost per ct dimension for a period, ignoring transfer entries so cost is counted once. */
  function pjPnl(period) {
    const d = E.db(); const rows = {};
    const get = (ct) => (rows[ct || ''] = rows[ct || ''] || { ct: ct || '', rev: 0, cost: Object.fromEntries(COST_GROUPS.map(([g]) => [g, 0])) });
    const group = (acc) => COST_GROUPS.find(([g]) => acc.startsWith(g) || (g === '642' && /^64/.test(acc)))?.[0];
    d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && e.date.slice(0, 7) === period && !TRANSFER.includes(e.type)).forEach((e) => e.lines.forEach((l) => {
      if (l.cr && /^511/.test(l.cr)) get(E.ctOf(l, 'cr')).rev += l.amt;
      if (l.dr && /^(511|521)/.test(l.dr)) get(E.ctOf(l, 'dr')).rev -= l.amt;
      if (l.dr && group(l.dr)) get(E.ctOf(l, 'dr')).cost[group(l.dr)] += l.amt;
      if (l.cr && group(l.cr)) get(E.ctOf(l, 'cr')).cost[group(l.cr)] -= l.amt;
    }));
    d.projects.filter((p) => p.active).forEach((p) => get(p.code));
    return Object.values(rows).map((r) => { const cost = Object.values(r.cost).reduce((s, v) => s + v, 0); return { ...r, total: cost, profit: r.rev - cost }; })
      .filter((r) => r.rev || r.total || r.ct).sort((a, z) => (a.ct === '' ? 1 : z.ct === '' ? -1 : a.ct.localeCompare(z.ct)));
  }
  /* Cumulative receivable/payable by ct (opening balances carry no ct, so the report starts at the first dimensioned voucher). */
  function pjDebt() {
    const d = E.db(); const end = E.lastDay(state.period); const rows = {};
    const get = (ct) => (rows[ct] = rows[ct] || { ct, arD: 0, arC: 0, apC: 0, apD: 0 });
    d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && e.date <= end && !TRANSFER.includes(e.type)).forEach((e) => e.lines.forEach((l) => {
      if (l.dr === '131' && E.ctOf(l, 'dr')) get(E.ctOf(l, 'dr')).arD += l.amt;
      if (l.cr === '131' && E.ctOf(l, 'cr')) get(E.ctOf(l, 'cr')).arC += l.amt;
      if (l.cr === '331' && E.ctOf(l, 'cr')) get(E.ctOf(l, 'cr')).apC += l.amt;
      if (l.dr === '331' && E.ctOf(l, 'dr')) get(E.ctOf(l, 'dr')).apD += l.amt;
    }));
    d.projects.filter((p) => p.active).forEach((p) => get(p.code));
    return Object.values(rows).sort((a, z) => a.ct.localeCompare(z.ct));
  }

  function projectDialog(p) {
    const d = E.db(); const isNew = !p;
    const investors = d.cps.filter((c) => c.active && c.kind === 'customer');
    E.openDialog({
      eyebrow: 'Hợp đồng & công trình', title: isNew ? 'Thêm công trình, hợp đồng' : `${p.code} · ${p.name}`, size: 'lg',
      body: `<div class="form-grid">
        <div class="field span-4"><label class="label" for="pj-code">Mã<span class="req">*</span></label><input id="pj-code" class="input mono" value="${esc(p ? p.code : '')}" ${p && pjUsed(p.code) ? 'readonly aria-describedby="pj-code-h"' : ''} placeholder="CT-HL04"><span class="help" id="pj-code-h">${p && pjUsed(p.code) ? 'Mã đã phát sinh trên chứng từ nên không đổi được.' : 'Chữ hoa, số, dấu gạch ngang; không dấu tiếng Việt.'}</span></div>
        <div class="field span-8"><label class="label" for="pj-name">Tên<span class="req">*</span></label><input id="pj-name" class="input" value="${esc(p ? p.name : '')}"></div>
        <div class="field span-4"><label class="label" for="pj-kind">Loại</label><select id="pj-kind" class="select">${['Công trình', 'Hợp đồng'].map((k) => `<option ${p && p.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="field span-8"><label class="label" for="pj-inv">Chủ đầu tư, khách hàng</label><select id="pj-inv" class="select"><option value="">Chưa chọn</option>${investors.map((c) => `<option value="${esc(c.code)}" ${p && p.investor === c.code ? 'selected' : ''}>${esc(c.code)} · ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field span-4"><label class="label" for="pj-no">Số hợp đồng</label><input id="pj-no" class="input mono" value="${esc(p ? p.contractNo : '')}"></div>
        <div class="field span-4"><label class="label" for="pj-val">Giá trị hợp đồng (đ)</label><input id="pj-val" class="input mono" inputmode="numeric" value="${p ? money(p.value) : ''}"></div>
        <div class="field span-4"><label class="label" for="pj-st">Trạng thái</label><select id="pj-st" class="select">${PJ_STATUS.map((s) => `<option ${p && p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field span-6"><label class="label" for="pj-from">Ngày bắt đầu</label><input id="pj-from" class="input mono" type="date" value="${esc(p ? p.start : '')}"></div>
        <div class="field span-6"><label class="label" for="pj-to">Ngày kết thúc dự kiến</label><input id="pj-to" class="input mono" type="date" value="${esc(p ? p.end : '')}"></div>
      </div>`,
      actions: [
        ...(p ? [{ label: p.active ? 'Ngừng dùng' : 'Dùng lại', variant: 'btn-outline', run() { if (!E.canWrite()) { readonlyToast(); return; } p.active = !p.active; E.refresh(); E.toast(p.active ? 'Đã dùng lại' : 'Đã ngừng dùng', { text: p.code }); } }] : []),
        ...(p && !pjUsed(p.code) ? [{ label: 'Xóa', variant: 'btn-danger-outline', icon: 'trash', run() { if (!E.canWrite()) { readonlyToast(); return; } d.projects.splice(d.projects.indexOf(p), 1); E.refresh(); E.toast('Đã xóa', { text: p.code }); } }] : []),
        { spacer: true }, { label: 'Hủy', variant: 'btn-outline' },
        { label: isNew ? 'Thêm' : 'Lưu', run(api) {
          if (!E.canWrite()) { readonlyToast(); return false; }
          if (!api.validate()) return false;
          const v = (id) => api.el.querySelector(`#${id}`).value.trim();
          const rec = { code: v('pj-code').toUpperCase(), name: v('pj-name'), kind: v('pj-kind'), investor: v('pj-inv'), contractNo: v('pj-no'), value: num(v('pj-val')), status: v('pj-st'), start: v('pj-from'), end: v('pj-to'), active: p ? p.active : true };
          if (p) Object.assign(p, rec); else d.projects.push(rec);
          E.refresh(); E.toast(isNew ? 'Đã thêm' : 'Đã lưu', { text: rec.code });
          return true;
        } },
      ],
      onMount(api) {
        api.validate = bindRules(api.el, {
          'pj-code': (s, el) => (!s ? 'Nhập mã.' : !/^[A-Za-z0-9-]+$/.test(s) ? 'Chỉ dùng chữ, số và dấu gạch ngang, không dấu tiếng Việt.' : d.projects.some((x) => x.code === s.toUpperCase() && x !== p) || (el.readOnly ? false : d.costObjects.some((o) => o.code === s.toUpperCase() && !d.projects.some((x) => x.code === o.code))) ? 'Mã đã tồn tại.' : ''),
          'pj-name': (s) => (s ? '' : 'Nhập tên công trình hoặc hợp đồng.'),
          'pj-val': (s) => (s && num(s) < 0 ? 'Giá trị không âm.' : ''),
          'pj-to': (s) => { const f = api.el.querySelector('#pj-from').value; return s && f && s < f ? 'Ngày kết thúc phải sau ngày bắt đầu.' : ''; },
        });
        const val = api.el.querySelector('#pj-val');
        val.addEventListener('blur', () => { if (val.value) val.value = money(num(val.value)); });
      },
      initialFocus: '#pj-name',
    });
  }

  E.views.projects = {
    render(params) {
      const d = E.db(); const tab = params.tab || 'list';
      const can = E.canWrite();
      const money0 = (v) => (v ? money(v) : '–');
      let body = '';
      if (tab === 'list') {
        const used = (code) => pjUsed(code);
        body = d.projects.length ? `<div class="table-wrap"><table class="tbl" id="pj-table"><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Chủ đầu tư</th><th>Số HĐ</th><th class="num">Giá trị HĐ</th><th>Thời gian</th><th>Trạng thái</th><th>Chứng từ</th></tr></thead>
          <tbody>${d.projects.map((p) => `<tr class="is-click${p.active ? '' : ' vm-inactive'}" tabindex="0" data-a="open" data-code="${esc(p.code)}"><td class="mono is-tight">${esc(p.code)}</td><td><span class="strong">${esc(p.name)}</span></td><td class="is-tight">${esc(p.kind)}</td><td>${esc(E.cpName(p.investor) || '–')}</td><td class="mono is-tight">${esc(p.contractNo || '–')}</td><td class="num">${money0(p.value)}</td><td class="is-tight mono">${p.start ? dmy(p.start) : '–'} → ${p.end ? dmy(p.end) : '–'}</td><td class="is-tight">${badge(PJ_TONE[p.status], p.status)}${p.active ? '' : badge('', 'Ngừng dùng')}</td><td class="is-tight">${used(p.code) ? badge('info', 'Đã có chứng từ') : '<span class="faint">Chưa dùng</span>'}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty">${icon('folder')}<span class="empty-title">Chưa có công trình, hợp đồng</span><span class="empty-text">Thêm công trình để chọn ở cột Mã C.Trình khi nhập chứng từ.</span></div>`;
      } else if (tab === 'pnl') {
        const rows = pjPnl(state.period);
        const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
        body = `${printHead('Doanh thu, chi phí, lãi theo công trình')}<div class="table-wrap"><table class="tbl" id="pj-table"><thead><tr><th>Công trình, hợp đồng</th><th class="num">Doanh thu</th>${COST_GROUPS.map(([, l]) => `<th class="num">${esc(l)}</th>`).join('')}<th class="num">Tổng chi phí</th><th class="num">Lãi (lỗ)</th><th class="num">Tỷ suất</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td><span class="strong">${esc(r.ct || 'Chưa gắn công trình')}</span> <span class="muted">${r.ct ? esc(pjName(r.ct)) : ''}</span></td><td class="num">${money0(r.rev)}</td>${COST_GROUPS.map(([g]) => `<td class="num">${money0(r.cost[g])}</td>`).join('')}<td class="num">${money0(r.total)}</td><td class="num ${r.profit < 0 ? 'text-danger' : ''}">${E.signed(r.profit)}</td><td class="num">${r.rev ? `${(Math.round((r.profit / r.rev) * 1000) / 10).toLocaleString('vi-VN')}%` : '–'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Cộng</td><td class="num">${money0(sum((r) => r.rev))}</td>${COST_GROUPS.map(([g]) => `<td class="num">${money0(sum((r) => r.cost[g]))}</td>`).join('')}<td class="num">${money0(sum((r) => r.total))}</td><td class="num">${E.signed(sum((r) => r.profit))}</td><td></td></tr></tfoot></table></div>
          <p class="help" style="padding:12px 20px">Chi phí tính một lần: lấy khi phát sinh ở TK 621–627, 632, 641–642 theo mã công trình trên dòng chứng từ; bút toán kết chuyển 154 và giá thành không tính lại.</p>`;
      } else {
        const rows = pjDebt();
        body = `${printHead('Công nợ theo công trình, hợp đồng')}<div class="table-wrap"><table class="tbl" id="pj-table"><thead><tr><th>Công trình, hợp đồng</th><th class="num">Giá trị HĐ</th><th class="num">Đã ghi phải thu</th><th class="num">Đã thu</th><th class="num">Còn phải thu</th><th class="num">Tỷ lệ thu</th><th class="num">Đã ghi phải trả</th><th class="num">Đã trả</th><th class="num">Còn phải trả</th></tr></thead>
          <tbody>${rows.map((r) => { const p = d.projects.find((x) => x.code === r.ct); return `<tr><td><span class="strong">${esc(r.ct)}</span> <span class="muted">${esc(pjName(r.ct))}</span></td><td class="num">${money0(p ? p.value : 0)}</td><td class="num">${money0(r.arD)}</td><td class="num">${money0(r.arC)}</td><td class="num strong">${E.signed(r.arD - r.arC)}</td><td class="num">${p && p.value ? `${Math.round((r.arC / p.value) * 100)}%` : '–'}</td><td class="num">${money0(r.apC)}</td><td class="num">${money0(r.apD)}</td><td class="num strong">${E.signed(r.apC - r.apD)}</td></tr>`; }).join('')}</tbody></table></div>
          <p class="help" style="padding:12px 20px">Số dư đầu kỳ nhập từ Smart Pro chưa gắn công trình nên báo cáo bắt đầu từ chứng từ đầu tiên có mã công trình.</p>`;
      }
      return `<div class="page">
        <div class="page-header"><div class="od-fill"><h1 class="page-title">Hợp đồng & công trình</h1><span class="page-sub">Danh mục KTGTCT · ${d.projects.length} mục · kỳ ${E.periodLabel(state.period)}</span></div>
          <div class="page-actions">${tab === 'list' ? '' : `${printBtn}${csvBtn()}`}<button type="button" class="btn" data-a="add" data-primary-action ${can ? '' : 'disabled'}>${icon('plus')}Thêm công trình, hợp đồng</button></div></div>
        <div class="card">${tabsHtml(PJ_TABS, tab)}${body}</div>
      </div>`;
    },
    mount(host, params) {
      const tab = params.tab || 'list';
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'tab') E.refresh({ tab: t.dataset.tab });
        if (a === 'add') { if (!E.canWrite()) return readonlyToast(); projectDialog(null); }
        if (a === 'open') projectDialog(E.db().projects.find((p) => p.code === t.dataset.code));
        if (a === 'csv') E.downloadCsv(`${tab === 'pnl' ? 'doanh-thu-chi-phi-lai' : tab === 'debt' ? 'cong-no-hop-dong' : 'hop-dong-cong-trinh'}-${state.period}.csv`, E.tableRows(host.querySelector('#pj-table')));
        if (a === 'print') E.printPage(`${tab === 'pnl' ? 'Doanh thu, chi phí, lãi theo công trình' : 'Công nợ theo công trình'} ${E.periodLabel(state.period)}`);
      });
      host.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-a="open"]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); } });
    },
  };

  /* ======================= Loại chứng từ ======================= */
  const SCREENS = { grid: 'Lưới nhập chứng từ', stock: 'Màn nhập xuất kho', job: 'Do xử lý cuối kỳ sinh ra' };
  const FLAGS = [['coVthh', 'Co_VTHH', 'Có hàng hóa, vật tư'], ['coXuatKho', 'Co_XuatKho', 'Có xuất kho, giá vốn'], ['coLoNhap', 'Co_LoNhap', 'Nhập theo lô'], ['coTsChiTiet', 'Co_TSChiTiet', 'Thuế GTGT chi tiết']];
  const vtUsage = (code) => E.db().entries.filter((e) => e.type === code).length;

  function vtypeDialog(v) {
    const d = E.db(); const isNew = !v;
    const accPick = (id, label, val) => `<div class="field span-4"><label class="label" for="${id}">${label}</label><input id="${id}" class="input mono" value="${esc(val || '')}" placeholder="Để trống nếu chọn khi nhập"></div>`;
    E.openDialog({
      eyebrow: 'Loại chứng từ', title: isNew ? 'Thêm loại chứng từ' : `${v.code} · ${v.name}`, size: 'lg',
      body: `<div class="form-grid">
        <div class="field span-4"><label class="label" for="vt-code">Mã<span class="req">*</span></label><input id="vt-code" class="input mono" value="${esc(v ? v.code : '')}" ${v ? 'readonly' : ''}><span class="help">${v ? 'Mã không đổi được.' : '2–8 ký tự chữ hoa, số, gạch dưới.'}</span></div>
        <div class="field span-8"><label class="label" for="vt-name">Tên<span class="req">*</span></label><input id="vt-name" class="input" value="${esc(v ? v.name : '')}"></div>
        <div class="field span-4"><label class="label" for="vt-group">Nhóm</label><select id="vt-group" class="select">${['Thu chi', 'Mua bán', 'Kho', 'Tổng hợp'].map((g) => `<option ${v && v.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field span-8"><label class="label" for="vt-screen">Kiểu màn hình nhập</label><select id="vt-screen" class="select" ${v && v.sys && v.screen === 'job' ? 'disabled' : ''}>${Object.entries(SCREENS).map(([k, l]) => `<option value="${k}" ${v && v.screen === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${accPick('vt-no', 'TK Nợ mặc định', v && v.tkno)}${accPick('vt-co', 'TK Có mặc định', v && v.tkco)}${accPick('vt-thue', 'TK thuế', v && v.tkthue)}
        <fieldset class="span-12 od-stack" style="border:0;padding:0;margin:0;--od-gap:6px"><legend class="label">Cờ chứng từ</legend>
          ${FLAGS.map(([k, code, l]) => `<label class="od-row" style="--od-gap:8px"><input type="checkbox" class="check" data-flag="${k}" ${v && v[k] ? 'checked' : ''}><span>${esc(l)} <span class="mono muted">${code}</span></span></label>`).join('')}</fieldset>
        ${v && v.note ? `<p class="help span-12">${esc(v.note)}</p>` : ''}
      </div>`,
      actions: [
        ...(v ? [{ label: v.active ? 'Ngừng dùng' : 'Dùng lại', variant: 'btn-outline', run() { if (!E.canWrite()) { readonlyToast(); return; } v.active = !v.active; E.refresh(); E.toast(v.active ? 'Đã dùng lại' : 'Đã ngừng dùng', { text: v.code }); } }] : []),
        ...(v && !v.sys && !vtUsage(v.code) ? [{ label: 'Xóa', variant: 'btn-danger-outline', icon: 'trash', run() { if (!E.canWrite()) { readonlyToast(); return; } d.vtypes.splice(d.vtypes.indexOf(v), 1); E.refresh(); E.toast('Đã xóa loại chứng từ', { text: v.code }); } }] : []),
        { spacer: true }, { label: 'Hủy', variant: 'btn-outline' },
        { label: isNew ? 'Thêm' : 'Lưu', run(api) {
          if (!E.canWrite()) { readonlyToast(); return false; }
          if (!api.validate()) return false;
          const g = (id) => api.el.querySelector(`#${id}`).value.trim();
          const rec = { code: v ? v.code : g('vt-code').toUpperCase(), name: g('vt-name'), group: g('vt-group'), screen: v && v.sys && v.screen === 'job' ? 'job' : g('vt-screen'), tkno: g('vt-no'), tkco: g('vt-co'), tkthue: g('vt-thue') };
          FLAGS.forEach(([k]) => { rec[k] = api.el.querySelector(`[data-flag="${k}"]`).checked; });
          if (v) Object.assign(v, rec); else { d.vtypes.push({ ...rec, note: '', sys: false, active: true }); d.counters[rec.code] = d.counters[rec.code] || 0; }
          E.refresh(); E.toast(isNew ? 'Đã thêm loại chứng từ' : 'Đã lưu', { text: rec.code });
          return true;
        } },
      ],
      onMount(api) {
        const accRule = (s) => (s && !E.acc(s) ? `TK ${s} không có trong hệ thống tài khoản.` : s && !E.acc(s).postable ? `${s} là TK tổng hợp, chọn TK chi tiết.` : '');
        api.validate = bindRules(api.el, {
          'vt-code': (s, el) => (el.readOnly ? '' : !s ? 'Nhập mã.' : !/^[A-Z0-9_]{2,8}$/i.test(s) ? 'Mã gồm 2–8 ký tự chữ, số, gạch dưới.' : d.vtypes.some((x) => x.code === s.toUpperCase()) ? 'Mã đã tồn tại.' : ''),
          'vt-name': (s) => (s ? '' : 'Nhập tên loại chứng từ.'),
          'vt-no': accRule, 'vt-co': accRule,
          'vt-thue': (s) => (s && !['1331', '33311', '1332', '33312'].includes(s) && !(E.acc(s) && E.acc(s).postable) ? `TK thuế ${s} không hợp lệ.` : ''),
        });
        ['vt-no', 'vt-co', 'vt-thue'].forEach((id) => {
          const inp = api.el.querySelector(`#${id}`);
          E.autocomplete(inp, { items: (q) => d.accounts.filter((a) => a.postable && a.active && (!q || a.code.startsWith(q.trim()) || E.matches(`${a.code} ${a.name}`, q))).map((a) => ({ value: a.code, code: a.code, name: a.name })), onPick: (it) => { inp.value = it.code; fieldErr(inp, ''); } });
        });
      },
      initialFocus: v ? '#vt-name' : '#vt-code',
    });
  }

  E.views.vtypes = {
    render() {
      const d = E.db(); const can = E.canWrite();
      const flag = (v, k) => (v[k] ? '<span class="strong">Có</span>' : '<span class="faint">–</span>');
      const groups = [...new Set(d.vtypes.map((v) => v.group))];
      return `<div class="page">
        <div class="page-header"><div class="od-fill"><h1 class="page-title">Loại chứng từ</h1><span class="page-sub">Danh mục KTLCTG · ${d.vtypes.length} loại theo ${esc(E.rm().label)}</span></div>
          <div class="page-actions"><button type="button" class="btn" data-a="add" data-primary-action ${can ? '' : 'disabled'}>${icon('plus')}Thêm loại chứng từ</button></div></div>
        <div class="banner" style="border-radius:var(--r-lg);border:1px solid var(--info-100);background:var(--info-50);color:var(--info-700)">${icon('info')}<span><b>HD</b> là hóa đơn bán ra dịch vụ, <b>HDBR</b> là bán ra có mã hàng hóa, <b>HDMV</b> là mua vào (mã riêng của mockup). Các mã trước đây: HD cũ (mua vào) nay là HDMV; HDBR cũ (bán ra dịch vụ) nay là HD.</span></div>
        <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên</th><th>TK Nợ</th><th>TK Có</th><th>TK thuế</th>${FLAGS.map(([, c]) => `<th class="mono">${c}</th>`).join('')}<th>Màn hình nhập</th><th class="num">Chứng từ</th><th>Trạng thái</th></tr></thead>
          <tbody>${groups.map((g) => `<tr class="is-group"><td colspan="${6 + FLAGS.length + 2}">${esc(g)}</td></tr>${d.vtypes.filter((v) => v.group === g).map((v) => `<tr class="is-click${v.active ? '' : ' vm-inactive'}" tabindex="0" data-a="open" data-code="${esc(v.code)}"><td class="mono strong is-tight">${esc(v.code)}</td><td>${esc(v.name)}${v.note ? ` <span class="faint" title="${esc(v.note)}">${icon('info')}</span>` : ''}</td><td class="mono">${esc(v.tkno || '–')}</td><td class="mono">${esc(v.tkco || '–')}</td><td class="mono">${esc(v.tkthue || '–')}</td>${FLAGS.map(([k]) => `<td class="is-tight">${flag(v, k)}</td>`).join('')}<td>${esc(SCREENS[v.screen])}</td><td class="num">${vtUsage(v.code) || '–'}</td><td class="is-tight">${v.active ? badge('success', 'Đang dùng') : badge('', 'Ngừng dùng')}${v.sys ? '' : badge('info', 'Tự thêm')}</td></tr>`).join('')}`).join('')}</tbody></table></div></div>
      </div>`;
    },
    mount(host) {
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        if (t.dataset.a === 'add') { if (!E.canWrite()) return readonlyToast(); vtypeDialog(null); }
        if (t.dataset.a === 'open') vtypeDialog(E.db().vtypes.find((v) => v.code === t.dataset.code));
      });
      host.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-a="open"]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); } });
    },
  };

  /* ======================= Số dư đầu kỳ ======================= */
  const drafts = {};
  const draftOf = () => {
    const id = state.companyId;
    if (!drafts[id]) drafts[id] = { data: JSON.parse(JSON.stringify(E.db().opening)), dirty: false };
    return drafts[id];
  };
  const OP_TABS = [['acc', 'Theo tài khoản'], ['cp', 'Công nợ theo đối tượng'], ['goods', 'Theo hàng hóa'], ['wip', 'Dở dang 154']];
  /* Same totals the SDDK entry will carry, computed on the draft so imbalance is visible before saving. */
  function draftCheck(op) {
    const d = E.db(); const saved = d.opening;
    d.opening = op;
    const res = E.openingCheck(d);
    d.opening = saved;
    return res;
  }

  function opRowDialog(row, withCp) {
    const dr = draftOf(); const op = dr.data; const d = E.db(); const isNew = !row;
    E.openDialog({
      eyebrow: 'Số dư đầu kỳ', title: isNew ? (withCp ? 'Thêm số dư công nợ' : 'Thêm số dư tài khoản') : `TK ${row.acc}`,
      body: `<div class="form-grid">
        <div class="field span-4"><label class="label" for="op-acc">Tài khoản<span class="req">*</span></label><input id="op-acc" class="input mono" value="${esc(row ? row.acc : '')}" placeholder="Gõ mã hoặc tên TK"></div>
        <div class="field span-4"><label class="label" for="op-side">Bên số dư</label><select id="op-side" class="select"><option value="D" ${row && row.side === 'D' ? 'selected' : ''}>Dư Nợ</option><option value="C" ${row && row.side === 'C' ? 'selected' : ''}>Dư Có</option></select></div>
        <div class="field span-4"><label class="label" for="op-amt">Số tiền (đ)<span class="req">*</span></label><input id="op-amt" class="input mono" inputmode="numeric" value="${row ? money(row.amt) : ''}"></div>
        ${withCp ? `<div class="field span-12"><label class="label" for="op-cp">Đối tượng<span class="req">*</span></label><input id="op-cp" class="input" value="${row && row.cp ? esc(`${row.cp} · ${E.cpName(row.cp)}`) : ''}" placeholder="Gõ mã, tên hoặc MST"><input type="hidden" id="op-cp-code" value="${esc(row && row.cp ? row.cp : '')}"></div>` : ''}
        <p class="help span-12">${withCp ? 'TK 131, 331, 141 và các TK theo dõi đối tượng bắt buộc chọn đối tượng. TK 334 chọn nhân viên.' : 'TK 15x lấy từ tab Theo hàng hóa, TK 154 lấy từ tab Dở dang, công nợ lấy từ tab Công nợ.'}</p>
      </div>`,
      actions: [
        ...(row ? [{ label: 'Xóa dòng', variant: 'btn-danger-outline', icon: 'trash', run() { op.rows.splice(op.rows.indexOf(row), 1); dr.dirty = true; E.refresh({ tab: withCp ? 'cp' : 'acc' }); } }] : []),
        { spacer: true }, { label: 'Hủy', variant: 'btn-outline' },
        { label: isNew ? 'Thêm' : 'Lưu', run(api) {
          if (!api.validate()) return false;
          const g = (id) => api.el.querySelector(`#${id}`).value.trim();
          const rec = { id: row ? row.id : E.uid('o'), acc: g('op-acc'), side: g('op-side'), amt: num(g('op-amt')), cp: withCp ? g('op-cp-code') : null };
          if (row) Object.assign(row, rec); else op.rows.push(rec);
          dr.dirty = true; E.refresh({ tab: withCp ? 'cp' : 'acc' });
          return true;
        } },
      ],
      onMount(api) {
        const derived = /^(15[2356]|154)/;
        api.validate = bindRules(api.el, {
          'op-acc': (s) => { const a = E.acc(s); return !s ? 'Nhập tài khoản.' : !a ? `TK ${s} không có trong hệ thống tài khoản.` : !a.postable ? `${s} là TK tổng hợp, chọn TK chi tiết.` : derived.test(s) ? `TK ${s} lấy từ tab ${/^154/.test(s) ? 'Dở dang 154' : 'Theo hàng hóa'}, không nhập ở đây.` : withCp && !a.cp && s !== '334' ? `TK ${s} không theo dõi đối tượng, nhập ở tab Theo tài khoản.` : !withCp && a.cp ? `TK ${s} theo dõi đối tượng, nhập ở tab Công nợ theo đối tượng.` : ''; },
          'op-amt': (s) => (num(s) > 0 ? '' : 'Số tiền phải lớn hơn 0.'),
          ...(withCp ? { 'op-cp': (s) => (api.el.querySelector('#op-cp-code').value && s ? '' : 'Chọn đối tượng từ danh sách.') } : {}),
        });
        const acc = api.el.querySelector('#op-acc');
        E.autocomplete(acc, { items: (q) => d.accounts.filter((a) => a.postable && a.active && (!q || a.code.startsWith(q.trim()) || E.matches(`${a.code} ${a.name}`, q))).map((a) => ({ value: a.code, code: a.code, name: a.name, meta: a.cp ? 'Theo dõi đối tượng' : '' })), onPick: (it) => { acc.value = it.code; fieldErr(acc, ''); } });
        const amt = api.el.querySelector('#op-amt');
        amt.addEventListener('blur', () => { if (amt.value) amt.value = money(num(amt.value)); });
        if (withCp) {
          const cpIn = api.el.querySelector('#op-cp');
          E.autocomplete(cpIn, { items: (q) => d.cps.filter((c) => c.active && (!q || E.matches(`${c.code} ${c.name} ${c.mst}`, q))).map((c) => ({ value: c.code, code: c.code, name: c.name, meta: E.kindLabel[c.kind] })), onPick: (it) => { cpIn.value = `${it.code} · ${it.name}`; api.el.querySelector('#op-cp-code').value = it.code; fieldErr(cpIn, ''); } });
          cpIn.addEventListener('input', () => { api.el.querySelector('#op-cp-code').value = ''; });
        }
      },
      initialFocus: '#op-acc',
    });
  }

  function opGoodsDialog(row) {
    const dr = draftOf(); const op = dr.data; const d = E.db(); const isNew = !row;
    E.openDialog({
      eyebrow: 'Số dư đầu kỳ', title: isNew ? 'Thêm tồn kho đầu kỳ' : `${row.item}`,
      body: `<div class="form-grid">
        <div class="field span-12"><label class="label" for="og-item">Hàng hóa<span class="req">*</span></label><input id="og-item" class="input" value="${row ? esc(`${row.item} · ${(E.goodsOf(row.item) || {}).name || ''}`) : ''}" placeholder="Gõ mã hoặc tên hàng"><input type="hidden" id="og-code" value="${esc(row ? row.item : '')}"></div>
        <div class="field span-4"><label class="label" for="og-wh">Kho<span class="req">*</span></label><select id="og-wh" class="select">${d.warehouses.map((w) => `<option value="${esc(w.code)}" ${row && row.wh === w.code ? 'selected' : ''}>${esc(w.code)} · ${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field span-4"><label class="label" for="og-lot">Lô</label><input id="og-lot" class="input mono" value="${esc(row ? row.lot : '')}" placeholder="Chỉ cho hàng theo lô"></div>
        <div class="field span-4"><label class="label" for="og-qty">Số lượng<span class="req">*</span></label><input id="og-qty" class="input mono" inputmode="decimal" value="${row ? String(row.qty).replace('.', ',') : ''}"></div>
        <div class="field span-6"><label class="label" for="og-val">Giá trị (đ)<span class="req">*</span></label><input id="og-val" class="input mono" inputmode="numeric" value="${row ? money(row.val) : ''}"></div>
        <div class="field span-6"><label class="label" for="og-unit">Đơn giá bình quân</label><input id="og-unit" class="input mono" readonly value="${row && row.qty ? money(row.val / row.qty) : ''}"></div>
      </div>`,
      actions: [
        ...(row ? [{ label: 'Xóa dòng', variant: 'btn-danger-outline', icon: 'trash', run() { op.goods.splice(op.goods.indexOf(row), 1); dr.dirty = true; E.refresh({ tab: 'goods' }); } }] : []),
        { spacer: true }, { label: 'Hủy', variant: 'btn-outline' },
        { label: isNew ? 'Thêm' : 'Lưu', run(api) {
          if (!api.validate()) return false;
          const g = (id) => api.el.querySelector(`#${id}`).value.trim();
          const rec = { item: g('og-code'), wh: g('og-wh'), lot: g('og-lot'), qty: Number(g('og-qty').replace(',', '.')), val: num(g('og-val')) };
          if (row) Object.assign(row, rec); else op.goods.push(rec);
          dr.dirty = true; E.refresh({ tab: 'goods' });
          return true;
        } },
      ],
      onMount(api) {
        api.validate = bindRules(api.el, {
          'og-item': () => (api.el.querySelector('#og-code').value ? '' : 'Chọn hàng hóa từ danh sách.'),
          'og-qty': (s) => (Number(s.replace(',', '.')) > 0 ? '' : 'Số lượng phải lớn hơn 0.'),
          'og-val': (s) => (num(s) >= 0 && s ? '' : 'Nhập giá trị tồn đầu kỳ (không âm).'),
          'og-lot': (s) => { const g = E.goodsOf(api.el.querySelector('#og-code').value); return g && g.lot && !s ? `Hàng ${g.code} theo dõi lô, nhập số lô.` : g && !g.lot && s ? `Hàng ${g.code} không theo dõi lô, để trống.` : ''; },
        });
        const item = api.el.querySelector('#og-item');
        E.autocomplete(item, { items: (q) => d.goods.filter((x) => x.active && (!q || E.matches(`${x.code} ${x.name}`, q))).map((x) => ({ value: x.code, code: x.code, name: x.name, meta: `${x.unit} · TK ${x.tkKho}` })), onPick: (it) => { item.value = `${it.code} · ${it.name}`; api.el.querySelector('#og-code').value = it.code; fieldErr(item, ''); } });
        item.addEventListener('input', () => { api.el.querySelector('#og-code').value = ''; });
        const val = api.el.querySelector('#og-val'); const qty = api.el.querySelector('#og-qty'); const unit = api.el.querySelector('#og-unit');
        const upd = () => { const q = Number(qty.value.replace(',', '.')); unit.value = q > 0 && val.value ? money(num(val.value) / q) : ''; };
        val.addEventListener('input', upd); qty.addEventListener('input', upd);
        val.addEventListener('blur', () => { if (val.value) val.value = money(num(val.value)); });
      },
      initialFocus: '#og-item',
    });
  }

  function opWipDialog(w, obj) {
    const dr = draftOf(); const op = dr.data;
    const e = w ? w.e : { 621: 0, 622: 0, 623: 0, 627: 0, 154: 0 };
    E.openDialog({
      eyebrow: 'Số dư đầu kỳ · Dở dang 154', title: `${obj.code} · ${obj.name}`,
      body: `<div class="form-grid">${[['621', 'NVL trực tiếp'], ['622', 'Nhân công trực tiếp'], ['623', 'Máy thi công'], ['627', 'Sản xuất chung']].map(([a, l]) => `<div class="field span-6"><label class="label" for="ow-${a}">${l} (TK ${a})</label><input id="ow-${a}" class="input mono" inputmode="numeric" value="${e[a] ? money(e[a]) : ''}"></div>`).join('')}</div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: 'Lưu', run(api) {
        if (!api.validate()) return false;
        const ne = { 154: 0 }; ['621', '622', '623', '627'].forEach((a) => { ne[a] = num(api.el.querySelector(`#ow-${a}`).value); });
        const rest = op.wip.filter((x) => x.obj !== obj.code);
        op.wip = Object.values(ne).some((v) => v) ? [...rest, { obj: obj.code, e: ne }] : rest;
        dr.dirty = true; E.refresh({ tab: 'wip' });
        return true;
      } }],
      onMount(api) {
        api.validate = bindRules(api.el, Object.fromEntries(['621', '622', '623', '627'].map((a) => [`ow-${a}`, (s) => (num(s) < 0 ? 'Không âm.' : '')])));
        ['621', '622', '623', '627'].forEach((a) => { const el = api.el.querySelector(`#ow-${a}`); el.addEventListener('blur', () => { if (el.value) el.value = money(num(el.value)); }); });
      },
      initialFocus: '#ow-621',
    });
  }

  E.views.opening = {
    render(params) {
      const d = E.db(); const dr = draftOf(); const op = dr.data; const tab = params.tab || 'acc';
      const chk = draftCheck(op);
      const can = E.canWrite();
      const balanced = chk.diff === 0;
      const sumBy = (rows) => rows.reduce((a, r) => { a[r.side === 'D' ? 'd' : 'c'] += r.amt; return a; }, { d: 0, c: 0 });
      const goodsByAcc = {};
      op.goods.forEach((g) => { const k = (E.goodsOf(g.item) || {}).tkKho; if (k) goodsByAcc[k] = (goodsByAcc[k] || 0) + g.val; });
      const wipTotal = op.wip.reduce((s, w) => s + Object.values(w.e).reduce((x, v) => x + v, 0), 0);
      let body = '';
      if (tab === 'acc') {
        const free = op.rows.filter((r) => !r.cp && !(E.acc(r.acc) || {}).cp);
        const cpAgg = {};
        op.rows.filter((r) => r.cp || (E.acc(r.acc) || {}).cp).forEach((r) => { const k = `${r.acc}|${r.side}`; cpAgg[k] = (cpAgg[k] || 0) + r.amt; });
        const derived = [...Object.entries(goodsByAcc).map(([a, v]) => [a, 'D', v, 'goods', 'Từ tab Theo hàng hóa']), ...(wipTotal ? [['154', 'D', wipTotal, 'wip', 'Từ tab Dở dang 154']] : []), ...Object.entries(cpAgg).map(([k, v]) => [k.split('|')[0], k.split('|')[1], v, 'cp', 'Từ tab Công nợ theo đối tượng'])];
        body = `<div class="table-wrap"><table class="tbl" id="op-table"><thead><tr><th>Tài khoản</th><th>Tên</th><th class="num">Dư Nợ</th><th class="num">Dư Có</th><th>Nguồn</th></tr></thead><tbody>
          ${free.map((r) => `<tr class="is-click" tabindex="0" data-a="edit-row" data-id="${esc(r.id)}"><td class="mono strong">${esc(r.acc)}</td><td>${esc((E.acc(r.acc) || {}).name || '')}</td><td class="num">${r.side === 'D' ? money(r.amt) : ''}</td><td class="num">${r.side === 'C' ? money(r.amt) : ''}</td><td class="muted">Nhập tại đây</td></tr>`).join('')}
          ${derived.map(([a, s, v, tab2, src]) => `<tr class="is-sub is-click" tabindex="0" data-a="goto" data-tab="${tab2}"><td class="mono">${esc(a)}</td><td>${esc((E.acc(a) || {}).name || '')}</td><td class="num">${s === 'D' ? money(v) : ''}</td><td class="num">${s === 'C' ? money(v) : ''}</td><td class="muted">${src}</td></tr>`).join('')}
          </tbody><tfoot><tr><td colspan="2">Cộng</td><td class="num">${money(chk.dr)}</td><td class="num">${money(chk.cr)}</td><td></td></tr></tfoot></table></div>`;
      } else if (tab === 'cp') {
        const rows = op.rows.filter((r) => r.cp || (E.acc(r.acc) || {}).cp);
        body = rows.length ? `<div class="table-wrap"><table class="tbl" id="op-table"><thead><tr><th>Tài khoản</th><th>Đối tượng</th><th class="num">Dư Nợ</th><th class="num">Dư Có</th></tr></thead><tbody>
          ${rows.map((r) => `<tr class="is-click" tabindex="0" data-a="edit-cp" data-id="${esc(r.id)}"><td class="mono strong">${esc(r.acc)}</td><td><span class="mono">${esc(r.cp || '')}</span> ${esc(E.cpName(r.cp))}</td><td class="num">${r.side === 'D' ? money(r.amt) : ''}</td><td class="num">${r.side === 'C' ? money(r.amt) : ''}</td></tr>`).join('')}
          </tbody><tfoot><tr><td colspan="2">Cộng</td><td class="num">${money(sumBy(rows).d)}</td><td class="num">${money(sumBy(rows).c)}</td></tr></tfoot></table></div>`
          : `<div class="empty">${icon('users')}<span class="empty-title">Chưa có số dư công nợ</span><span class="empty-text">Thêm số dư phải thu, phải trả, tạm ứng, lương theo từng đối tượng.</span></div>`;
      } else if (tab === 'goods') {
        const totalVal = op.goods.reduce((s, g) => s + g.val, 0);
        body = `${Object.keys(goodsByAcc).length ? `<div class="card-body check-line" style="display:flex;gap:12px;flex-wrap:wrap">${Object.entries(goodsByAcc).map(([a, v]) => `${badge('success', `TK ${a}: ${money(v)}`, 'circle-check')}`).join('')}<span class="muted">Giá trị tồn đầu kỳ theo hàng tạo ra số dư các TK kho.</span></div>` : ''}
          ${op.goods.length ? `<div class="table-wrap"><table class="tbl" id="op-table"><thead><tr><th>Mã hàng</th><th>Tên</th><th>Kho</th><th>Lô</th><th class="num">Số lượng</th><th class="num">Đơn giá</th><th class="num">Giá trị</th><th>TK kho</th></tr></thead><tbody>
          ${op.goods.map((g, i) => { const it = E.goodsOf(g.item) || {}; return `<tr class="is-click" tabindex="0" data-a="edit-goods" data-i="${i}"><td class="mono strong">${esc(g.item)}</td><td>${esc(it.name || '')}</td><td class="mono">${esc(g.wh)}</td><td class="mono">${esc(g.lot || '–')}</td><td class="num">${String(g.qty).replace('.', ',')} ${esc(it.unit || '')}</td><td class="num">${g.qty ? money(g.val / g.qty) : '–'}</td><td class="num">${money(g.val)}</td><td class="mono">${esc(it.tkKho || '')}</td></tr>`; }).join('')}
          </tbody><tfoot><tr><td colspan="6">Cộng</td><td class="num">${money(totalVal)}</td><td></td></tr></tfoot></table></div>`
            : `<div class="empty">${icon('warehouse')}<span class="empty-title">Chưa có tồn kho đầu kỳ</span><span class="empty-text">Thêm số lượng và giá trị tồn từng hàng, từng kho.</span></div>`}`;
      } else {
        body = d.costObjects.length ? `<div class="table-wrap"><table class="tbl" id="op-table"><thead><tr><th>Đối tượng</th><th class="num">621</th><th class="num">622</th><th class="num">623</th><th class="num">627</th><th class="num">Dở dang đầu kỳ</th></tr></thead><tbody>
          ${d.costObjects.map((o) => { const w = op.wip.find((x) => x.obj === o.code); const e = w ? w.e : {}; return `<tr class="is-click" tabindex="0" data-a="edit-wip" data-obj="${esc(o.code)}"><td><span class="mono strong">${esc(o.code)}</span> ${esc(o.name)}</td>${['621', '622', '623', '627'].map((a) => `<td class="num">${e[a] ? money(e[a]) : '–'}</td>`).join('')}<td class="num strong">${w ? money(Object.values(e).reduce((s, v) => s + v, 0)) : '–'}</td></tr>`; }).join('')}
          </tbody><tfoot><tr><td>Cộng (TK 154)</td><td colspan="4"></td><td class="num">${money(wipTotal)}</td></tr></tfoot></table></div>`
          : `<div class="empty">${icon('factory')}<span class="empty-title">Công ty không theo dõi giá thành</span><span class="empty-text">Không có đối tượng tập hợp chi phí nên không có số dư dở dang.</span></div>`;
      }
      const addBtn = tab === 'acc' ? 'add-row' : tab === 'cp' ? 'add-cp' : tab === 'goods' ? 'add-goods' : null;
      return `<div class="page">
        <div class="page-header"><div class="od-fill"><h1 class="page-title">Số dư đầu kỳ</h1><span class="page-sub">${esc(E.company().name)} · số dư 31/12/2026 chuyển sang kỳ đầu</span></div>
          <div class="page-actions">${dr.dirty ? `<button type="button" class="btn btn-outline" data-a="discard">${icon('undo')}Bỏ thay đổi</button>` : ''}<button type="button" class="btn" data-a="save" data-primary-action ${can && dr.dirty && balanced ? '' : 'disabled'}>${icon('check')}Ghi số dư đầu kỳ</button></div></div>
        <div class="stats" style="--cols:4">
          <div class="stat"><span class="stat-label">Tổng dư Nợ</span><span class="stat-value">${money(chk.dr)}</span><span class="stat-note">Tài sản và chi phí</span></div>
          <div class="stat"><span class="stat-label">Tổng dư Có</span><span class="stat-value">${money(chk.cr)}</span><span class="stat-note">Nguồn vốn</span></div>
          <div class="stat"><span class="stat-label">Chênh lệch</span><span class="stat-value ${balanced ? '' : 'text-danger'}">${E.signed(chk.diff)}</span><span class="stat-note">${balanced ? 'Cân: Nợ = Có' : chk.diff > 0 ? 'Nợ lớn hơn Có, thiếu nguồn vốn hoặc thừa tài sản' : 'Có lớn hơn Nợ, thiếu tài sản hoặc thừa nguồn vốn'}</span></div>
          <div class="stat"><span class="stat-label">Tồn kho đầu kỳ</span><span class="stat-value">${money(op.goods.reduce((s, g) => s + g.val, 0))}</span><span class="stat-note">${op.goods.length} dòng hàng · 154: ${money(wipTotal)}</span></div>
        </div>
        ${balanced ? '' : `<div class="banner is-danger" role="alert" style="border-radius:var(--r-lg);border:1px solid var(--danger-100)">${icon('circle-alert')}<span>Số dư đầu kỳ chưa cân, lệch ${money(Math.abs(chk.diff))} đ. Sửa các dòng bên dưới trước khi ghi; hệ thống không tự bù vào TK vốn.</span></div>`}
        ${dr.dirty ? `<div class="banner" style="border-radius:var(--r-lg);border:1px solid var(--warning-100)">${icon('alert')}<span>Có thay đổi chưa ghi. Sổ sách vẫn dùng số dư đầu kỳ đã ghi trước đó.</span></div>` : ''}
        <div class="card">
          <div class="card-head"><div class="od-fill">${tabsHtml(OP_TABS, tab)}</div>${addBtn ? `<button type="button" class="btn btn-outline" data-a="${addBtn}" ${can ? '' : 'disabled'}>${icon('plus')}Thêm dòng</button>` : ''}</div>
          ${body}
        </div>
        <p class="help">Kỳ 12/2026 đã khóa khi nhập từ Smart Pro. Sửa số dư đầu kỳ cần kỳ hiện tại đang mở, ghi kèm lý do vào nhật ký, và sinh lại bút toán SDDK từ màn này.</p>
      </div>`;
    },
    mount(host, params) {
      const tab = params.tab || 'acc';
      const dr = draftOf(); const op = dr.data;
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a;
        if (a === 'tab') E.refresh({ tab: t.dataset.tab });
        if (a === 'goto') E.refresh({ tab: t.dataset.tab });
        const need = () => { if (!E.canWrite()) { readonlyToast(); return false; } return true; };
        if (a === 'add-row' && need()) opRowDialog(null, false);
        if (a === 'add-cp' && need()) opRowDialog(null, true);
        if (a === 'add-goods' && need()) opGoodsDialog(null);
        if (a === 'edit-row' && need()) opRowDialog(op.rows.find((r) => r.id === t.dataset.id), false);
        if (a === 'edit-cp' && need()) opRowDialog(op.rows.find((r) => r.id === t.dataset.id), true);
        if (a === 'edit-goods' && need()) opGoodsDialog(op.goods[Number(t.dataset.i)]);
        if (a === 'edit-wip' && need()) { const o = E.db().costObjects.find((x) => x.code === t.dataset.obj); opWipDialog(op.wip.find((x) => x.obj === o.code), o); }
        if (a === 'discard') { delete drafts[state.companyId]; E.refresh({ tab }); E.toast('Đã bỏ thay đổi'); }
        if (a === 'save') {
          if (!E.canWrite()) return readonlyToast();
          E.openDialog({
            eyebrow: 'Số dư đầu kỳ', title: 'Ghi số dư đầu kỳ',
            body: `<p class="muted">Bút toán SDDK sẽ được sinh lại từ màn này. Mọi số dư tài khoản, công nợ, tồn kho đầu kỳ đổi theo.</p><div class="field"><label class="label" for="op-why">Lý do sửa<span class="req">*</span></label><textarea id="op-why" class="textarea" placeholder="Ví dụ: đối chiếu lại với bảng cân đối số phát sinh 2026"></textarea><span class="field-error" hidden></span></div>`,
            actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, { label: 'Ghi số dư', run(api) {
              if (!api.validate()) return false;
              const d = E.db();
              d.opening = JSON.parse(JSON.stringify(op));
              E.saveOpening(d);
              d.audit.push({ at: `2027-01-31 ${new Date().toTimeString().slice(0, 5)}`, who: state.user.name, what: `Sửa số dư đầu kỳ. Lý do: ${api.el.querySelector('#op-why').value.trim()}` });
              delete drafts[state.companyId];
              E.refresh({ tab }); E.refreshChrome();
              E.toast('Đã ghi số dư đầu kỳ', { text: 'Bảng cân đối phát sinh đã cập nhật theo số mới.' });
              return true;
            } }],
            onMount(api) { api.validate = bindRules(api.el, { 'op-why': (s) => (s.length >= 10 ? '' : 'Lý do cần ít nhất 10 ký tự.') }); },
            initialFocus: '#op-why',
          });
        }
      });
      host.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-a]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); } });
    },
  };
})(window.EYN);
