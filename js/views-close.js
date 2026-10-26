/* Month-end views: Chốt sổ tháng (S12), Tài sản & phân bổ (S20), Kiểm tra chi phí hợp lý (S22). */
(function (E) {
  const { esc, icon, badge, money, state } = E;

  if (!document.getElementById('views-close-style')) {
    const st = document.createElement('style');
    st.id = 'views-close-style';
    st.textContent = `
      .close-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
      .close-progress { display: grid; gap: 6px; min-width: 220px; }
      .close-progress > * { display: block; }
      .step-ack { display: block; font-size: 12px; color: var(--success-700); margin-top: 4px; }
      .lock-why { display: block; font-size: 12px; color: var(--ink-500); text-align: right; }
      .audit-item { display: grid; gap: 2px; padding: 10px 16px; border-bottom: 1px solid var(--ink-100); font-size: 13px; }
      .audit-item > * { display: block; }
      .audit-item:last-child { border-bottom: 0; }
      .flow { margin: 0; padding: 12px 16px 14px 36px; display: grid; gap: 6px; font-size: 13px; color: var(--ink-700); }
      .type-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 16px; border-bottom: 1px solid var(--ink-100); font-size: 13px; }
      .type-row:last-child { border-bottom: 0; }
      .type-row .od-icon { --od-icon-size: 16px; }
      .finding { display: grid; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--ink-100); }
      .finding:last-child { border-bottom: 0; }
      .finding-title { display: block; font-weight: 600; color: var(--ink-900); }
      .finding-detail { display: block; font-size: 13px; color: var(--ink-600); }
      .finding-legal { display: block; font-family: var(--font-mono); font-size: 12px; color: var(--ink-500); }
      .resolved summary { cursor: pointer; padding: 14px 20px; font-weight: 600; color: var(--ink-700); list-style: none; display: flex; gap: 8px; align-items: center; }
      .resolved summary::-webkit-details-marker { display: none; }
      .resolved summary .od-icon { --od-icon-size: 14px; transition: transform var(--dur-fast) var(--ease-out); }
      .resolved[open] summary .od-icon { transform: rotate(90deg); }
      .resolved .finding { opacity: .85; }
      @media (max-width: 1100px) { .close-grid { grid-template-columns: minmax(0, 1fr); } }
    `;
    document.head.appendChild(st);
  }

  const goAttr = (view, params) => `data-go="${view}"${params ? ` data-params='${esc(JSON.stringify(params))}'` : ''}`;
  const nowStamp = () => { const t = new Date(); return `2027-01-31 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  const after = () => { E.refresh(); E.refreshChrome(); };
  const pendingIn = (d) => d.proposals.filter((p) => p.status === 'proposed' && E.periodOf(p.date) === state.period);

  /* Textarea dialog with a required note; error shows only after blur or submit. */
  function noteDialog({ eyebrow, title, intro, label, placeholder, minLen = 1, errorText, confirmLabel, danger, onSave }) {
    const check = (el, show) => {
      const v = el.value.trim();
      const bad = v.length < minLen;
      const err = el.closest('.field').querySelector('.field-error');
      if (show) { err.hidden = !bad; el.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
      return bad ? null : v;
    };
    E.openDialog({
      eyebrow, title,
      body: `${intro ? `<p class="muted">${intro}</p>` : ''}
        <div class="field"><label class="label" for="note-input">${esc(label)}<span class="req">*</span></label>
        <textarea id="note-input" class="textarea" placeholder="${esc(placeholder || '')}" aria-describedby="note-err"></textarea>
        <span class="field-error" id="note-err" hidden>${esc(errorText)}</span></div>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: confirmLabel, variant: danger ? 'btn-danger' : '',
        run(api) { const v = check(api.el.querySelector('#note-input'), true); if (v == null) { api.el.querySelector('#note-input').focus(); return false; } onSave(v); return undefined; },
      }],
      onMount(api) { const ta = api.el.querySelector('#note-input'); ta.addEventListener('blur', () => check(ta, true)); ta.addEventListener('input', () => { if (ta.getAttribute('aria-invalid') === 'true') check(ta, true); }); },
      initialFocus: '#note-input',
    });
  }

  /* ======================= Chốt sổ tháng ======================= */
  const STEP_ICON = { pass: 'circle-check', warn: 'alert', fail: 'circle-x', skip: 'circle-minus', ack: 'circle-check' };
  const STEP_BADGE = { pass: ['success', 'Đạt'], warn: ['warning', 'Cần xác nhận'], fail: ['danger', 'Chưa đạt'], skip: ['neutral', 'Kiểm tay'], ack: ['success', 'Đã xác nhận'] };

  /* Profit after provisional CIT from posted P&L movements (closing entries excluded so it stays stable after kết chuyển). */
  function profitEstimate(d) {
    const PL = /^(5|63|64|7|8)/; const cit = E.rm(d).cit;
    let pl = 0; let booked = 0;
    d.entries.forEach((e) => {
      if (e.status !== 'posted' || e.source === 'smartpro_import' || e.type === 'KC' || E.periodOf(e.date) !== state.period) return;
      e.lines.forEach((l) => {
        if (PL.test(l.dr || '')) { pl += l.amt; if (l.dr.startsWith(cit)) booked += l.amt; }
        if (PL.test(l.cr || '')) { pl -= l.amt; if (l.cr.startsWith(cit)) booked -= l.amt; }
      });
    });
    const pre = -(pl - booked);
    const tax = booked || (pre > 0 ? Math.round((pre * (Number(d.opt.citRate) || 0)) / 100) : 0);
    return pre - tax;
  }

  E.views.close = {
    render() {
      const d = E.db();
      const c = E.company();
      const locked = E.isLocked();
      const cl = E.checklist();
      const total = cl.steps.length;
      const left = total - cl.done;
      const canWrite = E.canWrite();
      const canLock = cl.canLock && !locked && !E.isReadonly();
      const pending = pendingIn(d).length;
      const profit = profitEstimate(d);
      const cash = E.net('111') + E.net('112');
      const audit = [...d.audit].reverse();

      const groupTitle = { prep: 'Chuẩn bị và kiểm tra', doc: '13 bước xử lý cuối tháng theo Smart Pro' };
      const stepHtml = cl.steps.map((s, i) => {
        const head = i === 0 || cl.steps[i - 1].group !== s.group ? `<div class="step-group">${esc(groupTitle[s.group])}</div>` : '';
        const [tone, text] = STEP_BADGE[s.state];
        const acts = [];
        if (s.run) acts.push(`<button type="button" class="btn" data-a="run" data-run="${s.run}" ${canWrite ? '' : 'disabled'}>${icon('play')}${esc(s.runLabel)}</button>`);
        if (s.link) acts.push(`<button type="button" class="btn btn-outline" ${goAttr(s.link, s.params)}>${esc(s.linkLabel)}${icon('arrow-right')}</button>`);
        if (s.state === 'warn') acts.push(`<button type="button" class="btn btn-success-outline" data-a="ack" data-step="${s.id}" ${canWrite ? '' : 'disabled'}>${icon('check')}Xác nhận</button>`);
        if (s.state === 'ack') acts.push(`<button type="button" class="btn btn-ghost" data-a="unack" data-step="${s.id}" ${canWrite ? '' : 'disabled'}>Bỏ xác nhận</button>`);
        return `${head}<div class="step">
          <span class="step-no" ${s.docNo ? `title="Bước ${esc(s.docNo)} trong xử lý cuối tháng của Smart Pro"` : ''}>${s.docNo ? esc(s.docNo) : '·'}</span>
          <span class="step-icon ${s.state}">${icon(STEP_ICON[s.state])}</span>
          <div style="min-width:0">
            <div class="od-cluster" style="--od-gap:8px"><span class="step-title">${esc(s.title)}</span>${badge(tone, text)}</div>
            <span class="step-detail">${esc(s.detail)}</span>
            ${s.state === 'ack' ? `<span class="step-ack">Đã xác nhận: ${esc(d.acks[s.id])}</span>` : ''}
          </div>
          <div class="step-actions">${acts.join('')}</div>
        </div>`;
      }).join('');

      return `<div class="page">
        <div class="page-header">
          <div class="od-fill" style="min-width:240px">
            <h1 class="page-title">Chốt sổ tháng ${E.periodLabel(state.period)}</h1>
            <span class="page-sub">${esc(c.name)} · ${esc(c.regime)}</span>
          </div>
          <div class="page-actions">
            <div class="close-progress">
              <span class="label">${cl.done}/${total} bước đạt</span>
              <div class="progress ${cl.done === total ? 'is-success' : 'is-brand'}" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${cl.done}" aria-label="Tiến độ chốt sổ"><span style="transform:scaleX(${cl.done / total})"></span></div>
            </div>
            ${locked
              ? `${badge('neutral', 'Đã khóa', 'lock')}<button type="button" class="btn btn-danger-outline" data-a="unlock" ${E.isReadonly() ? 'disabled' : ''}>${icon('lock-open')}Mở khóa kỳ</button>`
              : `<div class="od-stack" style="--od-gap:4px"><button type="button" class="btn" data-a="lock" data-primary-action ${canLock ? '' : 'disabled aria-describedby="lock-why"'}>${icon('lock')}Khóa kỳ</button>${canLock ? '' : `<span class="lock-why" id="lock-why">${E.isReadonly() ? 'Công ty chỉ đọc' : `Còn ${left} bước chưa đạt`}</span>`}</div>`}
          </div>
        </div>

        <div class="stats" style="--cols:3">
          <div class="stat"><span class="stat-label">Đề xuất chờ duyệt</span><span class="stat-value">${pending}</span><span class="stat-note">${pending ? `<button type="button" class="link-btn" ${goAttr('review')}>Mở màn Duyệt</button>` : 'Đã duyệt hết'}</span></div>
          <div class="stat"><span class="stat-label">Lợi nhuận tạm tính</span><span class="stat-value ${profit < 0 ? 'text-danger' : ''}">${E.signed(profit)}</span><span class="stat-note">Đã gồm thuế TNDN tạm tính ${esc(String(Number(d.opt.citRate) || 0))}%</span></div>
          <div class="stat"><span class="stat-label">Tiền cuối kỳ (111 + 112)</span><span class="stat-value">${money(cash)}</span><span class="stat-note">Đơn vị: đồng</span></div>
        </div>

        <div class="close-grid">
          <section class="card" aria-labelledby="steps-title">
            <div class="card-head"><div class="od-fill"><span class="card-title" id="steps-title">Checklist chốt sổ</span><span class="card-sub">Mọi bước đạt hoặc đã xác nhận thì mới khóa được kỳ.</span></div></div>
            <div class="steps">${stepHtml}</div>
          </section>
          <aside class="od-stack" style="--od-gap:16px">
            <section class="card">
              <div class="card-head"><span class="card-title">Thứ tự nên làm</span></div>
              <ol class="flow">
                <li>Duyệt hết đề xuất trong kỳ, chốt lương</li>
                <li>Chạy khấu hao, phân bổ</li>
                <li>Tính giá xuất kho</li>
                <li>Phân bổ chi phí chung, kết chuyển 154</li>
                <li>Thuế TNDN, kết chuyển sang 911</li>
                <li>Kết chuyển GTGT, lãi lỗ</li>
                <li>Khóa kỳ</li>
              </ol>
            </section>
            <section class="card">
              <div class="card-head"><span class="card-title">Nhật ký khóa/mở</span></div>
              ${audit.length ? audit.map((a) => `<div class="audit-item"><span class="mono muted" style="font-size:12px">${esc(a.at)}</span><span>${esc(a.what)}</span><span class="muted" style="font-size:12px">${esc(a.who)}</span></div>`).join('') : '<div class="empty"><span class="empty-text">Chưa có lần khóa/mở nào.</span></div>'}
            </section>
          </aside>
        </div>
      </div>`;
    },

    mount(host) {
      const d = E.db();
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t || t.disabled) return;
        const a = t.dataset.a;
        const label = E.periodLabel(state.period);

        if (a === 'run') {
          const kind = t.dataset.run;
          const reviewAction = { label: 'Mở Duyệt', run: () => E.go('review', { source: 'job' }) };
          if (kind === 'depreciation') {
            const n = E.runDepreciation();
            E.toast('Đã tạo đề xuất khấu hao, chờ duyệt', { text: `${n} dòng phân bổ cho kỳ ${label}.`, action: reviewAction });
          } else if (kind === 'cogs') {
            const r = E.runCogs();
            E.toast(r.lines ? 'Đã tạo đề xuất điều chỉnh giá xuất, chờ duyệt' : 'Giá xuất kho đã khớp', { text: r.lines ? `${r.lines} nhóm xuất kho, chênh lệch ${E.signed(r.diff)} đ so với giá tạm tính.` : 'Giá vốn đã ghi bằng giá xuất tính lại, không cần điều chỉnh.', action: r.lines ? reviewAction : undefined });
          } else if (kind === 'cost') {
            const r = E.runCostTransfer();
            if (r.error) E.toast('Chưa kết chuyển được chi phí', { error: true, text: r.error, action: { label: 'Mở Giá thành', run: () => E.go('costing', { tab: 'alloc' }) } });
            else E.toast('Đã tạo đề xuất kết chuyển chi phí, chờ duyệt', { text: `${r.kc} dòng kết chuyển sang 154, ${r.gt} dòng giá thành.`, action: reviewAction });
          } else if (kind === 'closing') {
            const r = E.runClosing();
            E.toast('Đã tạo đề xuất thuế TNDN và kết chuyển, chờ duyệt', { text: `Lợi nhuận trước thuế ${money(r.pre)} đ, thuế TNDN tạm tính ${money(r.tax)} đ.`, action: reviewAction });
          } else if (kind === 'vat') {
            const r = E.runVatKc();
            E.toast(r.amt ? 'Đã tạo đề xuất kết chuyển GTGT, chờ duyệt' : 'Không có thuế GTGT để kết chuyển', { text: r.amt ? `Khấu trừ ${money(r.amt)} đ.` : undefined, action: r.amt ? reviewAction : undefined });
          } else if (kind === 'profit') {
            const r = E.runProfitKc();
            E.toast('Đã tạo đề xuất kết chuyển lãi lỗ, chờ duyệt', { text: `${r.profit >= 0 ? 'Lãi' : 'Lỗ'} sau thuế ${money(Math.abs(r.profit))} đ chuyển vào 4212.`, action: reviewAction });
          }
          after();
        }

        if (a === 'ack') {
          const s = E.checklist().steps.find((x) => x.id === t.dataset.step);
          noteDialog({
            eyebrow: `Bước: ${s.title}`, title: 'Xác nhận cảnh báo',
            intro: esc(s.detail), label: 'Ghi chú xác nhận', placeholder: 'Ví dụ: đã đối chiếu với khách, chênh lệch do hóa đơn tháng sau',
            errorText: 'Cần nhập ghi chú trước khi xác nhận.', confirmLabel: 'Xác nhận',
            onSave(note) { d.acks[s.id] = note; E.toast('Đã xác nhận bước', { text: s.title }); after(); },
          });
        }

        if (a === 'unack') { delete d.acks[t.dataset.step]; E.toast('Đã bỏ xác nhận'); after(); }

        if (a === 'lock') {
          const next = '2027-02';
          E.confirmDialog({
            eyebrow: E.company().name, title: `Khóa kỳ ${label}?`,
            text: `Sau khi khóa, không ai ghi, sửa hay đảo bút toán trong kỳ ${label}. Muốn sửa phải mở khóa kèm lý do. Kỳ ${E.periodLabel(next)} sẽ mở để nhập liệu.`,
            confirmLabel: 'Khóa kỳ',
            onConfirm() {
              d.periods[state.period] = { locked: true, lockedBy: state.user.name, lockedAt: '2027-01-31' };
              if (!d.periods[next]) d.periods[next] = { locked: false };
              d.audit.push({ at: nowStamp(), who: state.user.name, what: `Khóa kỳ ${label}` });
              E.toast(`Đã khóa kỳ ${label}`, { icon: 'lock', text: `Kỳ ${E.periodLabel(next)} đã mở.` });
              after();
            },
          });
        }

        if (a === 'unlock') {
          const later = Object.keys(d.periods).filter((p) => p > state.period && d.periods[p].locked);
          noteDialog({
            eyebrow: E.company().name, title: `Mở khóa kỳ ${label}`,
            intro: `Mở kỳ này thì các kỳ sau cũng mở theo${later.length ? ` (${later.map(E.periodLabel).join(', ')})` : ''}. Lý do được ghi vào nhật ký kiểm toán, không xóa được.`,
            label: 'Lý do mở khóa', placeholder: 'Ví dụ: bổ sung hóa đơn mua vào khách gửi muộn', minLen: 10,
            errorText: 'Lý do cần ít nhất 10 ký tự.', confirmLabel: 'Mở khóa', danger: true,
            onSave(reason) {
              Object.keys(d.periods).filter((p) => p >= state.period).forEach((p) => { d.periods[p] = { locked: false }; });
              d.audit.push({ at: nowStamp(), who: state.user.name, what: `Mở khóa kỳ ${label}. Lý do: ${reason}` });
              E.toast(`Đã mở khóa kỳ ${label}`, { icon: 'lock-open' });
              after();
            },
          });
        }
      });
    },
  };

  /* ======================= Tài sản & phân bổ ======================= */
  const KIND_TONE = { 'TSCĐ': 'info', CCDC: 'brand', 'Trả trước': 'neutral' };
  const ASSET_STATUS = { active: ['success', 'Đang trích'], paused: ['warning', 'Tạm dừng'], disposed: ['neutral', 'Đã thanh lý'] };
  const monthly = (a) => Math.round(a.cost / a.months);
  const remaining = (a) => (a.usedBefore >= a.months ? 0 : Math.max(0, a.cost - monthly(a) * a.usedBefore));
  const addMonth = (p, n) => {
    let y = Number(p.slice(0, 4)); let m = Number(p.slice(5, 7)) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return `${String(m + 1).padStart(2, '0')}/${y}`;
  };

  function scheduleRows(a, ran) {
    const rows = [];
    let acc = a.cost - remaining(a);
    for (let i = 0; i < 12; i++) {
      const k = a.usedBefore + i + 1;
      if (k > a.months) break;
      const amt = k === a.months ? a.cost - monthly(a) * (a.months - 1) : monthly(a);
      acc += amt;
      rows.push({ month: addMonth(state.period, i + (ran ? 1 : 0)), amt, acc, left: a.cost - acc });
    }
    return rows;
  }

  function assetDialog(a) {
    const d = E.db();
    const rows = scheduleRows(a, d.runs.depreciation);
    const canWrite = E.canWrite();
    const [tone, text] = ASSET_STATUS[a.status];
    const actions = [];
    if (canWrite && a.status !== 'disposed') {
      actions.push({ label: 'Thanh lý', variant: 'btn-danger-outline', icon: 'trash', run(api) {
        api.close();
        setTimeout(() => E.confirmDialog({
          eyebrow: a.id, title: `Thanh lý ${a.name}?`, text: 'Tài sản sẽ ngừng trích khấu hao từ kỳ này. Bút toán ghi giảm tài sản lập ở màn Nhập chứng từ.',
          confirmLabel: 'Thanh lý', danger: true,
          onConfirm() { a.status = 'disposed'; E.toast(`Đã thanh lý ${a.id}`); after(); },
        }), 0);
      } });
    }
    actions.push({ spacer: true });
    if (canWrite && a.status !== 'disposed') {
      actions.push({ label: a.status === 'paused' ? 'Tiếp tục trích' : 'Tạm dừng', variant: 'btn-outline', icon: a.status === 'paused' ? 'play' : 'clock', run() {
        a.status = a.status === 'paused' ? 'active' : 'paused';
        E.toast(a.status === 'paused' ? `Đã tạm dừng ${a.id}` : `${a.id} trích tiếp từ kỳ này`);
        after();
      } });
    }
    actions.push({ label: 'Đóng', variant: 'btn-outline' });
    E.openDialog({
      eyebrow: `${a.id} · ${a.kind}`, title: a.name, size: 'lg',
      body: `<div class="od-cluster">${badge(KIND_TONE[a.kind], a.kind)}${badge(tone, text)}</div>
        <dl class="dl">
          <dt>Nguyên giá</dt><dd class="mono">${money(a.cost)} đ</dd>
          <dt>Thời gian trích</dt><dd><span class="mono">${a.months}</span> tháng, từ <span class="mono">${esc(a.start.slice(5, 7))}/${esc(a.start.slice(0, 4))}</span></dd>
          <dt>Đã trích</dt><dd><span class="mono">${a.usedBefore}</span> tháng · lũy kế <span class="mono">${money(a.cost - remaining(a))}</span> đ</dd>
          <dt>Tài khoản</dt><dd><span class="acc-chip">${esc(a.acc)}</span> / <span class="acc-chip">${esc(a.dep)}</span></dd>
          <dt>Phân bổ chi phí</dt><dd>${a.alloc.map(([code, pct]) => `<span class="acc-chip">${esc(code)}</span> <span class="mono">${pct}%</span>`).join(' · ')}</dd>
        </dl>
        <div>
          <span class="label">Lịch trích 12 tháng tới</span>
          ${a.status !== 'active' ? `<p class="help" style="margin-top:4px">Tài sản đang ${a.status === 'paused' ? 'tạm dừng' : 'đã thanh lý'}, lịch dưới đây chỉ để tham khảo.</p>` : ''}
          ${rows.length ? `<div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Tháng</th><th class="num">Mức trích</th><th class="num">Lũy kế</th><th class="num">Còn lại</th></tr></thead>
            <tbody>${rows.map((r) => `<tr><td class="mono">${r.month}</td><td class="num">${money(r.amt)}</td><td class="num">${money(r.acc)}</td><td class="num">${money(r.left)}</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="empty"><span class="empty-title">Đã trích hết</span><span class="empty-text">Tài sản không còn giá trị phải trích.</span></div>'}
        </div>`,
      actions,
    });
  }

  function addAssetDialog() {
    const d = E.db();
    const rules = {
      'f-name': (v) => (v.trim() ? '' : 'Nhập tên tài sản.'),
      'f-cost': (v) => (E.parseMoney(v) > 0 ? '' : 'Nguyên giá phải lớn hơn 0.'),
      'f-months': (v) => (Number(v) >= 1 && Number.isInteger(Number(v)) ? '' : 'Số tháng là số nguyên từ 1 trở lên.'),
    };
    const check = (el) => {
      const msg = rules[el.id](el.value);
      const err = el.closest('.field').querySelector('.field-error');
      err.textContent = msg; err.hidden = !msg;
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    };
    E.openDialog({
      eyebrow: 'Tài sản & phân bổ', title: 'Thêm tài sản',
      body: `<div class="form-grid">
          <div class="field span-12"><label class="label" for="f-name">Tên tài sản<span class="req">*</span></label><input id="f-name" class="input" placeholder="Ví dụ: Máy toàn đạc điện tử"><span class="field-error" hidden></span></div>
          <div class="field span-6"><label class="label" for="f-kind">Loại</label><select id="f-kind" class="select"><option>TSCĐ</option><option>CCDC</option><option>Trả trước</option></select></div>
          <div class="field span-6"><label class="label" for="f-exp">TK chi phí</label><select id="f-exp" class="select"><option value="154">154 · CP SXKD dở dang</option><option value="6421">6421 · CP bán hàng</option><option value="6422" selected>6422 · CP quản lý DN</option></select></div>
          <div class="field span-6"><label class="label" for="f-cost">Nguyên giá (đ)<span class="req">*</span></label><input id="f-cost" class="input mono" inputmode="numeric" placeholder="24.000.000"><span class="field-error" hidden></span></div>
          <div class="field span-6"><label class="label" for="f-months">Số tháng trích<span class="req">*</span></label><input id="f-months" class="input mono" inputmode="numeric" placeholder="36"><span class="field-error" hidden></span></div>
        </div>
        <p class="help">Bắt đầu trích từ kỳ ${E.periodLabel(state.period)}. TSCĐ ghi 2111/2141, CCDC và trả trước ghi 242.</p>`,
      actions: [{ spacer: true }, { label: 'Hủy', variant: 'btn-outline' }, {
        label: 'Thêm tài sản', run(api) {
          const els = Object.keys(rules).map((id) => api.el.querySelector(`#${id}`));
          const ok = els.map(check).every(Boolean);
          if (!ok) { els.find((el) => el.getAttribute('aria-invalid') === 'true').focus(); return false; }
          const kind = api.el.querySelector('#f-kind').value;
          const prefix = kind === 'TSCĐ' ? 'A' : 'T';
          const n = d.assets.filter((x) => x.id.startsWith(prefix)).length + 1;
          const asset = {
            id: `${prefix}${String(n).padStart(3, '0')}`, name: api.el.querySelector('#f-name').value.trim(), kind,
            acc: kind === 'TSCĐ' ? '2111' : '242', dep: kind === 'TSCĐ' ? '2141' : '242',
            cost: E.parseMoney(api.el.querySelector('#f-cost').value), months: Number(api.el.querySelector('#f-months').value),
            start: state.period, alloc: [[api.el.querySelector('#f-exp').value, 100]], usedBefore: 0, status: 'active',
          };
          d.assets.push(asset);
          E.toast(`Đã thêm ${asset.id}`, { text: `${money(monthly(asset))} đ/tháng` });
          after();
          return undefined;
        },
      }],
      onMount(api) {
        Object.keys(rules).forEach((id) => {
          const el = api.el.querySelector(`#${id}`);
          el.addEventListener('blur', () => { if (el.value || el.getAttribute('aria-invalid')) check(el); });
          el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
        });
        const cost = api.el.querySelector('#f-cost');
        cost.addEventListener('blur', () => { const n = E.parseMoney(cost.value); if (n > 0) cost.value = money(n); });
      },
      initialFocus: '#f-name',
    });
  }

  E.views.assets = {
    render() {
      const d = E.db();
      const fixed = d.assets.filter((a) => a.kind === 'TSCĐ');
      const costFixed = fixed.reduce((s, a) => s + a.cost, 0);
      const accFixed = fixed.reduce((s, a) => s + (a.cost - remaining(a)), 0);
      const left = d.assets.filter((a) => a.status !== 'disposed').reduce((s, a) => s + remaining(a), 0);
      const thisMonth = d.assets.reduce((s, a) => s + E.monthlyDep(a), 0);
      const canRun = E.canWrite() && !d.runs.depreciation;
      return `<div class="page">
        <div class="page-header">
          <div class="od-fill" style="min-width:240px"><h1 class="page-title">Tài sản & phân bổ</h1><span class="page-sub">TSCĐ, công cụ dụng cụ và chi phí trả trước · kỳ ${E.periodLabel(state.period)}</span></div>
          <div class="page-actions">
            ${d.runs.depreciation ? badge('success', 'Đã chạy khấu hao kỳ này', 'circle-check') : ''}
            <button type="button" class="btn btn-outline" data-a="add" ${E.canWrite() ? '' : 'disabled'}>${icon('plus')}Thêm tài sản</button>
            <button type="button" class="btn" data-a="run" data-primary-action ${canRun ? '' : 'disabled'}>${icon('play')}Chạy khấu hao tháng</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><span class="stat-label">Nguyên giá TSCĐ</span><span class="stat-value">${money(costFixed)}</span><span class="stat-note">${fixed.length} tài sản</span></div>
          <div class="stat"><span class="stat-label">Hao mòn lũy kế TSCĐ</span><span class="stat-value">${money(accFixed)}</span><span class="stat-note">TK 2141</span></div>
          <div class="stat"><span class="stat-label">Giá trị còn lại</span><span class="stat-value">${money(left)}</span><span class="stat-note">Gồm cả 242</span></div>
          <div class="stat"><span class="stat-label">Chi phí trích tháng này</span><span class="stat-value">${money(thisMonth)}</span><span class="stat-note">${d.runs.depreciation ? 'Đã tạo đề xuất' : 'Chưa chạy'}</span></div>
        </div>
        <section class="card">
          <div class="card-head"><div class="od-fill"><span class="card-title">Danh sách tài sản</span><span class="card-sub">Bấm một dòng để xem lịch khấu hao.</span></div></div>
          ${d.assets.length ? `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th class="num">Nguyên giá</th><th class="num">Số tháng</th><th class="num">Đã trích</th><th class="num">Mức tháng</th><th class="num">Còn lại</th><th>TK chi phí</th><th>Trạng thái</th></tr></thead>
            <tbody>${d.assets.map((a) => {
              const [tone, text] = ASSET_STATUS[a.status];
              return `<tr class="is-click" tabindex="0" data-a="open" data-id="${esc(a.id)}">
                <td class="mono">${esc(a.id)}</td><td style="min-width:200px">${esc(a.name)}</td><td>${badge(KIND_TONE[a.kind], a.kind)}</td>
                <td class="num">${money(a.cost)}</td><td class="num">${a.months}</td><td class="num">${a.usedBefore}</td><td class="num">${money(monthly(a))}</td><td class="num">${money(remaining(a))}</td>
                <td class="od-nowrap">${a.alloc.map(([code, pct]) => `<span class="acc-chip">${esc(code)}</span> <span class="mono muted">${pct}%</span>`).join(' ')}</td>
                <td>${badge(tone, text)}</td></tr>`;
            }).join('')}</tbody></table></div>`
            : `<div class="empty">${icon('package')}<span class="empty-title">Chưa có tài sản</span><span class="empty-text">Thêm tài sản để app tự trích khấu hao hằng tháng.</span></div>`}
        </section>
      </div>`;
    },
    mount(host) {
      const d = E.db();
      const open = (row) => { const a = d.assets.find((x) => x.id === row.dataset.id); if (a) assetDialog(a); };
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t || t.disabled) return;
        if (t.dataset.a === 'open') open(t);
        if (t.dataset.a === 'add') addAssetDialog();
        if (t.dataset.a === 'run') {
          const n = E.runDepreciation();
          E.toast('Đã tạo đề xuất khấu hao, chờ duyệt', { text: `${n} dòng phân bổ kỳ ${E.periodLabel(state.period)}.`, action: { label: 'Mở Duyệt', run: () => E.go('review', { source: 'job' }) } });
          after();
        }
      });
      host.addEventListener('keydown', (e) => {
        const row = e.target.closest('tr[data-a="open"]');
        if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(row); }
      });
    },
  };

  /* ======================= Kiểm tra chi phí hợp lý ======================= */
  const CHECK_TYPES = ['Không chứng từ', 'Tiền mặt trên ngưỡng', 'Người bán ngừng hoạt động', 'Hóa đơn đã hủy', 'Thuế suất bất thường', 'Vượt định mức', 'Thuế nhà thầu', 'Khấu hao tài sản đã thanh lý'];
  const SEV = { fail: ['danger', 'Lỗi'], warn: ['warning', 'Cảnh báo'] };
  const CHECK_STATUS = { open: ['warning', 'Cần xử lý'], fixed: ['success', 'Đã sửa'], nondeductible: ['neutral', 'Không được trừ'], dismissed: ['neutral', 'Bỏ qua'] };
  const LINK_LABEL = { review: 'Mở đề xuất', invoices: 'Mở hóa đơn', vouchers: 'Mở chứng từ', assets: 'Mở tài sản' };
  const ADVICE = {
    'Hóa đơn đã hủy': 'Từ chối đề xuất ghi sổ và chờ hóa đơn thay thế từ người bán. Nếu đã ghi sổ thì lập bút toán đảo trong cùng kỳ.',
    'Người bán ngừng hoạt động': 'Tra cứu lại trạng thái MST trên cổng thuế. Nếu người bán ngừng hoạt động trước ngày lập hóa đơn thì không khấu trừ thuế GTGT và cân nhắc đưa vào chi phí không được trừ.',
    'Thuế nhà thầu': 'Kiểm tra nhà cung cấp nước ngoài đã đăng ký thuế tại Việt Nam chưa. Nếu chưa, doanh nghiệp phải khấu trừ và nộp thay thuế nhà thầu (GTGT 5%, TNDN 5% với quảng cáo trực tuyến).',
    'Không chứng từ': 'Đính kèm hợp đồng thuê và chứng từ khai, nộp thuế thay cho cá nhân. Thiếu hồ sơ thì khoản chi không được tính vào chi phí được trừ.',
  };
  const isOpen = (k) => k.status === 'open';

  function findingHtml(k, canWrite) {
    const [sTone, sText] = SEV[k.severity];
    const [stTone, stText] = CHECK_STATUS[k.status];
    const acts = [];
    if (k.link) acts.push(`<button type="button" class="btn btn-outline" ${goAttr(k.link)}>${esc(LINK_LABEL[k.link] || 'Mở')}${icon('arrow-right')}</button>`);
    acts.push(`<button type="button" class="btn btn-ghost" data-a="explain" data-id="${k.id}">${icon('sparkles')}Giải thích</button>`);
    if (isOpen(k)) {
      acts.push(`<span class="od-fill"></span>`);
      acts.push(`<button type="button" class="btn btn-success-outline" data-a="fixed" data-id="${k.id}" ${canWrite ? '' : 'disabled'}>${icon('check')}Đã sửa</button>`);
      acts.push(`<button type="button" class="btn btn-outline" data-a="nondeductible" data-id="${k.id}" ${canWrite ? '' : 'disabled'}>Không được trừ</button>`);
      acts.push(`<button type="button" class="btn btn-ghost" data-a="dismiss" data-id="${k.id}" ${canWrite ? '' : 'disabled'}>Bỏ qua</button>`);
    } else {
      acts.push(`<span class="od-fill"></span>`);
      acts.push(`<button type="button" class="btn btn-ghost" data-a="reopen" data-id="${k.id}" ${canWrite ? '' : 'disabled'}>${icon('undo')}Mở lại</button>`);
    }
    return `<article class="finding">
      <div class="od-cluster">${badge(sTone, sText)}${badge('', k.type)}${badge(stTone, stText)}</div>
      <span class="finding-title">${esc(k.title)}</span>
      <span class="finding-detail">${esc(k.detail)}</span>
      <span class="finding-legal">Căn cứ: ${esc(k.legal)}</span>
      ${k.note ? `<span class="help">Ghi chú: ${esc(k.note)}</span>` : ''}
      <div class="od-cluster">${acts.join('')}</div>
    </article>`;
  }

  E.views.checks = {
    render(params = {}) {
      const d = E.db();
      const filter = params.filter || 'all';
      const canWrite = E.canWrite();
      const open = d.checks.filter(isOpen);
      const done = d.checks.filter((k) => !isOpen(k));
      const fails = open.filter((k) => k.severity === 'fail').length;
      const warns = open.filter((k) => k.severity === 'warn').length;
      const nonDed = d.checks.filter((k) => k.status === 'nondeductible').length;
      const seg = [['all', 'Tất cả', d.checks.length], ['open', 'Cần xử lý', open.length], ['done', 'Đã xử lý', done.length]];
      const showOpen = filter !== 'done';
      const showDone = filter !== 'open';

      const typeRows = CHECK_TYPES.map((t) => {
        const all = d.checks.filter((k) => k.type === t);
        const o = all.filter(isOpen);
        const hasFail = o.some((k) => k.severity === 'fail');
        const [ic, cls, text] = !all.length ? ['circle-check', 'text-success', 'Không phát hiện']
          : o.length ? [hasFail ? 'circle-x' : 'alert', hasFail ? 'text-danger' : 'text-warning', `${o.length} cần xử lý`]
          : ['circle-check', 'text-success', `${all.length} đã xử lý`];
        return `<div class="type-row"><span class="${cls}">${icon(ic)}</span><span>${esc(t)}</span><span class="${cls}" style="font-size:12px">${esc(text)}</span></div>`;
      }).join('');

      return `<div class="page">
        <div class="page-header">
          <div class="od-fill" style="min-width:240px"><h1 class="page-title">Kiểm tra chi phí hợp lý</h1><span class="page-sub">8 nhóm kiểm tra trên chứng từ kỳ ${E.periodLabel(state.period)} · cập nhật 31/01/2027</span></div>
          <div class="page-actions"><div class="seg" role="group" aria-label="Lọc trạng thái">${seg.map(([v, l, n]) => `<button type="button" data-a="filter" data-v="${v}" aria-pressed="${filter === v}">${l}<span class="count">${n}</span></button>`).join('')}</div></div>
        </div>
        <div class="stats">
          <div class="stat"><span class="stat-label">Lỗi cần xử lý</span><span class="stat-value ${fails ? 'text-danger' : ''}">${fails}</span><span class="stat-note">Chặn khóa kỳ</span></div>
          <div class="stat"><span class="stat-label">Cảnh báo cần xử lý</span><span class="stat-value ${warns ? 'text-warning' : ''}">${warns}</span><span class="stat-note">Cần xác minh</span></div>
          <div class="stat"><span class="stat-label">Đã xử lý</span><span class="stat-value">${done.length}</span><span class="stat-note">Sửa, bỏ qua hoặc không được trừ</span></div>
          <div class="stat"><span class="stat-label">Chi phí không được trừ</span><span class="stat-value">${nonDed}</span><span class="stat-note">Đưa vào báo cáo năm</span></div>
        </div>
        <div class="close-grid">
          <div class="od-stack" style="--od-gap:16px">
            ${showOpen ? `<section class="card" aria-labelledby="open-title">
              <div class="card-head"><span class="card-title" id="open-title">Cần xử lý</span>${badge(open.length ? 'warning' : 'success', String(open.length))}</div>
              ${open.length ? open.map((k) => findingHtml(k, canWrite)).join('') : `<div class="empty">${icon('shield')}<span class="empty-title">Không còn mục cần xử lý</span><span class="empty-text">Bước kiểm tra chi phí trong checklist chốt sổ đã đạt.</span></div>`}
            </section>` : ''}
            ${showDone ? (filter === 'done'
              ? `<section class="card"><div class="card-head"><span class="card-title">Đã xử lý</span>${badge('', String(done.length))}</div>${done.length ? done.map((k) => findingHtml(k, canWrite)).join('') : '<div class="empty"><span class="empty-title">Chưa xử lý mục nào</span><span class="empty-text">Các mục đã sửa, bỏ qua hoặc không được trừ sẽ hiện ở đây.</span></div>'}</section>`
              : done.length ? `<details class="card resolved"><summary>${icon('chevron-right')}Đã xử lý (${done.length})</summary>${done.map((k) => findingHtml(k, canWrite)).join('')}</details>` : '') : ''}
          </div>
          <aside class="card">
            <div class="card-head"><span class="card-title">Nhóm kiểm tra</span></div>
            ${typeRows}
          </aside>
        </div>
      </div>`;
    },
    mount(host, params = {}) {
      const d = E.db();
      const find = (id) => d.checks.find((k) => k.id === id);
      const set = (k, status, note, msg) => { k.status = status; if (note !== undefined) k.note = note; E.toast(msg, { text: k.title }); E.refresh(params); E.refreshChrome(); };
      host.addEventListener('click', (e) => {
        const t = e.target.closest('[data-a]');
        if (!t || t.disabled) return;
        const a = t.dataset.a;
        if (a === 'filter') { E.go('checks', { ...params, filter: t.dataset.v }); return; }
        const k = find(t.dataset.id);
        if (!k) return;
        if (a === 'fixed') set(k, 'fixed', undefined, 'Đã đánh dấu đã sửa');
        if (a === 'nondeductible') set(k, 'nondeductible', 'Đưa vào chi phí không được trừ', 'Đã chuyển sang không được trừ');
        if (a === 'reopen') set(k, 'open', '', 'Đã mở lại');
        if (a === 'dismiss') {
          noteDialog({
            eyebrow: k.type, title: 'Bỏ qua cảnh báo', intro: esc(k.title), label: 'Lý do bỏ qua',
            placeholder: 'Ví dụ: đã xác minh người bán hoạt động lại từ 20/01', errorText: 'Cần nhập lý do bỏ qua.', confirmLabel: 'Bỏ qua',
            onSave(note) { set(k, 'dismissed', note, 'Đã bỏ qua'); },
          });
        }
        if (a === 'explain') {
          const body = !d.aiEnabled
            ? `<div class="empty">${icon('sparkles')}<span class="empty-title">AI bên ngoài đang tắt cho khách này</span><span class="empty-text">Bật lại ở Cài đặt công ty nếu khách đã đồng ý.</span></div>`
            : `<div class="msg msg-bot" style="max-width:100%">
                <p><b>Vì sao bị đánh dấu:</b> ${esc(k.detail)}</p>
                <p><b>Căn cứ:</b> <span class="mono">${esc(k.legal)}</span>.</p>
                <p><b>Nên làm:</b> ${esc(ADVICE[k.type] || 'Đối chiếu chứng từ gốc, bổ sung hồ sơ còn thiếu rồi đánh dấu đã sửa.')}</p>
              </div><p class="help">Giải thích do AI soạn từ dữ liệu sổ, kế toán chịu trách nhiệm quyết định cuối.</p>`;
          E.openDialog({ eyebrow: k.type, title: k.title, body, actions: [{ spacer: true }, { label: 'Đóng', variant: 'btn-outline' }] });
        }
      });
    },
  };
})(window.EYN);
