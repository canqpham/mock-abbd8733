/* Lương & BHXH: Nhân viên (staff), Chấm công (timesheet), Bảng lương (payroll). Sensitive: needs the payroll right. */
(function (E) {
  const { esc, icon, badge, money, state } = E;

  const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const PAY_ACCS = ['6421', '6422', '622', '627'];
  const TAB_LABEL = { sheet: 'Bảng lương', pay: 'Bảng thanh toán lương', bhxh: 'Tổng hợp BHXH', pit: 'Kê khai TNCN' };
  const ui = { staff: { q: '', dept: 'all', status: 'all' }, payroll: { tab: 'sheet', dept: 'all' } };

  const after = () => { E.refresh(); E.refreshChrome(); };
  const dateOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
  const num = (v) => E.parseMoney(v);

  function lockedPage(title) {
    return `<div class="page"><div class="page-header"><div><h1 class="page-title">${esc(title)}</h1></div></div>
      <section class="card"><div class="empty">${icon('lock')}<span class="empty-title">Bạn chưa có quyền lương</span><span class="empty-text">Chỉ người dùng có quyền lương xem được Nhân viên, Chấm công, Bảng lương. Đổi người dùng ở góc dưới thanh bên.</span></div></section></div>`;
  }
  const printHead = (title) => { const c = E.company(); return `<div class="print-head"><h2>${esc(title)}</h2><p>${esc(c.name)} · MST ${esc(c.mst)} · Kỳ ${E.periodLabel(state.period)}</p></div>`; };
  const fieldErr = (el, msg) => {
    const err = el.closest('.field').querySelector('.field-error');
    err.textContent = msg; err.hidden = !msg;
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };
  const deptsOf = (d) => [...new Set(d.employees.map((e) => e.dept))].sort();
  const suggestAcc = (dept) => {
    if (E.hasModule(E.company(), 'costing')) return { 'Công trường': '622', 'Phòng Kỹ thuật': '627', Kho: '627', 'Kinh doanh': '6421' }[dept] || '6422';
    return dept === 'Kinh doanh' ? '6421' : '6422';
  };
  const emptyStaff = (can) => `<div class="empty">${icon('user')}<span class="empty-title">Công ty chưa có nhân viên</span><span class="empty-text">Thêm nhân viên để chấm công và lập bảng lương. Công ty không có nhân viên thì bước lương trong chốt sổ được bỏ qua.</span><button type="button" class="btn" data-a="add" ${can ? '' : 'disabled'}>${icon('plus')}Thêm nhân viên</button></div>`;

  /* ======================= Nhân viên ======================= */
  function staffDialog(emp) {
    const d = E.db(); const isNew = !emp;
    const e = emp || { code: '', name: '', dept: '', position: '', mst: '', deps: 0, base: 0, bhxh: 0, pc: [0, 0, 0, 0], contract: ['Xác định thời hạn 12 tháng', `${state.period}-01`], ins: true, tkCp: '6422', ct: '', active: true };
    const accOpts = PAY_ACCS.filter((a) => E.acc(a)).map((a) => `<option value="${a}" ${e.tkCp === a ? 'selected' : ''}>${a} · ${esc(E.acc(a).name)}</option>`).join('');
    const ctOpts = `<option value="">Không gắn đối tượng</option>${d.costObjects.map((o) => `<option value="${esc(o.code)}" ${e.ct === o.code ? 'selected' : ''}>${esc(o.code)} · ${esc(o.name)}</option>`).join('')}`;
    const f = (id, label, val, extra = '', cls = 'span-6', req = false) => `<div class="field ${cls}"><label class="label" for="${id}">${label}${req ? '<span class="req">*</span>' : ''}</label><input id="${id}" class="input" value="${esc(val)}" ${extra}><span class="field-error" hidden></span></div>`;
    const rules = {
      'st-code': (v) => (!/^[A-Za-z0-9]+$/.test(v.trim()) ? 'Mã chỉ gồm chữ không dấu và số, không ký tự đặc biệt.' : d.employees.some((x) => x.code === v.trim() && x !== emp) || d.cps.some((c) => c.code === v.trim() && c.kind !== 'employee') ? 'Mã này đã được dùng, chọn mã khác.' : ''),
      'st-name': (v) => (v.trim() ? '' : 'Nhập họ tên.'),
      'st-dept': (v) => (v.trim() ? '' : 'Nhập phòng ban hoặc bộ phận.'),
      'st-mst': (v) => (!v.trim() || /^(\d{10}|\d{13})$/.test(v.trim()) ? '' : 'MST cá nhân gồm 10 chữ số (hoặc 13 chữ số có chi nhánh).'),
      'st-deps': (v) => (/^\d+$/.test(v.trim()) ? '' : 'Số người phụ thuộc là số nguyên từ 0 trở lên.'),
      'st-base': (v) => (num(v) > 0 ? '' : 'Lương cơ bản phải lớn hơn 0.'),
      'st-bhxh': (v, g) => (num(v) < 0 ? 'Không âm.' : num(v) > num(g('st-base')) ? 'Lương đóng BHXH không vượt lương cơ bản.' : ''),
      'st-pc0': (v) => (num(v) >= 0 ? '' : 'Phụ cấp không âm.'), 'st-pc1': (v) => (num(v) >= 0 ? '' : 'Phụ cấp không âm.'), 'st-pc2': (v) => (num(v) >= 0 ? '' : 'Phụ cấp không âm.'), 'st-pc3': (v) => (num(v) >= 0 ? '' : 'Phụ cấp không âm.'),
      'st-cdate': (v) => (dateOk(v) ? '' : 'Chọn ngày ký hợp đồng.'),
    };
    E.openDialog({
      eyebrow: isNew ? 'Nhân viên mới' : e.code, title: isNew ? 'Thêm nhân viên' : `Sửa ${e.name}`, size: 'lg',
      body: `<div class="form-grid">
        ${f('st-code', 'Mã nhân viên', e.code, isNew ? '' : 'readonly', 'span-4', true)}${f('st-name', 'Họ tên', e.name, '', 'span-8', true)}
        <div class="field span-6"><label class="label" for="st-dept">Phòng ban, bộ phận<span class="req">*</span></label><input id="st-dept" class="input" list="st-depts" value="${esc(e.dept)}"><datalist id="st-depts">${deptsOf(d).map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist><span class="field-error" hidden></span></div>
        ${f('st-pos', 'Chức vụ', e.position)}${f('st-mst', 'MST cá nhân', e.mst, 'inputmode="numeric"')}${f('st-deps', 'Số người phụ thuộc', String(e.deps), 'inputmode="numeric"')}
        ${f('st-base', 'Lương cơ bản (đ)', e.base ? money(e.base) : '', 'inputmode="numeric"', 'span-6', true)}${f('st-bhxh', 'Lương đóng BHXH (đ)', e.bhxh ? money(e.bhxh) : '', 'inputmode="numeric"')}
        ${f('st-pc0', 'Phụ cấp chức vụ', money(e.pc[0]), 'inputmode="numeric"', 'span-3')}${f('st-pc1', 'Phụ cấp trách nhiệm', money(e.pc[1]), 'inputmode="numeric"', 'span-3')}${f('st-pc2', 'Phụ cấp ăn', money(e.pc[2]), 'inputmode="numeric"', 'span-3')}${f('st-pc3', 'Phụ cấp thâm niên', money(e.pc[3]), 'inputmode="numeric"', 'span-3')}
        <div class="field span-6"><label class="label" for="st-ctype">Loại hợp đồng</label><select id="st-ctype" class="select">${['Thử việc', 'Xác định thời hạn 12 tháng', 'Xác định thời hạn 24 tháng', 'Xác định thời hạn 36 tháng', 'Không xác định thời hạn'].map((t) => `<option ${e.contract[0] === t ? 'selected' : ''}>${t}</option>`).join('')}${['Thử việc', 'Xác định thời hạn 12 tháng', 'Xác định thời hạn 24 tháng', 'Xác định thời hạn 36 tháng', 'Không xác định thời hạn'].includes(e.contract[0]) ? '' : `<option selected>${esc(e.contract[0])}</option>`}</select></div>
        <div class="field span-6"><label class="label" for="st-cdate">Ngày hợp đồng<span class="req">*</span></label><input id="st-cdate" type="date" class="input mono" value="${esc(e.contract[1])}"><span class="field-error" hidden></span></div>
        <div class="field span-6"><label class="label" for="st-acc">TK chi phí lương mặc định</label><select id="st-acc" class="select">${accOpts}</select><span class="help">Gợi ý theo bộ phận, đổi được.</span></div>
        <div class="field span-6"><label class="label" for="st-ct">Công trình, đối tượng (cho TK 622)</label><select id="st-ct" class="select">${ctOpts}</select></div>
        <div class="field span-6"><label class="od-row" style="--od-gap:8px"><input type="checkbox" id="st-ins" class="check" ${e.ins ? 'checked' : ''}><span>Có đóng BHXH</span></label><span class="help" id="st-prev"></span></div>
        <div class="field span-6"><label class="od-row" style="--od-gap:8px"><input type="checkbox" id="st-active" class="check" ${e.active ? 'checked' : ''}><span>Đang làm việc</span></label><span class="help">Bỏ chọn khi nghỉ việc: nhân viên không còn trong bảng lương mới.</span></div>
      </div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: isNew ? 'Thêm nhân viên' : 'Lưu', run(api) {
          const g = (id) => api.el.querySelector(`#${id}`).value;
          const els = Object.keys(rules).map((id) => api.el.querySelector(`#${id}`));
          const ok = els.map((el) => fieldErr(el, rules[el.id](el.value, g))).every(Boolean);
          if (!ok) { els.find((el) => el.getAttribute('aria-invalid') === 'true').focus(); return false; }
          const accV = g('st-acc');
          const next = {
            code: g('st-code').trim(), name: g('st-name').trim(), dept: g('st-dept').trim(), position: g('st-pos').trim(), mst: g('st-mst').trim(), deps: Number(g('st-deps')),
            base: num(g('st-base')), bhxh: num(g('st-bhxh')), pc: [num(g('st-pc0')), num(g('st-pc1')), num(g('st-pc2')), num(g('st-pc3'))],
            contract: [g('st-ctype'), g('st-cdate')], ins: api.el.querySelector('#st-ins').checked, tkCp: accV, ct: accV === '622' ? g('st-ct') : '', active: api.el.querySelector('#st-active').checked,
          };
          const commit = () => {
            if (isNew) d.employees.push(next); else d.employees.splice(d.employees.indexOf(emp), 1, next);
            const cp = d.cps.find((c) => c.code === next.code);
            if (cp) { cp.name = next.name; cp.address = next.dept; cp.active = true; } else d.cps.push({ code: next.code, name: next.name, kind: 'employee', mst: '', address: next.dept, active: true });
            E.toast(isNew ? `Đã thêm ${next.name}` : `Đã lưu ${next.name}`, { text: 'Bảng lương tạo sau sẽ dùng thông tin này.' });
            after();
          };
          if (!isNew && emp.active && !next.active) {
            api.close();
            setTimeout(() => E.confirmDialog({ eyebrow: emp.code, title: `Cho ${emp.name} nghỉ việc?`, text: 'Nhân viên không còn trong bảng lương và chấm công từ lần tạo tiếp theo. Lịch sử lương đã ghi sổ không đổi.', confirmLabel: 'Cho nghỉ việc', danger: true, onConfirm: commit }), 0);
            return false;
          }
          commit();
          return undefined;
        },
      }],
      onMount(api) {
        const g = (id) => api.el.querySelector(`#${id}`).value;
        Object.keys(rules).forEach((id) => {
          const el = api.el.querySelector(`#${id}`);
          el.addEventListener('blur', () => { if (el.value || el.getAttribute('aria-invalid')) fieldErr(el, rules[id](el.value, g)); });
          el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') fieldErr(el, rules[id](el.value, g)); });
        });
        ['st-base', 'st-bhxh', 'st-pc0', 'st-pc1', 'st-pc2', 'st-pc3'].forEach((id) => { const el = api.el.querySelector(`#${id}`); el.addEventListener('blur', () => { const n = num(el.value); if (el.value.trim()) el.value = money(n); }); });
        const prev = () => {
          const ins = api.el.querySelector('#st-ins').checked; const par = d.params;
          api.el.querySelector('#st-prev').textContent = ins ? `Lương đóng BHXH tính: ${money(Math.min(num(g('st-bhxh')), par.tranBhxh))} đ (trần ${money(par.tranBhxh)} đ), BHTN trần ${money(par.tranBhtn)} đ.` : 'Không đóng BHXH, BHYT, BHTN, KPCĐ.';
        };
        ['st-bhxh', 'st-ins'].forEach((id) => api.el.querySelector(`#${id}`).addEventListener('input', prev));
        api.el.querySelector('#st-ins').addEventListener('change', prev);
        prev();
        const deptEl = api.el.querySelector('#st-dept'); const accEl = api.el.querySelector('#st-acc');
        deptEl.addEventListener('change', () => { if (isNew || !emp) accEl.value = suggestAcc(deptEl.value.trim()); });
      },
      initialFocus: isNew ? '#st-code' : '#st-name',
    });
  }

  E.views.staff = {
    render() {
      if (!E.canPayroll()) return lockedPage('Nhân viên');
      const d = E.db(); const can = E.canWrite(); const s = ui.staff;
      const depts = deptsOf(d);
      const list = d.employees.filter((e) => (s.dept === 'all' || e.dept === s.dept) && (s.status === 'all' || (s.status === 'active') === e.active) && (!s.q || E.matches(`${e.code} ${e.name} ${e.position} ${e.mst}`, s.q)));
      const act = d.employees.filter((e) => e.active).length;
      const rows = list.map((e) => `<tr class="is-click" tabindex="0" data-a="edit" data-code="${esc(e.code)}" data-text="${esc(`${e.code} ${e.name} ${e.position} ${e.mst}`)}">
        <td class="mono">${esc(e.code)}</td><td style="min-width:160px"><span class="strong">${esc(e.name)}</span></td><td>${esc(e.dept)}</td><td>${esc(e.position)}</td><td class="mono">${esc(e.mst) || '–'}</td>
        <td class="num">${e.deps}</td><td class="num">${money(e.base)}</td><td class="num">${money(e.bhxh)}</td><td class="num">${money(e.pc.reduce((a, b) => a + b, 0))}</td>
        <td>${esc(e.contract[0])}<span class="muted pay-sub">${E.periodLabel(e.contract[1].slice(0, 7))}</span></td><td><span class="acc-chip">${esc(e.tkCp)}</span></td>
        <td>${e.ins ? badge('success', 'Có BHXH') : badge('', 'Không BHXH')}</td><td>${e.active ? badge('success', 'Đang làm') : badge('neutral', 'Nghỉ việc')}</td></tr>`).join('');
      return `<div class="page">
        <div class="page-header"><div class="od-fill" style="min-width:240px"><h1 class="page-title">Nhân viên</h1><span class="page-sub">${esc(E.company().name)} · ${act} đang làm việc / ${d.employees.length} hồ sơ</span></div>
          <div class="page-actions"><button type="button" class="btn" data-a="add" data-primary-action ${can ? '' : 'disabled'}>${icon('plus')}Thêm nhân viên</button></div></div>
        ${d.employees.length ? `<section class="card">
          <div class="card-head pay-filters">
            <div class="search-input od-fill" style="min-width:200px;max-width:320px">${icon('search')}<input class="input" type="search" data-search data-a-input="q" value="${esc(s.q)}" placeholder="Tìm mã, tên, MST… (F7)" aria-label="Tìm nhân viên"></div>
            <div class="field"><label class="sr-only" for="st-fd">Phòng ban</label><select id="st-fd" class="select" data-a-change="dept"><option value="all">Mọi phòng ban</option>${depts.map((x) => `<option ${s.dept === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
            <div class="seg" role="group" aria-label="Trạng thái">${[['all', 'Tất cả'], ['active', 'Đang làm'], ['off', 'Nghỉ việc']].map(([k, l]) => `<button type="button" data-a="status" data-k="${k}" aria-pressed="${s.status === k}">${l}</button>`).join('')}</div>
          </div>
          ${list.length ? `<div class="table-wrap"><table class="tbl pay-tbl-flat"><thead><tr><th>Mã</th><th>Họ tên</th><th>Bộ phận</th><th>Chức vụ</th><th>MST</th><th class="num">Phụ thuộc</th><th class="num">Lương cơ bản</th><th class="num">Lương đóng BH</th><th class="num">Phụ cấp</th><th>Hợp đồng</th><th>TK chi phí</th><th>BHXH</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div>`
            : `<div class="empty">${icon('search')}<span class="empty-title">Không có nhân viên khớp bộ lọc</span><span class="empty-text">Bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.</span></div>`}
        </section>` : `<section class="card">${emptyStaff(can)}</section>`}
      </div>`;
    },
    mount(host) {
      if (!E.canPayroll()) return;
      const d = E.db();
      const open = (t) => { const e = d.employees.find((x) => x.code === t.dataset.code); if (e && E.canWrite()) staffDialog(e); else if (e) E.toast('Kỳ đã khóa hoặc công ty chỉ đọc', { text: 'Không sửa được hồ sơ nhân viên.', icon: 'lock' }); };
      host.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-a]');
        if (!t || t.disabled) return;
        if (t.dataset.a === 'add') staffDialog(null);
        if (t.dataset.a === 'edit') open(t);
        if (t.dataset.a === 'status') { ui.staff.status = t.dataset.k; E.refresh(); }
      });
      host.addEventListener('keydown', (ev) => { const row = ev.target.closest('tr[data-a="edit"]'); if (row && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); open(row); } });
      host.addEventListener('change', (ev) => { if (ev.target.dataset.aChange === 'dept') { ui.staff.dept = ev.target.value; E.refresh(); } });
      const q = host.querySelector('[data-a-input="q"]');
      if (q) q.addEventListener('input', () => {
        ui.staff.q = q.value;
        host.querySelectorAll('tbody tr[data-text]').forEach((tr) => { tr.hidden = !!q.value && !E.matches(tr.dataset.text, q.value); });
      });
    },
  };

  /* ======================= Chấm công ======================= */
  const writeCell = (d, period, code, i, v) => {
    const all = d.timesheets[period] = d.timesheets[period] || {};
    const sh = (all[code] || E.sheetFor(period, code, d)).slice();
    sh[i] = v; all[code] = sh;
  };

  E.views.timesheet = {
    render() {
      if (!E.canPayroll()) return lockedPage('Chấm công');
      const d = E.db(); const period = state.period;
      const can = E.canWrite(); const days = E.daysIn(period);
      const emps = d.employees.filter((e) => e.active);
      const ps = E.payrollState(d, period);
      const stats = emps.map((e) => E.sheetStats(E.sheetFor(period, e.code, d)));
      const sum = (k) => stats.reduce((s, x) => s + x[k], 0);
      const dayHead = Array.from({ length: days }, (_, i) => {
        const day = i + 1; const iso = `${period}-${String(day).padStart(2, '0')}`; const dow = E.dayOfWeek(period, day); const hol = E.isHoliday(iso, d);
        return `<th class="pay-day${dow === 0 ? ' pay-we' : ''}${hol ? ' pay-hol' : ''}" title="${esc(hol ? hol[1] : dow === 0 ? 'Chủ nhật' : DOW[dow])}"><span class="pay-dn">${day}</span><span class="pay-dw">${hol ? 'L' : DOW[dow]}</span></th>`;
      }).join('');
      const body = emps.map((e) => {
        const sh = E.sheetFor(period, e.code, d); const st = E.sheetStats(sh);
        const cells = sh.map((v, i) => {
          const day = i + 1; const iso = `${period}-${String(day).padStart(2, '0')}`; const dow = E.dayOfWeek(period, day); const hol = E.isHoliday(iso, d);
          return `<td class="pay-c${dow === 0 ? ' pay-we' : ''}${hol ? ' pay-hol' : ''}"><input class="pay-in mono" data-r="${esc(e.code)}" data-i="${i}" value="${esc(v)}" maxlength="6" autocomplete="off" aria-label="${esc(`${e.name} ngày ${day}`)}" ${can ? '' : 'readonly tabindex="-1"'}></td>`;
        }).join('');
        return `<tr data-row="${esc(e.code)}"><th class="pay-who" scope="row"><span class="strong od-truncate">${esc(e.name)}</span><span class="muted mono">${esc(e.code)}</span></th>${cells}
          <td class="num" data-tot="${esc(e.code)}:paid">${String(st.paid).replace('.', ',')}</td><td class="num" data-tot="${esc(e.code)}:p">${st.p}</td><td class="num" data-tot="${esc(e.code)}:off">${st.off}</td><td class="num" data-tot="${esc(e.code)}:ot">${st.ot}</td></tr>`;
      }).join('');
      const hols = [...d.holidays].sort((a, b) => a[0].localeCompare(b[0]));
      return `<div class="page">
        <div class="page-header"><div class="od-fill" style="min-width:240px"><h1 class="page-title">Chấm công tháng ${E.periodLabel(period)}</h1><span class="page-sub">${esc(E.company().name)} · gõ mã công vào ô, mũi tên để di chuyển</span></div></div>
        ${ps.accrueAny ? `<div class="banner" role="status">${icon('alert')}<span>Bảng lương kỳ này đã ${ps.accruePending ? 'có đề xuất ghi sổ chờ duyệt' : 'ghi sổ'}. Sửa công ở đây không đổi số đã ghi. Muốn tính lại phải từ chối đề xuất lương trước.</span></div>` : ''}
        <div class="stats" style="--cols:4">
          <div class="stat"><span class="stat-label">Nhân viên chấm công</span><span class="stat-value">${emps.length}</span><span class="stat-note">${days} ngày trong kỳ</span></div>
          <div class="stat"><span class="stat-label">Tổng công hưởng lương</span><span class="stat-value">${String(sum('paid')).replace('.', ',')}</span><span class="stat-note">X + nửa ngày + phép + lễ</span></div>
          <div class="stat"><span class="stat-label">Ngày phép</span><span class="stat-value">${sum('p')}</span><span class="stat-note">Mã P</span></div>
          <div class="stat"><span class="stat-label">Giờ làm thêm (OT)</span><span class="stat-value">${sum('ot')}</span><span class="stat-note">Ốm, không lương: ${sum('off')} ngày</span></div>
        </div>
        <div class="pay-ts-grid">
          <section class="card">
            <div class="card-head"><div class="od-fill"><span class="card-title">Bảng chấm công</span><span class="card-sub">X đi làm · N nửa ngày · P phép · L lễ · O ốm · K không lương · thêm +giờ để ghi OT, ví dụ X+2</span></div></div>
            ${emps.length ? `<div class="table-wrap pay-ts-wrap"><table class="tbl pay-ts" aria-label="Bảng chấm công"><thead><tr><th class="pay-who">Nhân viên</th>${dayHead}<th class="num">Công</th><th class="num">Phép</th><th class="num">Ốm, K</th><th class="num">OT giờ</th></tr></thead><tbody>${body}</tbody></table></div>
              <p class="help pay-hint" id="pay-hint" aria-live="polite">Ô trống là ngày nghỉ. Mã không hợp lệ sẽ báo ngay tại ô.</p>`
              : emptyStaff(can)}
          </section>
          <section class="card">
            <div class="card-head"><div class="od-fill"><span class="card-title">Ngày lễ ${esc(d.params.year)}</span><span class="card-sub">Ngày lễ tự điền mã L khi tạo bảng chấm công mặc định.</span></div></div>
            <div class="card-body od-stack" style="--od-gap:10px">
              ${hols.map(([iso, name]) => `<div class="od-row"><span class="mono">${E.dmy(iso)}</span><span class="od-fill">${esc(name)}</span><button type="button" class="btn btn-ghost btn-icon" data-a="del-hol" data-iso="${esc(iso)}" aria-label="${esc(`Xóa ngày lễ ${E.dmy(iso)}`)}" ${can ? '' : 'disabled'}>${icon('trash')}</button></div>`).join('') || '<span class="muted">Chưa có ngày lễ.</span>'}
              <hr class="divider">
              <div class="field"><label class="label" for="hol-date">Ngày</label><input id="hol-date" type="date" class="input mono"><span class="field-error" hidden></span></div>
              <div class="field"><label class="label" for="hol-name">Tên ngày lễ</label><input id="hol-name" class="input"><span class="field-error" hidden></span></div>
              <button type="button" class="btn btn-outline" data-a="add-hol" ${can ? '' : 'disabled'}>${icon('plus')}Thêm ngày lễ</button>
            </div>
          </section>
        </div>
      </div>`;
    },
    mount(host) {
      if (!E.canPayroll()) return;
      const d = E.db(); const period = state.period;
      const hint = (t, err) => { const el = host.querySelector('#pay-hint'); if (el) { el.textContent = t; el.classList.toggle('text-danger', !!err); } };
      const inputAt = (code, i) => host.querySelector(`input.pay-in[data-r="${code}"][data-i="${i}"]`);
      const refreshTotals = (code) => {
        const st = E.sheetStats(E.sheetFor(period, code, d));
        const set = (k, v) => { const el = host.querySelector(`[data-tot="${code}:${k}"]`); if (el) el.textContent = v; };
        set('paid', String(st.paid).replace('.', ',')); set('p', st.p); set('off', st.off); set('ot', st.ot);
      };
      host.addEventListener('focusin', (ev) => { const el = ev.target.closest && ev.target.closest('input.pay-in'); if (el) el.select(); });
      host.addEventListener('change', (ev) => {
        const el = ev.target.closest && ev.target.closest('input.pay-in');
        if (!el || el.readOnly) return;
        const v = el.value.trim().toUpperCase();
        if (v && !/^[XNPLOK](\+\d+(\.\d+)?)?$/.test(v)) {
          el.setAttribute('aria-invalid', 'true'); hint('Mã công chưa đúng. Dùng X, N, P, L, O, K, có thể thêm +giờ OT (ví dụ X+2).', true); return;
        }
        el.removeAttribute('aria-invalid'); el.value = v;
        writeCell(d, period, el.dataset.r, Number(el.dataset.i), v);
        refreshTotals(el.dataset.r);
        hint('Đã lưu chấm công.');
      });
      host.addEventListener('keydown', (ev) => {
        const el = ev.target.closest && ev.target.closest('input.pay-in');
        if (!el) return;
        const code = el.dataset.r; const i = Number(el.dataset.i);
        const rows = [...host.querySelectorAll('tr[data-row]')].map((r) => r.dataset.row);
        const ri = rows.indexOf(code);
        const go = (c, k) => { const n = inputAt(c, k); if (n) { ev.preventDefault(); el.dispatchEvent(new Event('change', { bubbles: true })); n.focus(); } };
        if (ev.key === 'ArrowLeft') go(code, i - 1);
        else if (ev.key === 'ArrowRight') go(code, i + 1);
        else if (ev.key === 'ArrowUp' && ri > 0) go(rows[ri - 1], i);
        else if ((ev.key === 'ArrowDown' || ev.key === 'Enter') && ri < rows.length - 1) go(rows[ri + 1], i);
        else if (ev.key === 'Delete' || ev.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === el.value.length) { if (!el.readOnly) { ev.preventDefault(); el.value = ''; el.dispatchEvent(new Event('change', { bubbles: true })); } }
      });
      host.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-a]');
        if (!t || t.disabled) return;
        if (t.dataset.a === 'del-hol') {
          const iso = t.dataset.iso; const h = d.holidays.find((x) => x[0] === iso);
          E.confirmDialog({ title: `Xóa ngày lễ ${E.dmy(iso)}?`, text: `${h ? h[1] : ''}. Bảng chấm công đã nhập không đổi, chỉ bảng mặc định tạo sau không tự điền L.`, confirmLabel: 'Xóa', danger: true, onConfirm() { d.holidays = d.holidays.filter((x) => x[0] !== iso); after(); } });
        }
        if (t.dataset.a === 'add-hol') {
          const dt = host.querySelector('#hol-date'); const nm = host.querySelector('#hol-name');
          const e1 = fieldErr(dt, !dateOk(dt.value) ? 'Chọn ngày lễ.' : d.holidays.some((x) => x[0] === dt.value) ? 'Ngày này đã có trong danh sách.' : '');
          const e2 = fieldErr(nm, nm.value.trim() ? '' : 'Nhập tên ngày lễ.');
          if (!e1 || !e2) { (e1 ? nm : dt).focus(); return; }
          d.holidays = [...d.holidays, [dt.value, nm.value.trim()]];
          E.toast('Đã thêm ngày lễ', { text: `${E.dmy(dt.value)} · ${nm.value.trim()}` });
          after();
        }
      });
    },
  };

  /* ======================= Bảng lương ======================= */
  const COLS = [
    ['workDays', 'Công thực tế', null, false], ['salaryByDay', 'Lương theo công', 'salaryByDay'], ['allowByDay', 'Phụ cấp', 'allowByDay'], ['ot', 'OT', 'ot'], ['gross', 'Tổng thu nhập', 'gross'],
    ['empBhxh', 'BHXH (NLĐ)', 'empBhxh'], ['empBhyt', 'BHYT (NLĐ)', 'empBhyt'], ['empBhtn', 'BHTN (NLĐ)', 'empBhtn'],
    ['coBhxh', 'BHXH (công ty)', 'coBhxh'], ['coBhyt', 'BHYT (công ty)', 'coBhyt'], ['coBhtn', 'BHTN (công ty)', 'coBhtn'], ['kpcd', 'KPCĐ', 'kpcd'],
    ['deduct', 'Giảm trừ', 'deduct'], ['taxable', 'Thu nhập tính thuế', 'taxable'], ['pit', 'Thuế TNCN', 'pit'], ['advance', 'Trừ ứng', null], ['net', 'Thực lĩnh', 'net'],
  ];
  const colVal = (r, k) => (k === 'deduct' ? r.selfDeduct + r.depDeduct : r[k]);
  const fmtCell = (r, k) => (k === 'workDays' ? String(r.workDays).replace('.', ',') : money(colVal(r, k)));

  const payStatus = (ps) => (!ps.payroll ? badge('neutral', 'Chưa tạo bảng lương') : !ps.accrueAny ? badge('warning', 'Đã tạo, chưa ghi sổ') : ps.accruePending ? badge('info', 'Chờ duyệt ghi sổ') : ps.paid ? badge('success', 'Đã ghi sổ, đã chi lương') : ps.payoutPending ? badge('info', 'Chờ duyệt chi lương') : badge('success', 'Đã ghi sổ, chưa chi lương'));

  function reportTable(tab, rows, par) {
    const t = E.payTotals(rows);
    const sttn = (i) => `<td class="num">${i + 1}</td>`;
    if (tab === 'pay') {
      return `<table class="tbl" id="pay-table"><thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th class="num">Tổng thu nhập</th><th class="num">BH người lao động</th><th class="num">Thuế TNCN</th><th class="num">Trừ ứng</th><th class="num">Thực lĩnh</th><th>Ký nhận</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>${sttn(i)}<td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="num">${money(r.gross)}</td><td class="num">${money(r.empIns)}</td><td class="num">${money(r.pit)}</td><td class="num">${money(r.advance)}</td><td class="num">${money(r.net)}</td><td></td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Cộng</td><td class="num">${money(t.gross)}</td><td class="num">${money(t.empIns)}</td><td class="num">${money(t.pit)}</td><td class="num">${money(t.advance)}</td><td class="num">${money(t.net)}</td><td></td></tr></tfoot></table>`;
    }
    if (tab === 'bhxh') {
      const bhtn = E.rm().bhtn;
      const acc = [['3383', 'BHXH', t.empBhxh + t.coBhxh], ['3384', 'BHYT', t.empBhyt + t.coBhyt], [bhtn, 'BHTN', t.empBhtn + t.coBhtn], ['3382', 'KPCĐ', t.kpcd]];
      return `<table class="tbl" id="pay-table"><thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th class="num">Lương đóng BH</th><th class="num">BHXH NLĐ</th><th class="num">BHYT NLĐ</th><th class="num">BHTN NLĐ</th><th class="num">BHXH công ty</th><th class="num">BHYT công ty</th><th class="num">BHTN công ty</th><th class="num">KPCĐ</th><th class="num">Tổng nộp</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>${sttn(i)}<td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="num">${money(r.bhBase)}</td><td class="num">${money(r.empBhxh)}</td><td class="num">${money(r.empBhyt)}</td><td class="num">${money(r.empBhtn)}</td><td class="num">${money(r.coBhxh)}</td><td class="num">${money(r.coBhyt)}</td><td class="num">${money(r.coBhtn)}</td><td class="num">${money(r.kpcd)}</td><td class="num">${money(r.empIns + r.coIns + r.kpcd)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Cộng</td><td class="num">${money(t.bhBase)}</td><td class="num">${money(t.empBhxh)}</td><td class="num">${money(t.empBhyt)}</td><td class="num">${money(t.empBhtn)}</td><td class="num">${money(t.coBhxh)}</td><td class="num">${money(t.coBhyt)}</td><td class="num">${money(t.coBhtn)}</td><td class="num">${money(t.kpcd)}</td><td class="num">${money(t.empIns + t.coIns + t.kpcd)}</td></tr></tfoot></table>
        <div class="card-body"><span class="label">Số phải nộp theo tài khoản</span><div class="table-wrap"><table class="tbl" id="pay-table2"><thead><tr><th>Tài khoản</th><th>Khoản</th><th class="num">Người lao động</th><th class="num">Công ty</th><th class="num">Tổng</th></tr></thead><tbody>
          ${acc.map(([a, n, v], i) => `<tr><td><span class="acc-chip">${esc(a)}</span></td><td>${n}</td><td class="num">${money([t.empBhxh, t.empBhyt, t.empBhtn, 0][i])}</td><td class="num">${money([t.coBhxh, t.coBhyt, t.coBhtn, t.kpcd][i])}</td><td class="num">${money(v)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    return `<table class="tbl" id="pay-table"><thead><tr><th>STT</th><th>Mã</th><th>Họ tên</th><th>MST</th><th class="num">Thu nhập chịu thuế</th><th class="num">BH người lao động</th><th class="num">Giảm trừ gia cảnh</th><th class="num">Thu nhập tính thuế</th><th class="num">Thuế TNCN</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr>${sttn(i)}<td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="mono">${esc((E.db().employees.find((e) => e.code === r.code) || {}).mst) || '–'}</td><td class="num">${money(r.gross)}</td><td class="num">${money(r.empIns)}</td><td class="num">${money(r.selfDeduct + r.depDeduct)}</td><td class="num">${money(r.taxable)}</td><td class="num">${money(r.pit)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Cộng</td><td class="num">${money(t.gross)}</td><td class="num">${money(t.empIns)}</td><td class="num">${money(t.selfDeduct + t.depDeduct)}</td><td class="num">${money(t.taxable)}</td><td class="num">${money(t.pit)}</td></tr></tfoot></table>
      <p class="help pay-hint">Giảm trừ bản thân ${money(par.giamTruBanThan)} đ, mỗi người phụ thuộc ${money(par.giamTruPhuThuoc)} đ.</p>`;
  }

  function formulaDialog(r, key, par) {
    const col = COLS.find((c) => c[0] === key);
    const d = E.db();
    const f = E.payFormulas(r, par);
    let text = f[col[2] || key];
    if (key === 'workDays') { const st = E.sheetStats(E.sheetFor(state.period, r.code, d)); text = `Công hưởng lương = X ${st.x} + N ${st.n} × 0,5 + phép ${st.p} + lễ ${st.l} = ${String(st.paid).replace('.', ',')} ngày (ốm ${st.o}, không lương ${st.k} không tính).`; }
    if (key === 'advance') { const a = d.advances.filter((x) => x.emp === r.code && x.date.slice(0, 7) === state.period); text = a.length ? `Tổng ứng trong kỳ: ${a.map((x) => `${E.dmy(x.date)} ${money(x.amt)}`).join(' + ')} = ${money(r.advance)}` : 'Không có khoản ứng lương trong kỳ.'; }
    E.openDialog({
      eyebrow: `${r.code} · ${r.name}`, title: col[1],
      body: `<p class="pay-formula mono">${esc(text)}</p><dl class="dl"><dt>Ngày công chuẩn</dt><dd class="mono">${par.ngayCongChuan}</dd><dt>Năm áp dụng</dt><dd class="mono">${par.year}</dd><dt>Trần BHXH</dt><dd class="mono">${money(par.tranBhxh)} đ</dd><dt>Trần BHTN</dt><dd class="mono">${money(par.tranBhtn)} đ</dd></dl>`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }],
    });
  }

  function advanceDialog() {
    const d = E.db(); const period = state.period; const can = E.canWrite();
    const emps = d.employees.filter((e) => e.active);
    const list = d.advances.filter((a) => a.date.slice(0, 7) === period);
    const rules = {
      'ad-amt': (v) => { const e = emps.find((x) => x.code === document.getElementById('ad-emp').value); return !(num(v) > 0) ? 'Số tiền ứng phải lớn hơn 0.' : e && num(v) > e.base ? `Không vượt lương cơ bản ${money(e.base)} đ.` : ''; },
      'ad-date': (v) => (!dateOk(v) || v.slice(0, 7) !== period ? `Chọn ngày trong kỳ ${E.periodLabel(period)}.` : ''),
    };
    E.openDialog({
      eyebrow: `Kỳ ${E.periodLabel(period)}`, title: 'Ứng lương', size: 'lg',
      body: `${can ? `<div class="form-grid">
          <div class="field span-4"><label class="label" for="ad-emp">Nhân viên</label><select id="ad-emp" class="select">${emps.map((e) => `<option value="${esc(e.code)}">${esc(e.code)} · ${esc(e.name)}</option>`).join('')}</select></div>
          <div class="field span-4"><label class="label" for="ad-date">Ngày ứng<span class="req">*</span></label><input id="ad-date" type="date" class="input mono" value="${period}-15"><span class="field-error" hidden></span></div>
          <div class="field span-4"><label class="label" for="ad-amt">Số tiền (đ)<span class="req">*</span></label><input id="ad-amt" class="input mono" inputmode="numeric"><span class="field-error" hidden></span></div>
        </div><p class="help">Ghi Nợ 334 / Có 11211 ngay (ủy nhiệm chi). Bảng lương đã tạo trước đó cần tạo lại để cập nhật mục trừ ứng.</p>` : '<p class="muted">Kỳ đã khóa hoặc công ty chỉ đọc nên không thêm được ứng lương.</p>'}
        <span class="label">Đã ứng trong kỳ</span>
        ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Chứng từ</th><th class="num">Số tiền</th></tr></thead><tbody>${list.map((a) => `<tr><td class="mono">${E.dmy(a.date)}</td><td>${esc(E.cpName(a.emp))}</td><td class="mono">${esc(a.entryNo)}</td><td class="num">${money(a.amt)}</td></tr>`).join('')}</tbody></table></div>` : '<span class="muted">Chưa có khoản ứng nào.</span>'}`,
      actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }, ...(can ? [{
        label: 'Ghi ứng lương', run(api) {
          const els = Object.keys(rules).map((id) => api.el.querySelector(`#${id}`));
          const ok = els.map((el) => fieldErr(el, rules[el.id](el.value))).every(Boolean);
          if (!ok) { els.find((el) => el.getAttribute('aria-invalid') === 'true').focus(); return false; }
          const emp = api.el.querySelector('#ad-emp').value; const date = api.el.querySelector('#ad-date').value; const amt = num(api.el.querySelector('#ad-amt').value);
          const errs = E.validateLines([E.L('334', '11211', amt, emp, 'Ứng lương')], { period, date });
          if (errs.length) { fieldErr(els[0], errs[0].msg); return false; }
          const entry = E.addAdvance(d, { emp, date, amt });
          E.toast('Đã ghi ứng lương', { text: `${E.cpName(emp)} · ${money(amt)} đ · ${entry.no}` });
          after();
          return undefined;
        },
      }] : [])],
      onMount(api) { Object.keys(rules).forEach((id) => { const el = api.el.querySelector(`#${id}`); if (!el) return; el.addEventListener('blur', () => { if (el.value || el.getAttribute('aria-invalid')) fieldErr(el, rules[id](el.value)); }); }); },
      initialFocus: can ? '#ad-amt' : undefined,
    });
  }

  function payoutDialog(pr) {
    const d = E.db(); const total = pr.rows.reduce((s, r) => s + Math.max(0, r.net), 0);
    const cash = E.net('1111');
    E.openDialog({
      eyebrow: `Kỳ ${E.periodLabel(state.period)}`, title: 'Chi lương',
      body: `<p class="muted">Tổng thực lĩnh ${money(total)} đ cho ${pr.rows.filter((r) => r.net > 0).length} nhân viên. Tạo đề xuất Nợ 334 / Có 111 hoặc 112, theo dõi theo từng nhân viên.</p>
        <div class="od-stack" role="radiogroup" aria-label="Hình thức chi">
          <label class="od-row" style="--od-gap:8px"><input type="radio" name="pm" value="bank" class="check" checked><span>Chuyển khoản (TK 11211)</span></label>
          <label class="od-row" style="--od-gap:8px"><input type="radio" name="pm" value="cash" class="check"><span>Tiền mặt (TK 1111, quỹ hiện có ${money(cash)} đ)</span></label>
        </div><span class="field-error" id="pm-warn" hidden>Quỹ tiền mặt không đủ chi, số dư sẽ âm và chặn chốt sổ.</span>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Tạo đề xuất chi lương', run(api) {
          const method = api.el.querySelector('input[name="pm"]:checked').value;
          if (method === 'cash' && cash < total && api.el.querySelector('#pm-warn').hidden) { api.el.querySelector('#pm-warn').hidden = false; return false; }
          E.payrollPayout(d, state.period, method);
          E.toast('Đã tạo đề xuất chi lương', { text: 'Duyệt ở màn Duyệt đề xuất để ghi sổ.', action: { label: 'Mở Duyệt', run: () => E.go('review', { source: 'job' }) } });
          after();
          return undefined;
        },
      }],
      onMount(api) { api.el.querySelectorAll('input[name="pm"]').forEach((r) => r.addEventListener('change', () => { api.el.querySelector('#pm-warn').hidden = true; })); },
    });
  }

  E.views.payroll = {
    render() {
      if (!E.canPayroll()) return lockedPage('Bảng lương');
      const d = E.db(); const period = state.period; const can = E.canWrite();
      const ps = E.payrollState(d, period); const pr = ps.payroll;
      const u = ui.payroll;
      if (!d.employees.length) return `<div class="page"><div class="page-header"><div><h1 class="page-title">Bảng lương tháng ${E.periodLabel(period)}</h1></div></div><section class="card">${emptyStaff(can)}</section></div>`;
      const hasActive = d.employees.some((e) => e.active);
      const rows = pr ? pr.rows.filter((r) => u.dept === 'all' || r.dept === u.dept) : [];
      const par = pr ? pr.par : d.params;
      const t = E.payTotals(rows);
      const canPost = !!pr && !ps.accrueAny && can;
      const canPay = ps.accrued && !ps.payoutAny && can;
      const depts = pr ? [...new Set(pr.rows.map((r) => r.dept))].sort() : [];
      const tabs = Object.entries(TAB_LABEL);
      const sheet = () => `<div class="table-wrap pay-wrap"><table class="tbl pay-tbl" id="pay-table"><thead><tr><th class="pay-s1">Mã</th><th class="pay-s2">Họ tên</th><th>Bộ phận</th>${COLS.map(([, l]) => `<th class="num">${l}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr><td class="mono pay-s1">${esc(r.code)}</td><td class="pay-s2"><span class="strong">${esc(r.name)}</span></td><td>${esc(r.dept)}</td>${COLS.map(([k, l, fk]) => `<td class="num"><button type="button" class="pay-cell${k === 'net' ? ' is-strong' : ''}" data-a="formula" data-code="${esc(r.code)}" data-k="${k}" aria-label="${esc(`${l} của ${r.name}: xem công thức`)}">${fmtCell(r, k)}</button></td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td class="pay-s1" colspan="1">Cộng</td><td class="pay-s2">${rows.length} nhân viên</td><td></td>${COLS.map(([k]) => `<td class="num">${k === 'workDays' ? '' : money(k === 'deduct' ? t.selfDeduct + t.depDeduct : t[k])}</td>`).join('')}</tr></tfoot></table></div>`;
      const body = !pr ? `<div class="empty">${icon('banknote')}<span class="empty-title">Chưa có bảng lương kỳ ${E.periodLabel(period)}</span><span class="empty-text">${hasActive ? 'Bấm Tạo bảng lương tháng để tính từ danh sách nhân viên và bảng chấm công.' : 'Mọi nhân viên đã nghỉ việc. Kích hoạt lại nhân viên để lập bảng lương.'}</span></div>`
        : !rows.length ? `<div class="empty">${icon('search')}<span class="empty-title">Bộ phận này không có dòng nào</span><span class="empty-text">Chọn bộ phận khác.</span></div>`
          : `${printHead(TAB_LABEL[u.tab])}${u.tab === 'sheet' ? sheet() : `<div class="table-wrap">${reportTable(u.tab, rows, par)}</div>`}`;
      return `<div class="page">
        <div class="page-header"><div class="od-fill" style="min-width:240px"><h1 class="page-title">Bảng lương tháng ${E.periodLabel(period)}</h1><span class="page-sub">${esc(E.company().name)} · ${payStatus(ps)}</span></div>
          <div class="page-actions">
            <button type="button" class="btn btn-outline" data-a="advance">${icon('wallet')}Ứng lương</button>
            <button type="button" class="btn btn-outline" data-a="create" ${can && hasActive ? '' : 'disabled'}>${icon('refresh')}Tạo bảng lương tháng</button>
            <button type="button" class="btn" data-a="post" data-primary-action ${canPost ? '' : 'disabled'}>${icon('check')}Ghi sổ lương</button>
            <button type="button" class="btn btn-outline" data-a="payout" ${canPay ? '' : 'disabled'}>${icon('banknote')}Chi lương</button>
          </div></div>
        <div class="stats" style="--cols:4">
          <div class="stat"><span class="stat-label">Tổng thu nhập</span><span class="stat-value">${pr ? money(t.gross) : '–'}</span><span class="stat-note">${pr ? `${rows.length} nhân viên` : 'Chưa tạo bảng lương'}</span></div>
          <div class="stat"><span class="stat-label">Bảo hiểm phải nộp</span><span class="stat-value">${pr ? money(t.empIns + t.coIns + t.kpcd) : '–'}</span><span class="stat-note">NLĐ + công ty + KPCĐ</span></div>
          <div class="stat"><span class="stat-label">Thuế TNCN</span><span class="stat-value">${pr ? money(t.pit) : '–'}</span><span class="stat-note">Biểu lũy tiến từng phần</span></div>
          <div class="stat"><span class="stat-label">Thực lĩnh</span><span class="stat-value">${pr ? money(t.net) : '–'}</span><span class="stat-note">Sau trừ ứng ${pr ? money(t.advance) : '–'} đ</span></div>
        </div>
        <section class="card">
          <div class="card-head pay-filters"><div class="od-fill"><span class="card-title">${TAB_LABEL[u.tab]}</span><span class="card-sub">Năm áp dụng ${esc(par.year)} · lương cơ sở ${money(par.luongCoSo)} đ (từ ${esc(par.luongCoSoTu)}) · trần BHXH ${money(par.tranBhxh)} đ · trần BHTN ${money(par.tranBhtn)} đ · <button type="button" class="link-btn" data-go="settings">Sửa tham số</button></span></div>
            ${pr ? `<div class="field"><label class="sr-only" for="pay-dept">Bộ phận</label><select id="pay-dept" class="select" data-a-change="dept"><option value="all">Mọi bộ phận</option>${depts.map((x) => `<option ${u.dept === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
            <button type="button" class="btn btn-outline" data-a="print" ${rows.length ? '' : 'disabled'}>${icon('printer')}In</button>
            <button type="button" class="btn btn-outline" data-a="csv" ${rows.length ? '' : 'disabled'}>${icon('download')}Xuất CSV</button>` : ''}</div>
          <div class="tabs" role="tablist" style="padding:0 12px">${tabs.map(([k, l]) => `<button type="button" role="tab" data-a="tab" data-k="${k}" aria-selected="${u.tab === k}">${l}</button>`).join('')}</div>
          ${body}
        </section>
      </div>`;
    },
    mount(host) {
      if (!E.canPayroll()) return;
      const d = E.db(); const period = state.period;
      host.addEventListener('change', (ev) => { if (ev.target.dataset.aChange === 'dept') { ui.payroll.dept = ev.target.value; E.refresh(); } });
      host.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-a]');
        if (!t || t.disabled) return;
        const a = t.dataset.a; const ps = E.payrollState(d, period); const pr = ps.payroll;
        if (a === 'tab') { ui.payroll.tab = t.dataset.k; E.refresh(); }
        if (a === 'advance') advanceDialog();
        if (a === 'formula' && pr) { const r = pr.rows.find((x) => x.code === t.dataset.code); if (r) formulaDialog(r, t.dataset.k, pr.par); }
        if (a === 'print') E.printPage(`${TAB_LABEL[ui.payroll.tab]} ${E.periodLabel(period)}`);
        if (a === 'csv') { const tb = host.querySelector('#pay-table'); if (tb) E.downloadCsv(`luong-${ui.payroll.tab}-${period}.csv`, E.tableRows(tb)); }
        if (a === 'create') {
          if (ps.accrueAny) { E.openDialog({ eyebrow: `Kỳ ${E.periodLabel(period)}`, title: 'Chưa tạo lại được bảng lương', body: `<p class="muted">Bảng lương kỳ này đã ${ps.accruePending ? 'có đề xuất ghi sổ chờ duyệt' : 'ghi sổ'}. Muốn tính lại, từ chối các đề xuất lương chưa duyệt ở màn Duyệt đề xuất; đề xuất đã ghi sổ phải đảo bút toán.</p>`, actions: [{ spacer: true }, { label: 'Mở Duyệt đề xuất', variant: 'btn-outline', run: () => E.go('review', { source: 'job' }) }, { label: 'Đóng', variant: 'btn-outline' }] }); return; }
          const make = () => { const p = E.createPayroll(d, period); E.toast('Đã tạo bảng lương', { text: `${p.rows.length} nhân viên, thực lĩnh ${money(p.rows.reduce((s, r) => s + r.net, 0))} đ.` }); after(); };
          if (pr) E.confirmDialog({ eyebrow: `Kỳ ${E.periodLabel(period)}`, title: 'Tạo lại bảng lương?', text: 'Bảng lương nháp hiện tại sẽ bị thay bằng số tính lại từ nhân viên, chấm công và tạm ứng.', confirmLabel: 'Tạo lại', onConfirm: make }); else make();
        }
        if (a === 'post' && pr) {
          const list = E.payrollPost(d, period);
          E.toast('Đã tạo đề xuất ghi sổ lương', { text: `${list.length} đề xuất theo bộ phận, chờ duyệt.`, action: { label: 'Mở Duyệt', run: () => E.go('review', { source: 'job' }) } });
          after();
        }
        if (a === 'payout' && pr) payoutDialog(pr);
      });
    },
  };
})(window.EYN);
