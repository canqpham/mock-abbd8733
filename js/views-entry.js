/* Voucher entry (S03): Smart Pro "Sổ chứng từ gốc" style flat grid. 1 row = 1 debit/credit pair, 41 default columns, 7 pinned. */
(function (E) {
  const { esc, icon, money, state } = E;

  /* ---------- Column model (smart-pro-ktsc-ui-guide.md §2) ---------- */
  // [key, label, width, kind(t text|c code|d date|n number|p percent), flags, tip]
  const C = (k, label, w, kind, o = {}, tip = '') => ({ k, label, w, kind, ...o, tip });
  const BASE = [
    C('id', 'ID', 50, 'n', { pin: 1, ro: 1 }, 'Số thứ tự dòng, hệ thống tự cấp khi ghi sổ.'),
    C('lctg', 'Chứng từ', 60, 'c', { pin: 1, look: 'lctg' }, 'Loại chứng từ (danh mục Loại chứng từ): HDMV mua vào, HD bán ra dịch vụ, HDBR bán ra có mã hàng, PT, PC, TNH, CNH, UNC, PKT... Đổi loại thì TK mặc định tự nạp.'),
    C('sr_hd', 'Seri HĐ', 77, 'c', { pin: 1 }, 'Ký hiệu hóa đơn, ví dụ 1C27TAA. Bắt buộc khi dòng có TK thuế 1331 hoặc 33311.'),
    C('so_hd', 'Số HĐ', 80, 'c', { pin: 1 }, 'Số hóa đơn gốc. Các dòng cùng một hóa đơn dùng chung Seri và Số HĐ.'),
    C('ngay_hd', 'Ngày HĐ', 68, 'd', { pin: 1 }, 'Ngày lập hóa đơn. Gõ 12/01/27, 120127 hoặc 12/1 (thiếu năm lấy theo năm chứng từ).'),
    C('soct', 'Số c.từ', 70, 'c', { pin: 1 }, 'Số chứng từ kế toán. Để trống thì hệ thống cấp số tiếp theo khi lưu. Các dòng cùng số và cùng ngày thuộc một chứng từ.'),
    C('ngayct', 'Ngày C.từ', 68, 'd', { pin: 1 }, 'Ngày hạch toán ghi sổ. Quyết định kỳ kế toán của dòng này.'),
    C('madonhang', 'Mã đơn hàng', 100, 'c', {}, 'Mã đơn hàng bán hoặc mua, để theo dõi đơn hàng và hợp đồng.'),
    C('diengiai', 'Diễn giải', 270, 't', {}, 'Nội dung nghiệp vụ của dòng. Nên ghi rõ hàng hóa, dịch vụ hoặc số hóa đơn.'),
    C('ma_ct', 'Mã C.Trình', 100, 'c', { look: 'ct' }, 'Mã công trình hoặc vụ việc để tập hợp chi phí giá thành. Dùng cho công ty xây dựng, lắp đặt.'),
    C('tkno', 'TK Nợ', 55, 'c', { look: 'acc' }, 'Tài khoản ghi Nợ. F1 để tra danh mục, chỉ nhận tài khoản chi tiết.'),
    C('madtpnno', 'ĐTPN Nợ', 89, 'c', { look: 'cp' }, 'Đối tượng bên Nợ (khách hàng, nhà cung cấp, nhân viên). Bắt buộc với TK 131, 331 và các TK theo dõi đối tượng.'),
    C('maytcpno', 'YTCP Nợ', 80, 'c', { look: 'ytcp' }, 'Yếu tố chi phí bên Nợ: phân loại chi phí theo bản chất (điện, nước, tiếp khách, khấu hao, lương...).'),
    C('maytcpco', 'YTCP Có', 80, 'c', { look: 'ytcp' }, 'Yếu tố chi phí bên Có: dùng khi kết chuyển hoặc điều chỉnh giảm chi phí.'),
    C('madmno', 'Mã DM Nhập', 90, 'c', { look: 'dm' }, 'Mã hàng hóa, vật tư nhập kho (Nợ TK 152, 156).'),
    C('tkco', 'TK Có', 55, 'c', { look: 'acc' }, 'Tài khoản ghi Có. F1 để tra danh mục, chỉ nhận tài khoản chi tiết.'),
    C('madtpnco', 'ĐTPN Có', 89, 'c', { look: 'cp' }, 'Đối tượng bên Có (khách trả tiền, nhà cung cấp được thanh toán). Bắt buộc với TK 131, 331.'),
    C('madmco', 'Mã HH Xuất', 90, 'c', { look: 'dm' }, 'Mã hàng hóa, vật tư xuất bán.'),
    C('tendm', 'Tên danh mục', 250, 't', {}, 'Tên hàng hóa, dịch vụ tương ứng với mã nhập hoặc mã xuất.'),
    C('donvi', 'ĐVT', 50, 't', {}, 'Đơn vị tính: Cái, Bộ, Thùng, Kg, Mét...'),
    C('luong', 'Số lượng', 85, 'n', {}, 'Số lượng hàng xuất hoặc nhập. Có số lượng và đơn giá thì Thành tiền tự tính.'),
    C('dgvnd', 'Đơn giá', 90, 'n', {}, 'Đơn giá chưa thuế (VND).'),
    C('ttvnd', 'Thành tiền VND', 111, 'n', { sum: 1 }, 'Số tiền ghi sổ cho cặp TK Nợ/TK Có. Tự tính = Số lượng × Đơn giá − Chiết khấu, hoặc nhập thẳng.'),
    C('pt_ck', '% CK', 45, 'p', {}, 'Tỷ lệ chiết khấu thương mại của dòng. Nhập % thì Chiết khấu tự tính.'),
    C('chietkhau', 'Chiết khấu', 90, 'n', { sum: 1 }, 'Số tiền chiết khấu giảm giá của dòng.'),
    C('pt_ck2', '%CK2', 45, 'p', {}, 'Tỷ lệ chiết khấu bổ sung cấp 2 (bán buôn, đại lý).'),
    C('chietkhau2', 'Chiết khấu 2', 90, 'n', { sum: 1 }, 'Số tiền chiết khấu cấp 2.'),
    C('hdvat', 'Loại thuế', 45, 'c', { look: 'vat' }, 'Nhóm hóa đơn thuế GTGT: V mua vào, B bán ra, 0 không chịu thuế.'),
    C('tkthue', 'TK Thuế', 45, 'c', { look: 'acc' }, 'TK thuế liên đới: 1331 cho mua vào, 33311 cho bán ra. Tự điền theo Loại thuế.'),
    C('ts_gtgt', '% TS', 40, 'c', { look: 'ts' }, 'Thuế suất GTGT: 0, 5, 8, 10, KCT (không chịu thuế), KKTT (không kê khai nộp thuế).'),
    C('thuevnd', 'Tiền thuế VND', 79, 'n', { sum: 1 }, 'Tiền thuế GTGT của dòng = Thành tiền × % TS. Khi lưu, hệ thống tự sinh thêm một dòng riêng cho TK thuế.'),
    C('ttvnd_tt', 'Tổng Tiền', 100, 'n', { ro: 1, sum: 1 }, 'Tổng thanh toán = Thành tiền + Tiền thuế. Tự tính.'),
    C('mathang', 'Mặt hàng', 300, 't', {}, 'Tên nhóm hoặc diễn giải mặt hàng dùng cho bảng kê thuế.'),
    C('makh', 'Mã KH', 100, 'c', { look: 'cp' }, 'Mã khách hàng hoặc nhà cung cấp dùng cho bảng kê thuế mua vào, bán ra.'),
    C('tenkh', 'Tên khách hàng', 300, 't', { ro: 1 }, 'Tên đối tác trên hóa đơn. Tự điền khi chọn Mã KH hoặc ĐTPN.'),
    C('ms_dn', 'Mã số thuế', 119, 'c', { ro: 1 }, 'Mã số thuế đối tác. Tự điền khi chọn đối tượng. Hóa đơn bắt buộc đối tượng có MST.'),
    C('diachi', 'Địa chỉ', 300, 't', {}, 'Địa chỉ đối tác, phục vụ in hóa đơn và chứng từ.'),
    C('diachi_ngd', 'Địa chỉ - NGD', 300, 't', {}, 'Địa chỉ người giao dịch trực tiếp.'),
    C('khachhang', 'Người giao dịch', 300, 't', {}, 'Tên người mua hàng trực tiếp hoặc nhân viên giao dịch.'),
    C('ghichu', 'Ghi chú', 300, 't', {}, 'Ghi chú nội bộ.'),
    C('tenct_sc', 'Tên công trình', 200, 't', { ro: 1 }, 'Tên công trình ứng với Mã C.Trình. Tự điền.'),
  ];
  const EXTRA = {
    fx: ['Ngoại tệ', [C('tygia', 'Tỷ giá', 70, 'n', {}, 'Tỷ giá hạch toán.'), C('dgusd', 'Đơn giá USD', 80, 'n', {}, 'Đơn giá ngoại tệ.'), C('ttusd', 'Thành tiền USD', 90, 'n', {}, 'Thành tiền ngoại tệ.'), C('thueusd', 'Thuế USD', 80, 'n', {}, 'Thuế ngoại tệ.'), C('ttusd_tt', 'Tổng tiền USD', 90, 'n', {}, 'Tổng tiền ngoại tệ.')]],
    kho: ['Kho & Giá vốn', [C('makho', 'Mã kho', 70, 'c', { look: 'kho' }, 'Kho nhập hoặc xuất của dòng. Để trống thì lấy kho đầu tiên.'), C('lo_nhap', 'Lô nhập', 80, 'c', {}, 'Số lô nhập.'), C('lo_xuat', 'Lô xuất', 80, 'c', {}, 'Số lô xuất.'), C('dgvon', 'Đơn giá vốn', 90, 'n', {}, 'Đơn giá vốn xuất kho.'), C('gtvon', 'Giá trị vốn', 100, 'n', {}, 'Giá trị vốn xuất kho.'), C('lai_gop', 'Lãi gộp', 90, 'n', { ro: 1 }, 'Lãi gộp = Doanh thu − Giá vốn. Chỉ để phân tích nhanh.')]],
    bank: ['Ngân hàng', [C('tknhno', 'TK NH Nợ', 110, 'c', {}, 'Số tài khoản ngân hàng bên Nợ.'), C('tentknhno', 'Tên TK NH Nợ', 160, 't', {}, 'Tên tài khoản ngân hàng bên Nợ.'), C('tknhco', 'TK NH Có', 110, 'c', {}, 'Số tài khoản ngân hàng bên Có.'), C('tentknhco', 'Tên TK NH Có', 160, 't', {}, 'Tên tài khoản ngân hàng bên Có.')]],
    admin: ['Quản trị chứng từ', [C('danhdau', 'Đánh dấu', 60, 'c', { ro: 1 }, 'Cờ A khi dòng được đánh dấu (F3) để xử lý hàng loạt.'), C('mauser', 'User', 90, 'c', { ro: 1 }, 'Người tạo dòng.')]],
  };
  const IND_W = 22;

  /* ---------- Lookup lists ---------- */
  const lctgRows = () => E.db().vtypes.filter((v) => v.active && (v.screen === 'grid' || v.code === 'PXK'));
  /* Defaults come from the voucher-type catalogue so editing a type there changes the entry screen. */
  const dflt = (code) => {
    const v = E.db().vtypes.find((x) => x.code === code);
    if (!v) return {};
    const o = {};
    if (v.tkno) o.tkno = v.tkno;
    if (v.tkco) o.tkco = v.tkco;
    if (['HDMV', 'HD', 'HDBR', 'HDCK'].includes(code)) { o.tkthue = v.tkthue; o.hdvat = v.tkthue === '1331' ? 'V' : 'B'; }
    return o;
  };
  const YTCP = [['DIEN', 'Tiền điện'], ['NUOC', 'Tiền nước'], ['TIEPKHACH', 'Tiếp khách'], ['KHAUHAO', 'Khấu hao'], ['LUONG', 'Tiền lương'], ['VANCHUYEN', 'Vận chuyển']];
  const VAT = [['V', 'Thuế đầu vào (mua vào)'], ['B', 'Thuế đầu ra (bán ra)'], ['0', 'Không chịu thuế']];
  const TS = [['0', '0%'], ['5', '5%'], ['8', '8%'], ['10', '10%'], ['KCT', 'Không chịu thuế'], ['KKTT', 'Không kê khai, nộp thuế']];
  const listItems = (rows, meta) => (q) => rows.filter(([c, n]) => !q || E.matches(`${c} ${n}`, q)).map(([c, n]) => ({ value: c, code: c, name: n, meta }));
  const accItems = (q) => E.db().accounts.filter((a) => a.postable && a.active && (!q || a.code.startsWith(q.trim()) || E.matches(`${a.code} ${a.name}`, q)))
    .map((a) => ({ value: a.code, code: a.code, name: a.name, meta: a.cp ? 'Theo dõi đối tượng' : '' }));
  const cpItems = (q) => E.db().cps.filter((c) => c.active && (!q || E.matches(`${c.code} ${c.name} ${c.mst}`, q)))
    .map((c) => ({ value: c.code, code: c.code, name: c.name, meta: [E.kindLabel[c.kind], c.mst && `MST ${c.mst}`].filter(Boolean).join(' · ') }));
  const ctItems = (q) => {
    const d = E.db();
    const rows = [...d.projects.filter((p) => p.active).map((p) => [p.code, p.name, `${p.kind} · ${p.status}`]), ...d.costObjects.filter((o) => o.active && !d.projects.some((p) => p.code === o.code)).map((o) => [o.code, o.name, o.kind])];
    return rows.filter(([c, n]) => !q || E.matches(`${c} ${n}`, q)).map(([c, n, meta]) => ({ value: c, code: c, name: n, meta }));
  };
  const dmItems = (q) => E.db().goods.filter((g) => g.active && (!q || E.matches(`${g.code} ${g.name}`, q))).map((g) => ({ value: g.code, code: g.code, name: g.name, meta: `${g.unit} · TK ${g.tkKho}` }));
  const khoItems = (q) => E.db().warehouses.filter((w) => w.active && (!q || E.matches(`${w.code} ${w.name}`, q))).map((w) => ({ value: w.code, code: w.code, name: w.name, meta: w.keeper }));
  const LOOK = { acc: accItems, cp: cpItems, lctg: (q) => lctgRows().filter((v) => !q || E.matches(`${v.code} ${v.name}`, q)).map((v) => ({ value: v.code, code: v.code, name: v.name, meta: '' })), ytcp: listItems(YTCP), ct: ctItems, dm: dmItems, kho: khoItems, vat: listItems(VAT), ts: listItems(TS) };

  /* ---------- Formatting & parsing ---------- */
  const shortDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');
  const fmtNum = (n) => (n ? Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '');
  const parseNum = (s) => { const n = Number(String(s ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  function parseDate(s, base) {
    const t = s.trim();
    if (!t) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = /^(\d{1,2})[/.\-\s]?(\d{1,2})(?:[/.\-\s]?(\d{2}|\d{4}))?$/.exec(t);
    if (!m) return null;
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : base.slice(0, 4);
    const v = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const dt = new Date(`${v}T00:00:00`);
    return Number.isNaN(dt.getTime()) || dt.getDate() !== Number(m[1]) ? null : v;
  }
  const cellText = (r, c) => {
    const v = r[c.k];
    if (c.kind === 'd') return shortDate(v);
    if (c.kind === 'n' || c.kind === 'p') return c.k === 'id' ? (v ? String(v) : '') : fmtNum(v);
    return v == null ? '' : String(v);
  };

  /* ---------- State ---------- */
  const ui = { guide: false, tab: 'start', extra: { fx: false, kho: false, bank: false, admin: false }, filters: {}, marks: new Set(), panel: null, active: null };
  const drafts = {};
  const DEFAULT_DATE = '2027-01-31';
  const NUMERIC = (c) => c.kind === 'n' || c.kind === 'p';
  const cols = () => [...BASE, ...Object.entries(EXTRA).filter(([k]) => ui.extra[k]).flatMap(([, v]) => v[1])];
  const colOf = (k) => cols().find((c) => c.k === k);
  const isTax = (code) => /^(1331|33311)$/.test(code);
  
  const NUM_KEYS = ['luong', 'dgvnd', 'ttvnd', 'pt_ck', 'chietkhau', 'pt_ck2', 'chietkhau2', 'thuevnd', 'ttvnd_tt', 'tygia', 'dgusd', 'ttusd', 'thueusd', 'ttusd_tt', 'dgvon', 'gtvon', 'lai_gop'];
  function blankRow(lctg, ngayct, from) {
    const r = { _id: E.uid('r') };
    [...BASE, ...Object.values(EXTRA).flatMap((v) => v[1])].forEach((c) => { r[c.k] = NUM_KEYS.includes(c.k) ? 0 : ''; });
    r.lctg = lctg; r.ngayct = ngayct;
    Object.assign(r, dflt(lctg));
    if (from) ['lctg', 'sr_hd', 'so_hd', 'ngay_hd', 'soct', 'ngayct', 'madtpnno', 'madtpnco', 'makh', 'tenkh', 'ms_dn', 'diachi', 'hdvat', 'tkthue', 'ts_gtgt', 'ma_ct', 'tenct_sc', 'madonhang'].forEach((k) => { r[k] = from[k]; });
    return r;
  }
  const blankRows = (lctg, ngayct, n, from) => Array.from({ length: n }, () => blankRow(lctg, ngayct, from));
  const draft = () => (drafts[state.companyId] = drafts[state.companyId] || { rows: blankRows('PC', DEFAULT_DATE, 6), tried: false });
  const isUsed = (r) => { const d = dflt(r.lctg); return r.ttvnd > 0 || r.thuevnd > 0 || r.luong > 0 || r.diengiai.trim() || r.tkno !== (d.tkno || '') || r.tkco !== (d.tkco || ''); };

  function calc(r, changed) {
    const gross = r.luong && r.dgvnd ? Math.round(r.luong * r.dgvnd) : 0;
    if (gross) {
      if (changed === 'pt_ck' && r.pt_ck) r.chietkhau = Math.round((gross * r.pt_ck) / 100);
      if (changed === 'pt_ck2' && r.pt_ck2) r.chietkhau2 = Math.round(((gross - r.chietkhau) * r.pt_ck2) / 100);
      if (['luong', 'dgvnd', 'pt_ck', 'chietkhau', 'pt_ck2', 'chietkhau2'].includes(changed)) r.ttvnd = gross - r.chietkhau - r.chietkhau2;
    }
    if (changed === 'hdvat') { const t = { V: '1331', B: '33311' }[r.hdvat]; if (t !== undefined) r.tkthue = t; else if (r.hdvat === '0') r.tkthue = ''; }
    if (changed !== 'thuevnd' && r.ts_gtgt !== '') r.thuevnd = Number.isFinite(Number(r.ts_gtgt)) ? Math.round((r.ttvnd * Number(r.ts_gtgt)) / 100) : 0;
    r.ttvnd_tt = r.ttvnd + r.thuevnd;
    if ((r.madmno || r.madmco) && r.dgvon) r.lai_gop = r.ttvnd - r.gtvon;
  }

  /* One input row -> main journal line + generated VAT line (+ cost line when a goods invoice sells an item). */
  function expand(r) {
    const a = E.acc(r.tkno) || {}; const b = E.acc(r.tkco) || {};
    const cp = (a.cp ? r.madtpnno : b.cp ? r.madtpnco : r.madtpnno || r.madtpnco || r.makh) || null;
    const inv = r.so_hd ? { serial: r.sr_hd, no: r.so_hd, date: r.ngay_hd } : null;
    const d = E.db(); const g = r.madmno || r.madmco ? E.goodsOf(r.madmno || r.madmco, d) : null;
    const wh = r.makho || (d.warehouses[0] ? d.warehouses[0].code : '');
    const stockSide = E.isStockAcc(r.tkno) || E.isStockAcc(r.tkco);
    const qty = g && r.luong > 0 ? r.luong : 0;
    const dim = { ct: r.ma_ct || undefined, ytcp: r.maytcpno || r.maytcpco || undefined };
    const itemDim = g && qty ? { item: g.code, qty, ...(stockSide ? { wh, lot: r.lo_nhap || r.lo_xuat || undefined } : {}) } : {};
    const amt = r.ttvnd || (r.lctg === 'PXK' && g && qty ? E.issueCost(d, { item: g.code, wh, qty, date: r.ngayct || `${state.period}-01` }) : 0);
    const lines = [{ dr: r.tkno, cr: r.tkco, amt, cp, desc: r.diengiai, inv, row: r, ...dim, ...itemDim }];
    const buyIn = r.hdvat === 'V'; const sellOut = r.hdvat === 'B';
    if ((buyIn || sellOut) && r.thuevnd > 0 && r.tkthue) {
      const ref = r.so_hd ? ` HĐ : ${r.so_hd},${shortDate(r.ngay_hd)}` : '';
      lines.push(buyIn
        ? { dr: r.tkthue, cr: r.tkco, amt: r.thuevnd, cp: r.madtpnco || cp, desc: `Thuế GTGT đầu vào${ref}`, inv, row: r, tax: true, ...dim }
        : { dr: r.tkno, cr: r.tkthue, amt: r.thuevnd, cp: r.madtpnno || cp, desc: `Thuế GTGT đầu ra${ref}`, inv, row: r, tax: true, ...dim });
    }
    if (r.lctg === 'HDBR' && g && qty && !stockSide) {
      const cost = E.issueCost(d, { item: g.code, wh, qty, date: r.ngayct || `${state.period}-01` });
      lines.push({ dr: g.tkGv || '632', cr: g.tkKho, amt: cost, cp: null, desc: `Giá vốn ${g.name}`, row: r, cogs: true, item: g.code, qty, wh, ...dim });
    }
    return lines;
  }
  const taxLinesOf = (rows) => rows.filter(isUsed).flatMap(expand).filter((l) => l.tax);

  function entryErrors(rows) {
    const errs = [];
    const used = rows.map((r, i) => ({ r, i })).filter(({ r }) => isUsed(r));
    if (!used.length) return [{ msg: 'Chưa có dòng nào để ghi sổ.' }];
    const flat = used.flatMap(({ r, i }) => expand(r).map((l) => ({ ...l, i })));
    const at = (i, k, msg) => errs.push({ row: i, k, msg: `Dòng mới ${i + 1}: ${msg}` });
    used.forEach(({ r, i }) => {
      if (!lctgRows().some((x) => x.code === r.lctg)) at(i, 'lctg', 'chọn loại chứng từ.');
      if (!r.ngayct) at(i, 'ngayct', 'nhập ngày chứng từ.');
      if (!r.diengiai.trim()) at(i, 'diengiai', 'nhập diễn giải.');
    });
    const first = flat[0];
    E.validateLines(flat.map(({ row, tax, i, ...l }) => l), { period: first.row.ngayct ? first.row.ngayct.slice(0, 7) : state.period, date: first.row.ngayct || undefined }).forEach((e) => {
      if (e.line === undefined) { errs.push(e); return; }
      const l = flat[e.line];
      const k = { dr: 'tkno', cr: 'tkco', amt: l.tax ? 'thuevnd' : 'ttvnd', cp: E.acc(l.dr) && E.acc(l.dr).cp ? 'madtpnno' : 'madtpnco', item: 'madmno', qty: 'luong', wh: 'makho', lot: 'lo_nhap' }[e.field];
      errs.push({ row: l.i, k, msg: `Dòng mới ${l.i + 1}: ${e.msg.replace(/^Dòng \d+: /, '')}` });
    });
    flat.forEach((l) => {
      if (!isTax(l.dr) && !isTax(l.cr)) return;
      [['sr_hd', 'Seri HĐ'], ['so_hd', 'Số HĐ'], ['ngay_hd', 'Ngày HĐ']].forEach(([k, n]) => { if (!l.row[k]) at(l.i, k, `có TK thuế GTGT nên bắt buộc nhập ${n}.`); });
      if (!(E.cp(l.cp) || {}).mst) at(l.i, l.row.hdvat === 'B' ? 'madtpnno' : 'madtpnco', 'hóa đơn cần đối tượng có MST.');
    });
    const seen = new Set();
    return errs.filter((e) => { const key = `${e.row}|${e.k}|${e.msg}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }

  /* ---------- Posted rows (existing journal flattened) ---------- */
  function postedRows() {
    let id = 0;
    const all = [];
    E.db().entries.forEach((e) => {
      e.lines.forEach((l) => {
        id += 1;
        if (e.source === 'smartpro_import' || E.periodOf(e.date) !== state.period) return;
        const a = E.acc(l.dr) || {};
        const c = E.cp(l.cp) || {};
        const g = l.item ? E.goodsOf(l.item) : null;
        const r = { _posted: true, _entry: e.id, id, lctg: e.type, soct: e.no, ngayct: e.date, diengiai: l.desc || e.desc, tkno: l.dr, tkco: l.cr, ttvnd: l.amt, ttvnd_tt: l.amt, sr_hd: l.inv ? l.inv.serial : '', so_hd: l.inv ? l.inv.no : '', ngay_hd: l.inv ? l.inv.date : '', makh: l.cp || '', tenkh: c.name || '', ms_dn: c.mst || '', diachi: c.address || '', mauser: e.createdBy || '', danhdau: '' };
        if (l.cp) { if (a.cp) r.madtpnno = l.cp; else r.madtpnco = l.cp; }
        if (l.ct) { r.ma_ct = l.ct; r.tenct_sc = ((E.db().projects.find((p) => p.code === l.ct) || E.db().costObjects.find((o) => o.code === l.ct)) || {}).name || ''; }
        if (l.ytcp) r.maytcpno = l.ytcp;
        if (g) { r[E.isStockAcc(l.dr) ? 'madmno' : 'madmco'] = g.code; r.tendm = g.name; r.donvi = g.unit; r.luong = l.qty || 0; r.makho = l.wh || ''; r.dgvnd = l.qty ? Math.round(l.amt / l.qty) : 0; }
        all.push(r);
      });
    });
    return all;
  }
  const passes = (r, cs) => Object.entries(ui.filters).every(([k, q]) => !q || E.matches(cellText(r, cs.find((c) => c.k === k) || { k, kind: 't' }), q));
  const visiblePosted = () => { const cs = cols(); return postedRows().filter((r) => passes(r, cs)); };
  const POSTED_CAP = 60;

  /* ---------- Rendering ---------- */
  const TOOLS = [
    ['Dữ liệu', [['save', 'check', 'Lưu', 'F10'], ['copy', 'copy', 'Copy', 'F5'], ['delrow', 'trash', 'Xóa dòng', 'Ctrl Del'], ['delvoucher', 'trash', 'Xóa 1 C.từ', ''], ['editvoucher', 'pencil', 'Sửa C.từ', 'F12']]],
    ['Lọc', [['filter-next', 'filter', 'Lọc tiếp', 'F7'], ['filter-cell', 'filter', 'Lọc 1 ô', 'Alt F7'], ['filter-clear', 'x', 'Bỏ lọc', 'Shift F1']]],
    ['Danh mục', [['add-code', 'plus', 'Thêm mã', 'Ctrl N'], ['edit-code', 'pencil', 'Sửa mã', 'F9']]],
    ['Công cụ', [['search', 'search', 'Tìm kiếm', 'F1'], ['mark', 'check', 'Đánh dấu', 'F3'], ['calc', 'calculator', 'Tính toán', 'F4'], ['goto', 'arrow-right', 'Đến cột', 'F6']]],
    ['Xem', [['print', 'file-text', 'In', ''], ['export', 'download', 'Excel', 'Alt E'], ['cols', 'layers', 'Cột', ''], ['guide', 'book-open', 'Hướng dẫn', '']]],
  ];
  const TIPS = {
    save: 'Ghi các dòng đã nhập vào sổ (Ctrl S hoặc F10)', delvoucher: 'Xóa mọi dòng nhập có cùng Số c.từ với dòng đang đứng', 'filter-next': 'Đưa con trỏ tới ô lọc của cột đang đứng', 'filter-cell': 'Lọc cột này theo giá trị ô đang đứng',
  };

  function pinLefts(cs) { let x = IND_W; const m = {}; cs.filter((c) => c.pin).forEach((c) => { m[c.k] = x; x += c.w; }); return m; }

  function renderGuide() {
    const dictionary = BASE.map((c, i) => `<div class="kt-dic" data-s="${esc(`${c.label} ${c.tip}`)}"><span class="mono faint">${i + 1}</span><b>${esc(c.label)}</b>${c.pin ? '<span class="kt-pin">cố định</span>' : ''}<span class="kt-dic-t">${esc(c.tip)}</span></div>`).join('');
    const KEYS = [
      ['Enter', 'Tab'], 'Sang ô kế tiếp. Hết dòng thì tự thêm dòng mới', ['Shift Tab'], 'Lùi một ô', ['↑', '↓'], 'Lên, xuống dòng (hoặc chọn gợi ý khi danh sách đang mở)', ['F2'], 'Sửa nội dung ô đang đứng',
      ['F1'], 'Tra danh mục (TK, đối tượng, mã công trình...). Ô khác thì tìm ở hàng lọc', ['F3'], 'Đánh dấu hoặc bỏ đánh dấu dòng', ['F4'], 'Máy tính trên ô số tiền, Enter để dán kết quả', ['F5'], 'Sao chép dòng xuống dòng mới',
      ['F6'], 'Nhảy tới một cột bất kỳ', ['F7'], 'Lọc tiếp: tới ô lọc của cột này', ['Alt F7'], 'Lọc 1 ô theo giá trị đang đứng', ['Shift F1'], 'Bỏ toàn bộ bộ lọc', ['F8'], 'Xóa các dòng nhập đã đánh dấu',
      ['Ctrl D'], 'Lấy giá trị ô phía trên', ['Ctrl Enter'], 'Chèn dòng trống bên dưới', ['Ctrl Delete'], 'Xóa dòng đang đứng', ['Ctrl S', 'F10'], 'Ghi sổ', ['Ctrl /'], 'Mở hoặc đóng hướng dẫn này',
    ];
    const keyRows = []; for (let i = 0; i < KEYS.length; i += 2) keyRows.push(`<dt>${KEYS[i].map((k) => `<kbd>${k}</kbd>`).join(' ')}</dt><dd>${esc(KEYS[i + 1])}</dd>`);
    const tabs = [['start', 'Bắt đầu'], ['cols', 'Các cột'], ['keys', 'Phím tắt']];
    return `<aside class="kt-guide" aria-label="Hướng dẫn nhập chứng từ">
      <div class="kt-guide-head">${icon('book-open')}<span class="od-fill strong">Hướng dẫn nhập chứng từ</span><button type="button" class="btn btn-ghost btn-icon" data-a="guide" aria-label="Đóng hướng dẫn">${icon('x')}</button></div>
      <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-a="gtab" data-k="${k}" aria-selected="${ui.tab === k}">${n}</button>`).join('')}</div>
      <div class="kt-guide-body">
        <div ${ui.tab === 'start' ? '' : 'hidden'}>
          <section><h2 class="en-h">Bảng này hoạt động thế nào</h2>
            <p class="en-p">Mỗi dòng là một cặp định khoản Nợ/Có với một số tiền. Một hóa đơn nhiều mặt hàng thì nhập nhiều dòng cùng Seri, Số HĐ và Số c.từ. Dòng thuế GTGT không cần nhập: điền Loại thuế và % TS, khi lưu hệ thống tự sinh dòng 1331 hoặc 33311.</p></section>
          <section><h2 class="en-h">6 bước nhập một hóa đơn</h2>
            <ol class="en-steps"><li><b>Chọn Chứng từ</b> (HD, PC, PT...). TK mặc định và Loại thuế tự nạp.</li><li><b>Điền Seri, Số, Ngày HĐ</b> và Ngày C.từ. Các dòng sau tự mang theo.</li><li><b>Điền Diễn giải, TK Nợ, TK Có, ĐTPN.</b> Gõ không dấu, F1 để tra.</li><li><b>Điền Số lượng, Đơn giá</b> hoặc nhập thẳng Thành tiền.</li><li><b>Điền % TS</b> nếu có thuế. Tiền thuế và Tổng tiền tự tính.</li><li><b>Ctrl S để ghi sổ.</b> Dòng đã ghi hiện lên phần trên của bảng.</li></ol></section>
          <section><h2 class="en-h">Thử ngay</h2><p class="en-p">Điền sẵn một hóa đơn mua vào 2 mặt hàng, thuế 8%, rồi bấm Ctrl S để xem hệ thống sinh dòng thuế.</p><button type="button" class="btn btn-outline" data-a="example" ${E.isReadonly() ? 'disabled' : ''}>${icon('sparkles')}Điền hóa đơn mẫu</button></section>
          <section><h2 class="en-h">Màu ô và dấu hiệu</h2><ul class="en-p en-list"><li><span class="kt-key kt-key-need"></span>Ô vàng: bắt buộc nhập (dòng có TK thuế thiếu Seri, Số, Ngày HĐ hoặc TK cần đối tượng).</li><li><span class="kt-key kt-key-err"></span>Ô đỏ: lỗi. Đọc nguyên nhân ở dòng hướng dẫn bên dưới bảng.</li><li><span class="kt-key kt-key-ro"></span>Ô xám: tự tính, không sửa trực tiếp.</li><li>Thanh dưới cùng: tóm tắt nhanh dòng đang đứng và số dòng.</li></ul></section>
          <section><h2 class="en-h">Lỗi hay gặp</h2><ul class="en-p en-list"><li>"TK tổng hợp": chọn tài khoản chi tiết (11211 thay vì 112).</li><li>"Bắt buộc chọn đối tượng": TK 131, 331 phải có ĐTPN.</li><li>"Cần đối tượng có MST": hóa đơn chỉ nhận đối tượng có mã số thuế.</li><li>"Kỳ đã khóa": mở khóa kỳ ở màn Chốt sổ hoặc đổi Ngày C.từ.</li></ul></section>
        </div>
        <div ${ui.tab === 'cols' ? '' : 'hidden'}>
          <div class="field"><label class="label" for="kt-dic-q">Tìm cột</label><input class="input" id="kt-dic-q" data-a-input="dic" placeholder="Gõ tên cột hoặc nội dung cần tra"></div>
          <p class="en-p" style="margin-top:8px">41 cột mặc định, 7 cột đầu cố định khi cuộn ngang. Bật thêm nhóm Ngoại tệ, Kho, Ngân hàng, Quản trị ở nút Cột.</p>
          <div class="kt-dics">${dictionary}</div>
        </div>
        <div ${ui.tab === 'keys' ? '' : 'hidden'}><dl class="en-keys">${keyRows.join('')}</dl></div>
      </div>
    </aside>`;
  }

  function postedBody(cs, lefts) {
    const rows = visiblePosted();
    const shown = rows.slice(-POSTED_CAP);
    const fresh = ui.fresh || new Set();
    return shown.map((r) => `<tr class="kt-posted${fresh.has(r._entry) ? ' is-fresh' : ''}${ui.marks.has(`p${r.id}`) ? ' is-marked' : ''}" data-p="${r.id}"><td class="kt-ind pin" style="left:0">${ui.marks.has(`p${r.id}`) ? 'A' : ''}</td>${cs.map((c) => `<td class="${NUMERIC(c) ? 'num ' : ''}${c.kind === 'c' || c.kind === 'd' ? 'mono ' : ''}${c.pin ? 'pin' : ''}${c.k === cs.filter((x) => x.pin).slice(-1)[0].k ? ' pin-last' : ''}" ${c.pin ? `style="left:${lefts[c.k]}px"` : ''} title="${esc(cellText(r, c))}">${esc(cellText(r, c))}</td>`).join('')}</tr>`).join('') + (rows.length > shown.length ? '' : '');
  }

  function draftBody(cs, lefts, errs) {
    const dr = draft();
    const lastPin = cs.filter((c) => c.pin).slice(-1)[0].k;
    const can = !E.isReadonly();
    return dr.rows.map((r, i) => {
      const hasTaxAcc = isTax(r.tkno) || isTax(r.tkco);
      const tds = cs.map((c) => {
        const e = errs.find((x) => x.row === i && x.k === c.k);
        const a = c.k === 'tkno' ? E.acc(r.tkno) : c.k === 'tkco' ? E.acc(r.tkco) : null;
        const need = !e && ((hasTaxAcc && ['sr_hd', 'so_hd', 'ngay_hd'].includes(c.k) && !r[c.k]) || (c.k === 'madtpnno' && (E.acc(r.tkno) || {}).cp && !r.madtpnno) || (c.k === 'madtpnco' && (E.acc(r.tkco) || {}).cp && !r.madtpnco));
        const cls = `${NUMERIC(c) ? 'num ' : ''}${c.pin ? 'pin' : ''}${c.k === lastPin ? ' pin-last' : ''}${c.ro ? ' is-ro' : ''}`;
        const st = c.pin ? `style="left:${lefts[c.k]}px"` : '';
        const title = e ? e.msg : a ? `${a.code} – ${a.name}` : '';
        return `<td class="${cls}" ${st}><input class="kc${c.kind === 'c' || c.kind === 'd' ? ' mono' : ''}${NUMERIC(c) ? ' num' : ''}${need ? ' need' : ''}" data-r="${i}" data-k="${c.k}" value="${esc(c.k === 'id' ? '' : cellText(r, c))}" ${title ? `title="${esc(title)}"` : ''} ${e ? 'aria-invalid="true"' : ''} aria-label="${esc(c.label)} dòng mới ${i + 1}" autocomplete="off" ${c.ro || !can ? 'readonly tabindex="-1"' : ''} ${NUMERIC(c) ? 'inputmode="decimal"' : ''}></td>`;
      }).join('');
      return `<tr class="kt-draft${ui.marks.has(r._id) ? ' is-marked' : ''}" data-d="${i}"><td class="kt-ind pin" style="left:0">${ui.marks.has(r._id) ? 'A' : `<span class="kt-new">${i + 1}</span>`}</td>${tds}</tr>`;
    }).join('');
  }

  function inspector() {
    const a = ui.active; const dr = draft();
    const r = a && a.kind === 'd' ? dr.rows[a.i] : a && a.kind === 'p' ? visiblePosted().find((x) => x.id === a.id) : null;
    if (!r) return '<span class="muted">Chọn một ô để xem tóm tắt dòng.</span>';
    const parts = [r.lctg, r.so_hd || r.soct, shortDate(r.ngayct), r.diengiai, r.tkno, r.madtpnno, r.tkco, r.madtpnco, fmtNum(r.ttvnd)].filter((x) => x !== '' && x != null);
    return parts.map((p) => `<span class="kt-chip">${esc(p)}</span>`).join('');
  }
  function stats() {
    const dr = draft(); const cs = cols();
    const posted = visiblePosted(); const total = postedRows().length;
    const drafted = dr.rows.filter(isUsed);
    const sum = posted.reduce((s, r) => s + r.ttvnd, 0) + drafted.reduce((s, r) => s + r.ttvnd, 0);
    const tax = taxLinesOf(dr.rows).reduce((s, l) => s + l.amt, 0);
    const cur = ui.active ? (ui.active.kind === 'd' ? ui.active.i : posted.length + dr.rows.length) : 0;
    const pos = ui.active ? (ui.active.kind === 'd' ? Math.min(posted.length, POSTED_CAP) + ui.active.i + 1 : Math.max(1, posted.slice(-POSTED_CAP).findIndex((x) => x.id === ui.active.id) + 1)) : 0;
    return { cs, posted, total, drafted, sum, tax, count: Math.min(posted.length, POSTED_CAP) + dr.rows.length, pos, cur };
  }

  E.views.entry = {
    flush: true,
    render(params) {
      if (params.type && !draft().rows.some(isUsed)) drafts[state.companyId] = { rows: blankRows(params.type, draft().rows[0].ngayct, 6), tried: false };
      if (params.copy) {
        const src = E.db().entries.find((x) => x.id === params.copy);
        if (src) {
          const rows = src.lines.map((l) => {
            const r = blankRow(src.type, DEFAULT_DATE);
            const a = E.acc(l.dr) || {};
            Object.assign(r, { tkno: l.dr || '', tkco: l.cr || '', ttvnd: l.amt, ttvnd_tt: l.amt, diengiai: l.desc || src.desc, [a.cp ? 'madtpnno' : 'madtpnco']: l.cp || '' });
            return r;
          });
          drafts[state.companyId] = { rows: [...rows, ...blankRows(src.type, DEFAULT_DATE, 3, rows[rows.length - 1])], tried: false };
        }
        state.route.params = {};
      }
      const dr = draft();
      const errs = dr.tried ? entryErrors(dr.rows) : [];
      const s = stats();
      const cs = s.cs; const lefts = pinLefts(cs);
      const pinned = cs.filter((c) => c.pin);
      const totalW = IND_W + cs.reduce((n, c) => n + c.w, 0);
      const can = !E.isReadonly();
      const global = errs.filter((e) => e.row === undefined);
      const co = E.company();
      return `<div class="kt">
        <div class="kt-tool" role="toolbar" aria-label="Thao tác nhanh">${TOOLS.map(([g, items]) => `<div class="kt-tg"><div class="kt-tg-btns">${items.map(([a, ic, l, k]) => `<button type="button" class="kt-tb${a === 'guide' && ui.guide ? ' is-on' : ''}" data-a="${a}" ${TIPS[a] ? `title="${esc(TIPS[a])}"` : ''} ${!can && ['save', 'copy', 'delrow', 'delvoucher', 'editvoucher', 'mark'].includes(a) ? 'disabled' : ''}>${icon(ic)}<span class="kt-tb-l">${l}</span>${k ? `<span class="kt-tb-k">${k}</span>` : ''}</button>`).join('')}</div><div class="kt-tg-name">${g}</div></div>`).join('')}
          <div class="kt-panel-host">${ui.panel === 'cols' ? `<div class="kt-pop" role="dialog" aria-label="Chọn cột hiển thị"><div class="strong" style="margin-bottom:6px">Nhóm cột mở rộng</div>${Object.entries(EXTRA).map(([k, [n, list]]) => `<label class="kt-check"><input type="checkbox" data-a-change="extra" data-k="${k}" ${ui.extra[k] ? 'checked' : ''}><span>${n}</span><span class="muted">${list.length} cột</span></label>`).join('')}<div class="help" style="margin-top:6px">41 cột chính luôn hiển thị.</div></div>` : ''}</div>
        </div>
        <div class="kt-scope">
          <span class="kt-sc"><span class="muted">Tháng</span><b class="mono">${state.period.slice(5)}</b></span><span class="kt-sc"><span class="muted">Năm</span><b class="mono">${state.period.slice(0, 4)}</b></span>
          <span class="kt-sc"><span class="muted">MST</span><b class="mono">${esc(co.mst)}</b></span><span class="kt-sc kt-sc-name od-fill"><b class="od-truncate">${esc(co.name)}</b></span>
          <span class="kt-sc"><b class="mono" id="kt-count">${s.count}</b><span class="muted">dòng</span></span><span class="kt-sc kt-sc-sum"><span class="muted">Tổng phát sinh</span><b class="num" id="kt-sum">${money(s.sum)}</b></span>
        </div>
        ${errs.length ? `<div class="banner is-danger" role="alert">${icon('circle-alert')}<span>${errs.length} lỗi cần sửa: ${esc(errs.slice(0, 2).map((x) => x.msg).join(' '))}${errs.length > 2 ? '…' : ''}</span></div>` : ''}
        ${global.length && !errs.some((e) => e.row !== undefined) ? '' : ''}
        <div class="kt-main">
          <div class="kt-grid"><div class="kt-scroll" id="kt-scroll">
            <table class="kt-table" style="width:${totalW}px" aria-label="Sổ chứng từ gốc">
              <colgroup><col style="width:${IND_W}px">${cs.map((c) => `<col style="width:${c.w}px">`).join('')}</colgroup>
              <thead>
                <tr class="kt-h"><th class="pin" style="left:0"></th>${cs.map((c) => `<th class="${c.pin ? 'pin' : ''}${c.k === pinned[pinned.length - 1].k ? ' pin-last' : ''}${NUMERIC(c) ? ' num' : ''}" ${c.pin ? `style="left:${lefts[c.k]}px"` : ''} title="${esc(c.tip)}">${esc(c.label)}</th>`).join('')}</tr>
                <tr class="kt-f"><th class="pin" style="left:0"><span class="kt-f-ic" aria-hidden="true">${icon('filter')}</span></th>${cs.map((c) => `<th class="${c.pin ? 'pin' : ''}${c.k === pinned[pinned.length - 1].k ? ' pin-last' : ''}" ${c.pin ? `style="left:${lefts[c.k]}px"` : ''}><input class="kf" data-f="${c.k}" value="${esc(ui.filters[c.k] || '')}" placeholder="a*c" aria-label="Lọc cột ${esc(c.label)}" autocomplete="off"></th>`).join('')}</tr>
              </thead>
              <tbody id="kt-posted">${postedBody(cs, lefts)}</tbody>
              <tbody id="kt-sep"><tr class="kt-sep"><td colspan="${cs.length + 1}"><div class="kt-sep-t">${icon('pencil')}Dòng nhập mới. Enter sang ô kế, hết dòng tự thêm dòng. Ctrl S để ghi sổ.</div></td></tr></tbody>
              <tbody id="kt-draft">${draftBody(cs, lefts, errs)}</tbody>
            </table>
          </div></div>
          ${ui.guide ? renderGuide() : ''}
        </div>
        <div class="kt-hint" id="kt-hint" aria-live="polite">${icon('info')}<span class="od-fill" id="kt-hint-t">Chọn một ô trong bảng để xem hướng dẫn nhập ô đó.</span></div>
        <div class="kt-status">
          <span class="kt-calc-cell mono" id="kt-sumcell" title="Tổng cột đang đứng">${money(s.tax)}</span>
          <span class="kt-nav" role="group" aria-label="Điều hướng bản ghi">
            <button type="button" data-a="nav-first" aria-label="Dòng đầu">${icon('chevron-left')}${icon('chevron-left')}</button><button type="button" data-a="nav-prev" aria-label="Dòng trước">${icon('chevron-left')}</button>
            <span class="kt-rec mono" id="kt-rec">Record ${s.pos || '–'} of ${s.count}</span>
            <button type="button" data-a="nav-next" aria-label="Dòng sau">${icon('chevron-right')}</button><button type="button" data-a="nav-last" aria-label="Dòng cuối">${icon('chevron-right')}${icon('chevron-right')}</button>
            <button type="button" data-a="add" aria-label="Thêm dòng" ${can ? '' : 'disabled'}>${icon('plus')}</button><button type="button" data-a="delrow" aria-label="Xóa dòng" ${can ? '' : 'disabled'}>${icon('circle-minus')}</button><button type="button" data-a="save" aria-label="Ghi sổ" ${can ? '' : 'disabled'}>${icon('check')}</button><button type="button" data-a="clear" aria-label="Hủy, xóa trắng" ${can ? '' : 'disabled'}>${icon('x')}</button>
          </span>
          <span class="kt-tbl muted">Tên bảng <b class="mono">KTSC</b></span>
          <span class="kt-insp od-fill" id="kt-insp">${inspector()}</span>
          <span class="kt-taxnote" id="kt-taxnote">${s.tax ? `${icon('info')}Sẽ sinh ${taxLinesOf(dr.rows).length} dòng thuế khi lưu` : ''}</span>
        </div>
        <div class="kt-float" id="kt-float" hidden></div>
      </div>`;
    },

    mount(host) {
      const dr = draft();
      const can = !E.isReadonly();
      const scroll = host.querySelector('#kt-scroll');
      const rowEl = (i) => host.querySelector(`tr[data-d="${i}"]`);
      const cell = (i, k) => host.querySelector(`input.kc[data-r="${i}"][data-k="${k}"]`);
      const editable = () => cols().filter((c) => !c.ro);
      const ensureVisible = (el) => {
        const r = el.getBoundingClientRect(); const s = scroll.getBoundingClientRect();
        const pinW = IND_W + cols().filter((c) => c.pin).reduce((n, c) => n + c.w, 0);
        if (r.left < s.left + pinW) scroll.scrollLeft -= s.left + pinW - r.left + 8;
        else if (r.right > s.right) scroll.scrollLeft += r.right - s.right + 8;
      };
      const focusCell = (i, k) => { const el = cell(i, k); if (!el) return; el.focus(); el.select && el.select(); ensureVisible(el); };
      const rr = (focus) => { const top = scroll.scrollTop; const left = scroll.scrollLeft; E.refresh(); const sc = document.getElementById('kt-scroll'); if (sc) { sc.scrollTop = top; sc.scrollLeft = left; } if (focus) { const el = document.querySelector(`input.kc[data-r="${focus[0]}"][data-k="${focus[1]}"]`); if (el) { el.focus(); el.select && el.select(); } } };
      const hint = (t, err) => { const b = document.getElementById('kt-hint'); const x = document.getElementById('kt-hint-t'); if (!x) return; b.classList.toggle('is-error', !!err); x.textContent = t; };
      const refreshStats = () => {
        const s = stats();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('kt-count', s.count); set('kt-sum', money(s.sum)); set('kt-rec', `Record ${s.pos || '–'} of ${s.count}`);
        const insp = document.getElementById('kt-insp'); if (insp) insp.innerHTML = inspector();
        const tn = document.getElementById('kt-taxnote'); if (tn) tn.innerHTML = s.tax ? `${icon('info')}Sẽ sinh ${taxLinesOf(dr.rows).length} dòng thuế khi lưu` : '';
        const a = ui.active; const c = a && colOf(a.k);
        const sc = document.getElementById('kt-sumcell');
        if (sc) sc.textContent = c && c.sum ? money(s.drafted.reduce((n, r) => n + (r[c.k] || 0), 0) + s.posted.reduce((n, r) => n + (r[c.k] || 0), 0)) : money(s.tax);
      };
      const syncRow = (i, skip) => {
        const r = dr.rows[i];
        cols().forEach((c) => { const el = cell(i, c.k); if (el && el !== skip && el !== document.activeElement) el.value = cellText(r, c); });
      };
      const cellHint = (i, k) => {
        const c = colOf(k); const r = dr.rows[i];
        const e = dr.tried ? entryErrors(dr.rows).find((x) => x.row === i && x.k === k) : null;
        if (e) { hint(e.msg, true); return; }
        const a = (k === 'tkno' || k === 'tkco') && r[k] ? E.acc(r[k]) : null;
        const extra = a ? `${a.code} – ${a.name}${a.cp ? '. Theo dõi đối tượng' : ''}${isTax(a.code) ? '. Cần Seri, Số, Ngày HĐ' : ''}. ` : (k.startsWith('madtpn') || k === 'makh') && r[k] ? `${E.cpName(r[k])}. ` : '';
        hint(`${c.label} (dòng mới ${i + 1}): ${extra}${c.tip}`);
      };
      const addRow = (from, at) => { const row = blankRow(from ? from.lctg : 'PC', from ? from.ngayct : DEFAULT_DATE, from); if (at === undefined) dr.rows.push(row); else dr.rows.splice(at, 0, row); return row; };
      const moveNext = (i, k, back) => {
        const list = editable(); const j = list.findIndex((c) => c.k === k);
        if (back) { if (j > 0) focusCell(i, list[j - 1].k); else if (i > 0) focusCell(i - 1, list[list.length - 1].k); return; }
        if (j < list.length - 1) { focusCell(i, list[j + 1].k); return; }
        if (i === dr.rows.length - 1) addRow(dr.rows[i]);
        rr([i + 1, 'diengiai']);
      };

      const applyPick = (i, k, it) => {
        const r = dr.rows[i];
        r[k] = it.code;
        if (k === 'lctg') {
          const old = dflt(r.lctg); const nu = dflt(it.code);
          ['tkno', 'tkco', 'hdvat', 'tkthue'].forEach((f) => { if (!r[f] || r[f] === old[f]) r[f] = nu[f] || ''; });
        }
        if (k === 'ma_ct') r.tenct_sc = it.name;
        if (k === 'madmno' || k === 'madmco') {
          const g = E.goodsOf(it.code);
          r.tendm = g.name; r.donvi = g.unit;
          if (!r.dgvnd) r.dgvnd = k === 'madmno' ? g.buyPrice : 0;
          if (k === 'madmno' && !r.tkno) r.tkno = g.tkKho;
          if (k === 'madmco' && r.lctg === 'PXK' && !r.tkco) r.tkco = g.tkKho;
          if (r.lctg === 'HDBR') { r.madmno = ''; r.madmco = ''; r[k] = it.code; if (!r.tkco) r.tkco = g.tkDt; }
          if (r.luong && r.dgvnd) calc(r, 'dgvnd');
        }
        if (['madtpnno', 'madtpnco', 'makh'].includes(k)) {
          const c = E.cp(it.code) || {};
          r.makh = it.code; r.tenkh = c.name || ''; r.ms_dn = c.mst || ''; if (!r.diachi) r.diachi = c.address || '';
        }
        if (k === 'hdvat' || k === 'ts_gtgt' || k === 'lctg') calc(r, k === 'lctg' ? 'hdvat' : k);
        syncRow(i); refreshStats();
        moveNext(i, k);
      };

      cols().forEach((c) => {
        if (!c.look) return;
        host.querySelectorAll(`input.kc[data-k="${c.k}"]:not([readonly])`).forEach((inp) => {
          const i = Number(inp.dataset.r);
          E.autocomplete(inp, { items: LOOK[c.look], minWidth: 340, onPick: (it) => applyPick(i, c.k, it) });
        });
      });

      host.querySelectorAll('input.kc:not([readonly])').forEach((inp) => {
        const i = Number(inp.dataset.r); const k = inp.dataset.k; const c = colOf(k); const r = dr.rows[i];
        if (c.look) { inp.addEventListener('change', () => { const v = inp.value.trim().toUpperCase() === inp.value.trim() && k !== 'tkno' ? inp.value.trim() : inp.value.trim(); r[k] = v; if (k === 'tkthue' || k === 'tkno' || k === 'tkco') { calc(r, k); syncRow(i); } if (k === 'hdvat' || k === 'ts_gtgt') { calc(r, k); syncRow(i); } if (isTax(r.tkno) || isTax(r.tkco)) rr([i, k]); refreshStats(); }); }
        else if (NUMERIC(c)) {
          inp.addEventListener('input', () => { r[k] = parseNum(inp.value); calc(r, k); syncRow(i, inp); refreshStats(); });
          inp.addEventListener('blur', () => { inp.value = cellText(r, c); });
        } else if (c.kind === 'd') {
          inp.addEventListener('change', () => {
            const v = parseDate(inp.value, r.ngayct || `${state.period}-01`);
            if (v === null) { r[k] = ''; inp.setAttribute('aria-invalid', 'true'); hint('Ngày chưa đúng. Thử dạng 12/01/27 hoặc 120127.', true); return; }
            r[k] = v; inp.removeAttribute('aria-invalid'); inp.value = shortDate(v); refreshStats();
          });
        } else inp.addEventListener('input', () => { r[k] = inp.value; if (k === 'diengiai') refreshStats(); });
      });

      /* Filter row: re-render only the posted body so typing never loses focus. */
      host.querySelectorAll('input.kf').forEach((inp) => inp.addEventListener('input', () => {
        ui.filters[inp.dataset.f] = inp.value;
        const cs = cols(); const body = document.getElementById('kt-posted');
        if (body) body.innerHTML = postedBody(cs, pinLefts(cs));
        refreshStats();
      }));

      host.addEventListener('focusin', (e) => {
        const inp = e.target.closest && e.target.closest('input.kc');
        if (!inp) return;
        const i = Number(inp.dataset.r);
        ui.active = { kind: 'd', i, k: inp.dataset.k };
        cellHint(i, inp.dataset.k); refreshStats();
      });
      host.addEventListener('click', (e) => {
        const pr = e.target.closest('tr[data-p]');
        if (pr && !e.target.closest('[data-a]')) { ui.active = { kind: 'p', id: Number(pr.dataset.p), k: 'diengiai' }; host.querySelectorAll('tr.is-cur').forEach((x) => x.classList.remove('is-cur')); pr.classList.add('is-cur'); hint('Dòng đã ghi sổ: chỉ xem. F5 để sao chép xuống dòng nhập mới, hoặc dùng Đảo ở Danh sách chứng từ để sửa.'); refreshStats(); return; }
        const t = e.target.closest('[data-a]'); if (t) act(t.dataset.a, t);
      });
      host.addEventListener('change', (e) => {
        const t = e.target.closest('[data-a-change]'); if (!t) return;
        ui.extra[t.dataset.k] = t.checked; rr(ui.active && ui.active.kind === 'd' ? [ui.active.i, ui.active.k] : null);
      });
      host.addEventListener('input', (e) => {
        if (e.target.dataset && e.target.dataset.aInput === 'dic') {
          const q = e.target.value;
          host.querySelectorAll('.kt-dic').forEach((d) => { d.hidden = !!q && !E.matches(d.dataset.s, q); });
        }
      });

      /* ----- actions ----- */
      const curRow = () => (ui.active && ui.active.kind === 'd' ? ui.active.i : -1);
      const markKey = () => { const a = ui.active; if (!a) return null; return a.kind === 'd' ? dr.rows[a.i]._id : `p${a.id}`; };
      const openFloat = (html) => { const f = document.getElementById('kt-float'); f.innerHTML = html; f.hidden = false; return f; };
      const closeFloat = () => { const f = document.getElementById('kt-float'); if (f) { f.hidden = true; f.innerHTML = ''; } const a = ui.active; if (a && a.kind === 'd') focusCell(a.i, a.k); };
      function filterCol(k) { const f = host.querySelector(`input.kf[data-f="${k}"]`); if (f) { f.focus(); f.select(); ensureVisible(f); } }
      function calcPopup() {
        const a = ui.active; if (!a || a.kind !== 'd') { E.toast('Chọn một ô số tiền trong dòng nhập mới trước.', { icon: 'calculator' }); return; }
        const f = openFloat(`<div class="kt-fl-box"><label class="label" for="kt-calc">Máy tính (dán vào ${esc(colOf(a.k).label)} dòng mới ${a.i + 1})</label><input class="input mono" id="kt-calc" placeholder="vd 1850000*8%+120000" autocomplete="off"><div class="od-row" style="margin-top:6px"><span class="mono strong od-fill" id="kt-calc-r">= 0</span><kbd>Enter</kbd><span class="muted">dán</span><kbd>Esc</kbd><span class="muted">đóng</span></div></div>`);
        const inp = f.querySelector('#kt-calc'); const out = f.querySelector('#kt-calc-r'); inp.focus();
        const val = () => { const s = inp.value.replace(/,/g, '.').replace(/(\d)%/g, '($1/100)').replace(/\s/g, ''); if (!s || !/^[\d+\-*/().]+$/.test(s)) return null; try { const v = Function(`"use strict";return (${s})`)(); return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; } catch (err) { return null; } };
        inp.addEventListener('input', () => { const v = val(); out.textContent = v === null ? '= ?' : `= ${fmtNum(v)}`; });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.stopPropagation(); closeFloat(); }
          if (e.key === 'Enter') { e.preventDefault(); const v = val(); if (v === null) { out.textContent = 'Biểu thức chưa đúng'; return; } const r = dr.rows[a.i]; const c = colOf(a.k); if (NUMERIC(c) && !c.ro) { r[a.k] = v; calc(r, a.k); } closeFloat(); syncRow(a.i); const el = cell(a.i, a.k); if (el) el.value = cellText(r, c); refreshStats(); }
        });
      }
      function gotoPopup() {
        const f = openFloat('<div class="kt-fl-box"><label class="label" for="kt-goto">Đến cột</label><input class="input" id="kt-goto" placeholder="Gõ tên cột, vd: thuế" autocomplete="off"></div>');
        const inp = f.querySelector('#kt-goto'); inp.focus();
        E.autocomplete(inp, { items: (q) => cols().filter((c) => !q || E.matches(`${c.label} ${c.k}`, q)).map((c) => ({ value: c.k, code: c.k, name: c.label, meta: c.pin ? 'Cố định' : '' })), minWidth: 300, onPick: (it) => { closeFloat(); const i = Math.max(0, curRow()); focusCell(i, it.code); } });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeFloat(); } });
      }
      function exampleFill() {
        const d = E.db();
        const sup = d.cps.find((c) => c.active && c.mst && c.kind === 'supplier') || d.cps.find((c) => c.active && c.mst);
        const base = { lctg: 'HDMV', sr_hd: '1C27TAA', so_hd: '0000457', ngay_hd: DEFAULT_DATE, soct: '', ngayct: DEFAULT_DATE, tkco: '331', madtpnco: sup ? sup.code : '', makh: sup ? sup.code : '', tenkh: sup ? sup.name : '', ms_dn: sup ? sup.mst : '', hdvat: 'V', tkthue: '1331', ts_gtgt: '8' };
        const goods = d.goods.filter((g) => g.active && g.tkKho === '1561').slice(0, 2);
        if (goods.length < 2) { E.toast('Chưa có hàng hóa để điền mẫu', { text: 'Thêm vật tư hàng hóa ở màn Hàng hóa & kho trước.', icon: 'info' }); return; }
        const rows = goods.map((g, n) => { const r = { ...blankRow('HDMV', DEFAULT_DATE), ...base, diengiai: g.name, tendm: g.name, madmno: g.code, makho: d.warehouses[0].code, tkno: g.tkKho, luong: n ? 5 : 2, dgvnd: g.buyPrice, donvi: g.unit }; calc(r, 'luong'); return r; });
        drafts[state.companyId] = { rows: [...rows, ...blankRows('HDMV', DEFAULT_DATE, 3, rows[1])], tried: false };
        rr([0, 'diengiai']);
        E.toast('Đã điền hóa đơn mẫu', { text: 'Thuế 8% đã tính. Bấm Ctrl S để ghi sổ và xem dòng thuế tự sinh.' });
      }
      const exportCols = () => cols().filter((c) => !['id'].includes(c.k));
      function exportRows() {
        const cs = exportCols();
        E.downloadCsv(`so-chung-tu-goc-${state.period}.csv`, [cs.map((c) => c.label), ...visiblePosted().map((r) => cs.map((c) => cellText(r, c)))]);
      }
      function printTable() {
        const cs = ['lctg', 'soct', 'ngayct', 'diengiai', 'tkno', 'madtpnno', 'tkco', 'madtpnco', 'ttvnd'].map((k) => colOf(k));
        return `<div class="print-head"><h2>Sổ chứng từ gốc – kỳ ${E.periodLabel(state.period)}</h2><p>${esc(E.company().name)} · MST ${esc(E.company().mst)}</p></div><div class="table-wrap"><table class="tbl"><thead><tr>${cs.map((c) => `<th${NUMERIC(c) ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${visiblePosted().map((r) => `<tr>${cs.map((c) => `<td${NUMERIC(c) ? ' class="num"' : ''}>${esc(cellText(r, c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      function act(a, t) {
        const i = curRow(); const ac = ui.active;
        if (a === 'guide') { ui.guide = !ui.guide; rr(ac && ac.kind === 'd' ? [ac.i, ac.k] : null); }
        else if (a === 'gtab') { ui.tab = t.dataset.k; rr(null); }
        else if (a === 'cols') { ui.panel = ui.panel === 'cols' ? null : 'cols'; rr(ac && ac.kind === 'd' ? [ac.i, ac.k] : null); }
        else if (a === 'save') saveEntry();
        else if (a === 'copy') {
          if (ac && ac.kind === 'p') { const src = postedRows().find((x) => x.id === ac.id); const row = { ...blankRow(src.lctg, src.ngayct), ...src, _id: E.uid('r'), id: 0, _posted: undefined, _entry: undefined, soct: '' }; delete row._posted; delete row._entry; dr.rows.splice(dr.rows.findIndex((x) => !isUsed(x)) < 0 ? dr.rows.length : dr.rows.findIndex((x) => !isUsed(x)), 0, row); rr([0, 'diengiai']); }
          else if (i >= 0) { dr.rows.splice(i + 1, 0, { ...dr.rows[i], _id: E.uid('r') }); rr([i + 1, ac.k]); }
          else E.toast('Chọn một dòng để sao chép.', { icon: 'copy' });
        }
        else if (a === 'delrow') { if (i < 0) { E.toast('Chọn một dòng nhập mới để xóa. Dòng đã ghi sổ không xóa được, hãy dùng Đảo.', { icon: 'info' }); return; } if (dr.rows.length > 1) dr.rows.splice(i, 1); else dr.rows[0] = blankRow(dr.rows[0].lctg, dr.rows[0].ngayct); rr([Math.max(0, i - 1), ac.k]); }
        else if (a === 'delvoucher') { if (i < 0) return; const so = dr.rows[i].soct; const key = so ? (r) => r.soct === so : (r) => r === dr.rows[i]; const n = dr.rows.filter(key).length; E.confirmDialog({ title: 'Xóa chứng từ đang nhập?', text: `Xóa ${n} dòng nhập cùng Số c.từ${so ? ` ${so}` : ''}. Dòng đã ghi sổ không bị ảnh hưởng.`, confirmLabel: 'Xóa', danger: true, onConfirm: () => { const keep = dr.rows.filter((r) => !key(r)); dr.rows = keep.length ? keep : blankRows(dr.rows[0].lctg, dr.rows[0].ngayct, 3); rr([0, 'diengiai']); } }); }
        else if (a === 'editvoucher') { if (ac && ac.kind === 'p') E.go('vouchers'); else E.toast('F12 mở chứng từ đã ghi sổ trong Danh sách chứng từ để xem hoặc đảo. Chọn một dòng đã ghi sổ trước.', { icon: 'pencil' }); }
        else if (a === 'filter-next') filterCol(ac ? ac.k : 'diengiai');
        else if (a === 'search') { if (ac && colOf(ac.k).look && i >= 0) { const el = cell(i, ac.k); el.focus(); el.dispatchEvent(new Event('input')); } else filterCol(ac ? ac.k : 'diengiai'); }
        else if (a === 'filter-cell') { if (!ac) return; const r = ac.kind === 'd' ? dr.rows[ac.i] : postedRows().find((x) => x.id === ac.id); ui.filters[ac.k] = cellText(r, colOf(ac.k)); rr(ac.kind === 'd' ? [ac.i, ac.k] : null); }
        else if (a === 'filter-clear') { ui.filters = {}; rr(ac && ac.kind === 'd' ? [ac.i, ac.k] : null); }
        else if (a === 'mark') { const k = markKey(); if (!k) return; if (ui.marks.has(k)) ui.marks.delete(k); else ui.marks.add(k); rr(ac.kind === 'd' ? [ac.i, ac.k] : null); }
        else if (a === 'calc') calcPopup();
        else if (a === 'goto') gotoPopup();
        else if (a === 'add-code') E.go(ac && colOf(ac.k) && colOf(ac.k).look === 'acc' ? 'accounts' : 'cps');
        else if (a === 'edit-code') E.toast('F9 sửa mã đang đứng', { text: 'Mở danh mục tương ứng ở Hệ thống tài khoản hoặc Đối tượng để sửa tên, thuộc tính.', icon: 'pencil' });
        else if (a === 'print') E.printHtml(`Sổ chứng từ gốc ${E.periodLabel(state.period)}`, printTable());
        else if (a === 'export') exportRows();
        else if (a === 'example') exampleFill();
        else if (a === 'add') { addRow(dr.rows[dr.rows.length - 1]); rr([dr.rows.length - 1, 'diengiai']); }
        else if (a === 'clear') { drafts[state.companyId] = { rows: blankRows(dr.rows[0].lctg, dr.rows[0].ngayct, 6), tried: false }; rr([0, 'diengiai']); }
        else if (a.startsWith('nav-')) {
          const posted = host.querySelectorAll('tr[data-p]'); const all = [...posted, ...host.querySelectorAll('tr[data-d]')];
          let idx = ac ? (ac.kind === 'd' ? posted.length + ac.i : [...posted].findIndex((x) => Number(x.dataset.p) === ac.id)) : -1;
          idx = a === 'nav-first' ? 0 : a === 'nav-last' ? all.length - 1 : idx + (a === 'nav-next' ? 1 : -1);
          const tr = all[Math.max(0, Math.min(all.length - 1, idx))];
          if (!tr) return;
          if (tr.dataset.d !== undefined) focusCell(Number(tr.dataset.d), ac ? ac.k : 'diengiai'); else { tr.scrollIntoView({ block: 'center' }); tr.click(); }
        }
      }

      host.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        const f = e.target.closest && e.target.closest('input.kf');
        if (f) { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); const a = ui.active; if (a && a.kind === 'd') focusCell(a.i, a.k); else focusCell(0, 'diengiai'); } if (e.key === 'Escape') { f.value = ''; ui.filters[f.dataset.f] = ''; f.dispatchEvent(new Event('input')); } return; }
        const inp = e.target.closest && e.target.closest('input.kc'); if (!inp || e.defaultPrevented) return;
        const i = Number(inp.dataset.r); const k = inp.dataset.k; const c = colOf(k); const r = dr.rows[i];
        if (e.key === 'F1' && e.shiftKey) { e.preventDefault(); act('filter-clear'); return; }
        const FN = { F1: 'search', F3: 'mark', F4: 'calc', F5: 'copy', F6: 'goto', F7: e.altKey ? 'filter-cell' : 'filter-next', F9: 'edit-code', F12: 'editvoucher' };
        if (FN[e.key]) { e.preventDefault(); act(FN[e.key]); return; }
        if (e.key === 'F8') { e.preventDefault(); const n = dr.rows.filter((x) => ui.marks.has(x._id)).length; if (!n) { E.toast('Chưa có dòng nhập nào được đánh dấu (F3).', { icon: 'info' }); return; } dr.rows = dr.rows.filter((x) => !ui.marks.has(x._id)); if (!dr.rows.length) dr.rows = blankRows(r.lctg, r.ngayct, 3); ui.marks.clear(); rr([0, 'diengiai']); E.toast(`Đã xóa ${n} dòng đánh dấu`); return; }
        if (e.key === 'F2') { e.preventDefault(); inp.setSelectionRange(inp.value.length, inp.value.length); return; }
        if (e.key === 'Enter' && mod) { e.preventDefault(); const row = blankRow(r.lctg, r.ngayct, r); dr.rows.splice(i + 1, 0, row); rr([i + 1, 'diengiai']); return; }
        if (e.key === 'Delete' && mod) { e.preventDefault(); act('delrow'); return; }
        if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (i > 0 && !c.ro) { r[k] = dr.rows[i - 1][k]; if (NUMERIC(c)) calc(r, k); syncRow(i); inp.value = cellText(r, c); refreshStats(); } return; }
        if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); act('add-code'); return; }
        if (e.key === 'Enter' || (e.key === 'Tab' && !e.altKey && !mod)) { e.preventDefault(); if (c.kind === 'd') inp.dispatchEvent(new Event('change')); moveNext(i, k, e.key === 'Tab' && e.shiftKey); return; }
        if (e.key === 'ArrowDown' && i < dr.rows.length - 1) { e.preventDefault(); focusCell(i + 1, k); }
        if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); focusCell(i - 1, k); }
      });

      if (can && (!document.activeElement || document.activeElement === document.body)) {
        const a = ui.active; const i = a && a.kind === 'd' && dr.rows[a.i] ? a.i : dr.rows.findIndex((x) => !isUsed(x));
        const el = cell(Math.max(0, i), 'diengiai'); if (el) el.focus();
      }
    },

    onKey(e) {
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && e.key.toLowerCase() === 's') || e.key === 'F10') { e.preventDefault(); saveEntry(); }
      if (mod && e.key === '/') { e.preventDefault(); ui.guide = !ui.guide; E.refresh(); }
      if (e.key === 'Escape' && ui.panel) { ui.panel = null; E.refresh(); }
    },
  };

  function saveEntry() {
    if (E.isReadonly()) return;
    const dr = draft();
    dr.tried = true;
    const errs = entryErrors(dr.rows);
    if (errs.length) {
      E.refresh();
      const first = errs.find((x) => x.row !== undefined);
      const el = first ? document.querySelector(`input.kc[data-r="${first.row}"][data-k="${first.k}"]`) : null;
      if (el) { el.focus(); el.select && el.select(); }
      return;
    }
    const groups = new Map();
    dr.rows.filter(isUsed).forEach((r) => { const key = `${r.lctg}|${r.soct}|${r.ngayct}`; groups.set(key, [...(groups.get(key) || []), r]); });
    const last = dr.rows[dr.rows.length - 1];
    const results = [];
    groups.forEach((rows) => {
      const lines = rows.flatMap(expand).map(({ row, tax, cogs, ...line }) => line);
      const head = rows[0];
      const inv = rows.find((r) => r.so_hd);
      const en = E.postEntry({ type: head.lctg, date: head.ngayct, desc: head.diengiai + (inv ? ` – HĐ ${inv.so_hd}` : ''), lines, source: 'manual', cp: head.madtpnno || head.madtpnco || null });
      if (head.soct) en.no = head.soct;
      results.push(en);
    });
    ui.fresh = new Set(results.map((en) => en.id));
    drafts[state.companyId] = { rows: blankRows(last.lctg, last.ngayct, 6), tried: false };
    E.refresh({});
    E.refreshChrome();
    const n = results.reduce((s, en) => s + en.lines.length, 0);
    E.toast(`Đã ghi ${results.length} chứng từ`, { text: `${results.map((en) => en.no).join(', ')} · ${n} dòng, gồm các dòng thuế tự sinh.`, icon: 'check' });
    const el = document.querySelector('input.kc[data-r="0"][data-k="diengiai"]'); if (el) el.focus();
    const sc = document.getElementById('kt-posted'); if (sc) sc.lastElementChild && sc.lastElementChild.scrollIntoView({ block: 'nearest' });
  }
})(window.EYN);
