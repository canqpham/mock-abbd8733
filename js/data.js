/* Demo data + ledger engine. Every view derives its numbers from this committed state. */
(function (E) {
  const { uid } = E;
  const r0 = Math.round;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const daysIn = (p) => new Date(Number(p.slice(0, 4)), Number(p.slice(5, 7)), 0).getDate();
  const lastDay = (p) => `${p}-${String(daysIn(p)).padStart(2, '0')}`;

  /* ---------- Chart of accounts: base + per-regime additions (built per company in seed) ---------- */
  const ACCOUNTS = [
    ['111', 'Tiền mặt', 'D'], ['1111', 'Tiền Việt Nam', 'D'],
    ['112', 'Tiền gửi ngân hàng', 'D'], ['1121', 'Tiền gửi VND', 'D'],
    ['11211', 'TGNH Vietcombank – 0071000123456', 'D'], ['11212', 'TGNH Techcombank – 19036688990011', 'D'],
    ['131', 'Phải thu của khách hàng', 'B', true],
    ['133', 'Thuế GTGT được khấu trừ', 'D'], ['1331', 'Thuế GTGT được khấu trừ của HHDV', 'D'],
    ['138', 'Phải thu khác', 'D'], ['1388', 'Phải thu khác', 'D', true],
    ['141', 'Tạm ứng', 'D', true],
    ['152', 'Nguyên liệu, vật liệu', 'D'], ['153', 'Công cụ, dụng cụ', 'D'],
    ['154', 'Chi phí SXKD dở dang', 'D'], ['155', 'Thành phẩm', 'D'],
    ['156', 'Hàng hóa', 'D'], ['1561', 'Giá mua hàng hóa', 'D'],
    ['211', 'Tài sản cố định', 'D'], ['2111', 'TSCĐ hữu hình', 'D'],
    ['214', 'Hao mòn TSCĐ', 'C'], ['2141', 'Hao mòn TSCĐ hữu hình', 'C'],
    ['242', 'Chi phí trả trước', 'D'],
    ['331', 'Phải trả cho người bán', 'B', true],
    ['333', 'Thuế và các khoản phải nộp Nhà nước', 'C'], ['3331', 'Thuế GTGT phải nộp', 'C'], ['33311', 'Thuế GTGT đầu ra', 'C'],
    ['3334', 'Thuế thu nhập doanh nghiệp', 'C'], ['3335', 'Thuế thu nhập cá nhân', 'C'],
    ['334', 'Phải trả người lao động', 'C'],
    ['338', 'Phải trả, phải nộp khác', 'C'], ['3382', 'Kinh phí công đoàn', 'C'], ['3383', 'Bảo hiểm xã hội', 'C'],
    ['3384', 'Bảo hiểm y tế', 'C'], ['3388', 'Phải trả, phải nộp khác', 'C', true],
    ['411', 'Vốn chủ sở hữu', 'C'], ['4111', 'Vốn góp của chủ sở hữu', 'C'],
    ['421', 'Lợi nhuận sau thuế chưa phân phối', 'C'], ['4211', 'LNST chưa phân phối năm trước', 'C'], ['4212', 'LNST chưa phân phối năm nay', 'C'],
    ['511', 'Doanh thu bán hàng và cung cấp dịch vụ', 'C'], ['5111', 'Doanh thu bán hàng hóa', 'C'], ['5112', 'Doanh thu bán thành phẩm', 'C'], ['5113', 'Doanh thu cung cấp dịch vụ', 'C'],
    ['515', 'Doanh thu hoạt động tài chính', 'C'], ['521', 'Các khoản giảm trừ doanh thu', 'D'],
    ['621', 'Chi phí nguyên liệu, vật liệu trực tiếp', 'D'], ['622', 'Chi phí nhân công trực tiếp', 'D'],
    ['623', 'Chi phí sử dụng máy thi công', 'D'], ['627', 'Chi phí sản xuất chung', 'D'],
    ['632', 'Giá vốn hàng bán', 'D'], ['635', 'Chi phí tài chính', 'D'],
    ['642', 'Chi phí quản lý kinh doanh', 'D'], ['6421', 'Chi phí bán hàng', 'D'], ['6422', 'Chi phí quản lý doanh nghiệp', 'D'],
    ['711', 'Thu nhập khác', 'C'], ['811', 'Chi phí khác', 'D'], ['821', 'Chi phí thuế TNDN', 'D'],
    ['911', 'Xác định kết quả kinh doanh', 'B'],
  ];
  const REGIME_EXTRA = {
    TT133: [['3385', 'Bảo hiểm thất nghiệp', 'C']],
    TT99: [['3389', 'Bảo hiểm thất nghiệp', 'C'], ['5211', 'Chiết khấu thương mại', 'D'], ['5212', 'Giảm giá hàng bán', 'D'], ['5213', 'Hàng bán bị trả lại', 'D'], ['8211', 'Chi phí thuế TNDN hiện hành', 'D'], ['8212', 'Chi phí thuế TNDN hoãn lại', 'D']],
  };
  /* One table instead of regime ifs scattered in code. */
  const COMMON_MAP = { wip: '154', fg: '155', cogs: '632', goods: '1561', elements: ['621', '622', '623', '627'], bhxh: '3383', bhyt: '3384', kpcd: '3382', pit: '3335', salary: '334', vatIn: '1331', vatOut: '33311', vatPay: '3331' };
  const REGIME_MAP = {
    TT133: { ...COMMON_MAP, revDeduct: ['521'], discount: '521', returnRev: '5111', cit: '821', bhtn: '3385', label: 'Thông tư 133' },
    TT99: { ...COMMON_MAP, revDeduct: ['5211', '5212', '5213'], discount: '5211', returnRev: '5213', cit: '8211', bhtn: '3389', label: 'Thông tư 99' },
  };

  /* Employees are ĐTPN of kind "employee"; NV001/NV002 always exist as counterparties (tạm ứng công tác phí). */
  const EMPLOYEES = [
    { code: 'NV001', name: 'Nguyễn Văn Hùng', dept: 'Phòng Kỹ thuật', position: 'Chỉ huy trưởng', mst: '8012345601', deps: 2, base: 20000000, bhxh: 20000000, pc: [3000000, 1000000, 730000, 500000], contract: ['Không xác định thời hạn', '2021-03-01'], ins: true, ctIdx: -1 },
    { code: 'NV002', name: 'Lê Thị Mai', dept: 'Phòng Kế toán', position: 'Kế toán trưởng', mst: '8012345602', deps: 1, base: 18000000, bhxh: 18000000, pc: [2000000, 500000, 730000, 0], contract: ['Không xác định thời hạn', '2020-08-15'], ins: true, ctIdx: -1 },
    { code: 'NV003', name: 'Trần Đức Anh', dept: 'Ban giám đốc', position: 'Giám đốc', mst: '8012345603', deps: 2, base: 35000000, bhxh: 35000000, pc: [5000000, 0, 730000, 0], contract: ['Không xác định thời hạn', '2019-01-02'], ins: true, ctIdx: -1 },
    { code: 'NV004', name: 'Phạm Thu Hà', dept: 'Kinh doanh', position: 'Trưởng phòng kinh doanh', mst: '8012345604', deps: 0, base: 15000000, bhxh: 15000000, pc: [1500000, 0, 730000, 0], contract: ['Xác định thời hạn 36 tháng', '2023-06-01'], ins: true, ctIdx: -1 },
    { code: 'NV005', name: 'Đỗ Văn Long', dept: 'Công trường', position: 'Thợ bậc cao', mst: '8012345605', deps: 1, base: 11000000, bhxh: 11000000, pc: [0, 0, 730000, 500000], contract: ['Xác định thời hạn 12 tháng', '2026-04-01'], ins: true, ctIdx: 0 },
    { code: 'NV006', name: 'Vũ Minh Quân', dept: 'Công trường', position: 'Thợ', mst: '8012345606', deps: 0, base: 9500000, bhxh: 9500000, pc: [0, 0, 730000, 0], contract: ['Xác định thời hạn 12 tháng', '2026-07-01'], ins: true, ctIdx: 1 },
    { code: 'NV007', name: 'Hoàng Thị Lan', dept: 'Kho', position: 'Thủ kho', mst: '8012345607', deps: 0, base: 9000000, bhxh: 9000000, pc: [0, 500000, 730000, 0], contract: ['Xác định thời hạn 24 tháng', '2025-02-01'], ins: true, ctIdx: -1 },
    { code: 'NV008', name: 'Bùi Văn Sơn', dept: 'Công trường', position: 'Lái máy', mst: '8012345608', deps: 2, base: 12000000, bhxh: 12000000, pc: [0, 0, 730000, 800000], contract: ['Không xác định thời hạn', '2022-05-10'], ins: true, ctIdx: 2 },
    { code: 'NV009', name: 'Ngô Thị Hạnh', dept: 'Công trường', position: 'Thợ (thử việc)', mst: '', deps: 0, base: 8000000, bhxh: 0, pc: [0, 0, 730000, 0], contract: ['Thử việc', '2027-01-04'], ins: false, ctIdx: 0 },
    { code: 'NV010', name: 'Lý Quốc Khánh', dept: 'Kinh doanh', position: 'Giám đốc kinh doanh', mst: '8012345610', deps: 1, base: 80000000, bhxh: 80000000, pc: [10000000, 0, 730000, 0], contract: ['Không xác định thời hạn', '2020-01-06'], ins: true, ctIdx: -1 },
  ];
  /* Jan 2027 attendance variations by employee index; everyone else works Mon–Sat. */
  const SHEET_PATCH = {
    0: { 18: 'P', 19: 'P' }, 1: { 14: 'X+2', 21: 'X+2' }, 3: { 12: 'O', 13: 'O', 14: 'O' },
    4: { 9: 'N', 20: 'K' }, 5: { 15: 'X+3' }, 7: { 25: 'P', 28: 'X+2' },
  };
  const HOLIDAYS = [
    ['2027-01-01', 'Tết Dương lịch'], ['2027-02-05', 'Nghỉ Tết Âm lịch (dự kiến)'], ['2027-02-06', 'Mùng 1 Tết Đinh Mùi'], ['2027-02-07', 'Mùng 2 Tết'], ['2027-02-08', 'Mùng 3 Tết'], ['2027-02-09', 'Nghỉ Tết Âm lịch (dự kiến)'],
    ['2027-04-16', 'Giỗ Tổ Hùng Vương (10/3 ÂL, dự kiến)'], ['2027-04-30', 'Ngày Giải phóng miền Nam'], ['2027-05-01', 'Quốc tế Lao động'], ['2027-09-02', 'Quốc khánh'],
  ];
  const TAX_BRACKETS = [
    { from: 0, to: 5000000, rate: 5 }, { from: 5000000, to: 10000000, rate: 10 }, { from: 10000000, to: 18000000, rate: 15 },
    { from: 18000000, to: 32000000, rate: 20 }, { from: 32000000, to: 52000000, rate: 25 }, { from: 52000000, to: 80000000, rate: 30 },
    { from: 80000000, to: null, rate: 35 },
  ];
  const PAY_PARAMS = {
    year: 2027, luongCoSo: 2340000, luongCoSoTu: '01/07/2024', tranBhxh: 46800000, tranBhtn: 106200000, tranTu: '01/01/2027',
    nldBhxh: 8, nldBhyt: 1.5, nldBhtn: 1, ctyBhxh: 17.5, ctyBhyt: 3, ctyBhtn: 1, kpcd: 2,
    giamTruBanThan: 11000000, giamTruPhuThuoc: 4400000, ngayCongChuan: 26, gioMotNgay: 8, otHeSo: 150,
  };

  const CPS = [
    ['KH0001', 'Công ty CP Đầu tư Bất động sản Sông Hồng', 'customer', '0105678912', 'Số 18 Láng Hạ, Đống Đa, Hà Nội'],
    ['KH0002', 'Ban Quản lý dự án Đầu tư xây dựng quận Cầu Giấy', 'customer', '0106543210', 'Số 36 Cầu Giấy, Hà Nội'],
    ['KH0003', 'Công ty TNHH Kiến trúc Nhà Việt', 'customer', '0109876543', '112 Trần Duy Hưng, Cầu Giấy, Hà Nội'],
    ['NCC0001', 'Công ty TNHH Thép Tân Phát', 'supplier', '0101987654', 'KCN Phố Nối A, Hưng Yên'],
    ['NCC0002', 'Công ty CP Xi măng Bắc Sơn', 'supplier', '4600345678', 'Xã Quang Sơn, Đồng Hỷ, Thái Nguyên'],
    ['NCC0003', 'Công ty CP Vật liệu Xây dựng Đông Á', 'supplier', '0102345671', '25 Nguyễn Văn Linh, Long Biên, Hà Nội'],
    ['NCC0004', 'Công ty TNHH Cơ giới Trường Sơn', 'supplier', '0108765432', 'Km 12 Đại lộ Thăng Long, Hà Nội'],
    ['NCC0005', 'Công ty TNHH Viễn thông Kết Nối', 'supplier', '0104567893', '8 Phạm Hùng, Nam Từ Liêm, Hà Nội'],
    ['NCC0006', 'Công ty TNHH Văn phòng phẩm Hồng Hà Mới', 'supplier', '0100112233', '25 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội'],
    ['NCC0007', 'Meta Platforms Ireland Limited', 'supplier', '', 'Dublin, Ireland (nhà cung cấp nước ngoài)'],
    ['NCC0008', 'Công ty TNHH Dịch vụ Tòa nhà Lạc Hồng', 'supplier', '0107788990', '72 Nguyễn Trãi, Thanh Xuân, Hà Nội'],
    ['NCC0009', 'Công ty CP Dịch vụ Ăn uống Phố Xanh', 'supplier', '0105544332', '15 Hàng Bài, Hoàn Kiếm, Hà Nội'],
    ['NCC0010', 'Công ty CP Nguyên liệu Thực phẩm Việt Hưng', 'supplier', '0103456789', 'KCN Quế Võ, Bắc Ninh'],
    ['CN0001', 'Ông Trần Quốc Bảo', 'other', '001078012345', 'Cho thuê văn phòng tầng 3, 72 Nguyễn Trãi'],
  ];

  const COMPANIES = [
    { id: 'c1', name: 'Công ty TNHH Xây dựng Hoàng Long', mst: '0108123456', regime: 'TT133', industry: 'Xây dựng', owner: 'Phạm Quang Cang', factor: 1 },
    { id: 'c2', name: 'Công ty TNHH Thương mại Minh Phát', mst: '0107234561', regime: 'TT133', industry: 'Thương mại', owner: 'Lê Thị Mai', factor: 0.62 },
    { id: 'c3', name: 'Công ty CP Vận tải Đại Việt', mst: '0106345672', regime: 'TT99', industry: 'Vận tải', owner: 'Phạm Quang Cang', factor: 0.8, lockedAll: true },
    { id: 'c4', name: 'Công ty TNHH Dịch vụ An Khang', mst: '0109456783', regime: 'TT133', industry: 'Dịch vụ', owner: 'Đỗ Minh Tuấn', factor: 0.35 },
    { id: 'c5', name: 'Công ty TNHH Thực phẩm Phú Thịnh', mst: '0105567894', regime: 'TT133', industry: 'Sản xuất', owner: 'Lê Thị Mai', factor: 1.4 },
    { id: 'c6', name: 'Công ty TNHH Giải pháp Số Thành Công', mst: '0108678905', regime: 'TT133', industry: 'Phần mềm', owner: 'Đỗ Minh Tuấn', factor: 0.48 },
    { id: 'c7', name: 'Công ty TNHH Nội thất Gia Bảo', mst: '0104789016', regime: 'TT133', industry: 'Thương mại', owner: 'Phạm Quang Cang', factor: 0.55 },
    { id: 'c8', name: 'Công ty CP Du lịch Sen Vàng', mst: '0103890127', regime: 'TT133', industry: 'Du lịch', owner: 'Lê Thị Mai', factor: 0.4, readonly: true },
    { id: 'c9', name: 'Công ty TNHH Cơ khí Tiến Đạt', mst: '0110901238', regime: 'TT99', industry: 'Sản xuất', owner: 'Đỗ Minh Tuấn', factor: 0.9 },
    { id: 'c10', name: 'Công ty TNHH Giáo dục Ánh Dương', mst: '0111012349', regime: 'TT133', industry: 'Giáo dục', owner: 'Phạm Quang Cang', factor: 0.3, noPayroll: true },
  ];
  const STOCK_INDUSTRIES = ['Thương mại', 'Sản xuất', 'Xây dựng'];
  const COSTING_INDUSTRIES = ['Sản xuất', 'Xây dựng'];
  const hasModule = (c, mod) => (mod === 'stock' ? STOCK_INDUSTRIES : mod === 'costing' ? COSTING_INDUSTRIES : []).includes(c.industry);

  /* ---------- Goods catalogues (VTHH). price = opening unit cost, buy = Jan purchase price ---------- */
  const TRADE_GOODS = [
    { code: 'HH001', name: 'Thép tấm SS400 dày 10mm', group: 'Thép', unit: 'tấn', units: [['kg', 1000]], tkKho: '1561', vat: 8, method: 'BQGQ', lot: false, price: 22800000, qty: 12 },
    { code: 'HH002', name: 'Xi măng PCB40 bao 50kg', group: 'Vật liệu xây dựng', unit: 'tấn', units: [['bao', 20]], tkKho: '1561', vat: 8, method: 'BQDD', lot: false, price: 1550000, qty: 80 },
    { code: 'HH003', name: 'Gạch ốp lát 60x60 men bóng', group: 'Vật liệu hoàn thiện', unit: 'm²', units: [['thùng', 0.6944]], tkKho: '1561', vat: 8, method: 'FIFO', lot: false, price: 108000, qty: 900 },
    { code: 'HH004', name: 'Thép hộp mạ kẽm 50x100x1.8', group: 'Thép', unit: 'tấn', units: [['cây 6m', 20.7]], tkKho: '1561', vat: 8, method: 'BQGQ', lot: false, price: 25200000, qty: 4 },
    { code: 'HH005', name: 'Keo dán gạch Weber 25kg', group: 'Vật liệu hoàn thiện', unit: 'bao', units: [['pallet', 0.0179]], tkKho: '1561', vat: 8, method: 'BQDD', lot: true, price: 68000, qty: 400 },
  ];
  const MAN_GOODS = {
    c5: [
      { code: 'NL001', name: 'Bột mì số 11', group: 'Nguyên liệu', unit: 'kg', units: [['bao 25kg', 0.04]], tkKho: '152', vat: 8, method: 'BQGQ', lot: true, price: 14500, qty: 8000 },
      { code: 'NL002', name: 'Đường kính trắng', group: 'Nguyên liệu', unit: 'kg', units: [], tkKho: '152', vat: 8, method: 'BQDD', lot: true, price: 21000, qty: 5000 },
      { code: 'NL003', name: 'Bơ thực vật', group: 'Nguyên liệu', unit: 'kg', units: [['thùng 10kg', 0.1]], tkKho: '152', vat: 8, method: 'FIFO', lot: true, price: 65000, qty: 1200 },
      { code: 'BB001', name: 'Hộp thiếc đựng bánh 500g', group: 'Bao bì', unit: 'cái', units: [], tkKho: '153', vat: 10, method: 'BQDD', lot: false, price: 6500, qty: 6000 },
      { code: 'TP001', name: 'Bánh quy bơ hộp 500g', group: 'Thành phẩm', unit: 'hộp', units: [['thùng 24 hộp', 0.0417]], tkKho: '155', tkDt: '5112', vat: 8, method: 'BQGQ', lot: true, price: 48000, qty: 2000 },
      { code: 'TP002', name: 'Mứt dẻo túi 250g', group: 'Thành phẩm', unit: 'túi', units: [], tkKho: '155', tkDt: '5112', vat: 8, method: 'BQGQ', lot: true, price: 22000, qty: 1500 },
    ],
    c9: [
      { code: 'NL101', name: 'Thép tấm cán nóng 8mm', group: 'Nguyên liệu', unit: 'tấn', units: [['kg', 1000]], tkKho: '152', vat: 8, method: 'BQGQ', lot: false, price: 17500000, qty: 14 },
      { code: 'NL102', name: 'Que hàn 3.2mm', group: 'Nguyên liệu', unit: 'kg', units: [['hộp 5kg', 0.2]], tkKho: '152', vat: 8, method: 'BQDD', lot: false, price: 38000, qty: 800 },
      { code: 'NL103', name: 'Sơn epoxy chống gỉ', group: 'Nguyên liệu', unit: 'lít', units: [['thùng 18 lít', 0.0556]], tkKho: '152', vat: 8, method: 'FIFO', lot: false, price: 95000, qty: 300 },
      { code: 'TP101', name: 'Khung thép nhà xưởng', group: 'Thành phẩm', unit: 'bộ', units: [], tkKho: '155', tkDt: '5112', vat: 8, method: 'BQGQ', lot: false, price: 26500000, qty: 3 },
      { code: 'TP102', name: 'Giàn giáo thép', group: 'Thành phẩm', unit: 'bộ', units: [], tkKho: '155', tkDt: '5112', vat: 8, method: 'BQGQ', lot: false, price: 1850000, qty: 40 },
    ],
  };
  const COST_PRODUCTS = {
    c5: [['SP-BQ01', 'Bánh quy bơ hộp 500g', 'hộp', 'TP001', 12000, 1500, 60], ['SP-BQ02', 'Mứt dẻo túi 250g', 'túi', 'TP002', 8000, 1000, 50]],
    c9: [['SP-CK01', 'Khung thép nhà xưởng', 'bộ', 'TP101', 40, 6, 55], ['SP-CK02', 'Giàn giáo thép', 'bộ', 'TP102', 120, 20, 40]],
  };
  const PROJECTS = [
    ['CT-HL01', 'Sông Hồng Residence', 'Công trình', 'KH0001', 2400000000, '2026-06-01', '2027-09-30', 'Đang thực hiện', 'HĐ-SH-2026/01', 'm²', 1200, 800, 60],
    ['CT-HL02', 'Hạng mục cảnh quan Cầu Giấy', 'Công trình', 'KH0002', 1100000000, '2026-09-01', '2027-06-30', 'Đang thực hiện', 'HĐ-CG-2026/07', 'm²', 600, 300, 50],
    ['CT-HL03', 'Nội thất văn phòng Nhà Việt', 'Hợp đồng', 'KH0003', 640000000, '2026-12-01', '2027-03-31', 'Đang thực hiện', 'HĐ-NV-2026/12', 'm²', 350, 150, 40],
  ];

  /* ---------- Voucher types (KTLCTG). Flags follow smart-pro-appendix-ui-config §4T unless noted. ---------- */
  const VT = (code, name, group, tkno, tkco, tkthue, vthh, xuat, lo, ts, screen, note = '') => ({ code, name, group, tkno, tkco, tkthue, coVthh: vthh, coXuatKho: xuat, coLoNhap: lo, coTsChiTiet: ts, screen, note, sys: true, active: true });
  const VTYPES = [
    VT('PT', 'Phiếu thu', 'Thu chi', '1111', '', '33311', false, false, false, false, 'grid'),
    VT('PC', 'Phiếu chi', 'Thu chi', '', '1111', '1331', false, false, false, true, 'grid'),
    VT('TNH', 'Thu ngân hàng', 'Thu chi', '11211', '', '', false, false, false, false, 'grid'),
    VT('CNH', 'Chi ngân hàng', 'Thu chi', '', '11211', '1331', false, false, false, false, 'grid'),
    VT('UNC', 'Ủy nhiệm chi', 'Thu chi', '', '11211', '', false, false, false, false, 'grid'),
    VT('CTNH', 'Chứng từ ngân hàng', 'Thu chi', '', '', '1331', false, false, false, false, 'grid'),
    VT('HDMV', 'Hóa đơn mua vào', 'Mua bán', '', '331', '1331', false, false, false, true, 'grid', 'Mã riêng của mockup: Smart Pro nhập mua vào bằng PNK/PC/UNC, không có loại HDMV.'),
    VT('HD', 'Hóa đơn bán ra (dịch vụ)', 'Mua bán', '131', '5113', '33311', false, false, false, true, 'grid'),
    VT('HDBR', 'Hóa đơn bán ra có mã hàng hóa', 'Mua bán', '131', '5111', '33311', true, true, false, true, 'grid'),
    VT('HDCK', 'Hóa đơn chiết khấu cho người mua', 'Mua bán', '', '131', '33311', false, false, false, false, 'grid'),
    VT('HTL', 'Nhập kho hàng bán trả lại', 'Kho', '', '131', '33311', true, true, true, false, 'stock'),
    VT('PNK', 'Phiếu nhập kho', 'Kho', '1561', '331', '1331', true, false, true, true, 'stock', 'Smart Pro đặt Co_VTHH = F cho PNK; mockup bật vì PNK bắt buộc mã hàng (business-rules §3.1).'),
    VT('PNKL', 'Phiếu nhập kho hàng bán bị trả lại', 'Kho', '1561', '', '', true, false, true, false, 'grid'),
    VT('PXK', 'Phiếu xuất kho', 'Kho', '', '', '', false, true, false, false, 'stock'),
    VT('XTH', 'Xuất kho trả lại hàng người bán', 'Kho', '331', '1561', '1331', true, true, false, false, 'stock'),
    VT('PCK', 'Phiếu chuyển kho', 'Kho', '1561', '1561', '33311', true, true, true, false, 'stock'),
    VT('PKT', 'Phiếu kế toán', 'Tổng hợp', '', '', '1331', false, false, false, false, 'grid'),
    VT('PKT02', 'Phiếu kế toán 02', 'Tổng hợp', '', '', '1331', false, false, false, false, 'grid'),
    VT('CTGS', 'Chứng từ ghi sổ', 'Tổng hợp', '', '', '1331', false, false, false, false, 'grid'),
    VT('PBCP', 'Phân bổ chi phí mua hàng, chi phí chung', 'Tổng hợp', '', '', '1331', false, false, false, false, 'job'),
    VT('CPCPB', 'Phân bổ chi phí trả trước, khấu hao', 'Tổng hợp', '', '242', '', false, false, false, true, 'job'),
    VT('KC', 'Kết chuyển cuối kỳ', 'Tổng hợp', '', '', '', false, false, false, false, 'job'),
    VT('KCCP', 'Kết chuyển chi phí sang 154', 'Tổng hợp', '154', '', '', false, false, false, false, 'job', 'Mã riêng của mockup cho bước 9 (621/622/623/627 → 154).'),
    VT('KCGT', 'Kết chuyển giá thành', 'Tổng hợp', '', '154', '', false, false, false, false, 'job', 'Mã riêng của mockup: 154 → 155/632 sau khi tính giá thành.'),
    VT('SDDK', 'Số dư đầu kỳ', 'Tổng hợp', '', '', '', false, false, false, false, 'job'),
  ];
  const TYPE_NAMES = Object.fromEntries(VTYPES.map((v) => [v.code, v.name]));

  const L = (dr, cr, amt, cp, desc, x) => ({ dr, cr, amt, cp: cp || null, desc: desc || '', ...x });

  /* ---------- Stock engine: stock is derived from posted ledger lines carrying item/wh/qty ---------- */
  const isStockAcc = (c) => !!c && /^(152|153|155|156)/.test(c);
  const goodsOf = (code, d = db()) => d.goods.find((g) => g.code === code);

  function stockMoves(d, extra = []) {
    const list = d.entries.filter((e) => e.status === 'posted').map((e, i) => ({ e, i }));
    extra.forEach((e, k) => list.push({ e, i: 1e9 + k }));
    list.sort((a, z) => a.e.date.localeCompare(z.e.date) || a.i - z.i);
    const moves = [];
    list.forEach(({ e, i }) => e.lines.forEach((l, li) => {
      if (!l.item) return;
      const inS = isStockAcc(l.dr); const outS = isStockAcc(l.cr);
      if (!inS && !outS) return;
      const base = { seq: `${i}.${li}`, date: e.date, entryId: e.id, no: e.no, type: e.type, item: l.item, lot: l.lot || '', qty: l.qty || 0, amt: l.amt, line: l, dr: l.dr, cr: l.cr, desc: l.desc || e.desc, adj: !!l.adj, ct: l.ct || '' };
      if (inS && outS) moves.push({ ...base, kind: 'xfer', wh: l.wh, whTo: l.whTo || l.wh });
      else if (inS) moves.push({ ...base, kind: 'in', wh: l.wh });
      else moves.push({ ...base, kind: 'out', wh: l.wh });
    }));
    return moves;
  }

  const consumeLayers = (layers, q) => {
    let need = q; let cost = 0;
    while (need > 1e-9 && layers.length) {
      const top = layers[0];
      const take = Math.min(top.qty, need);
      cost += take * top.unit; top.qty -= take; need -= take;
      if (top.qty <= 1e-9) layers.shift();
    }
    return { cost, left: need };
  };
  const peekLayers = (layers, q) => consumeLayers(layers.map((x) => ({ ...x })), q).cost;

  /* Ledger-valued state per item|wh at the end of `upTo` (inclusive). */
  function stockState(moves, upTo) {
    const st = {};
    const get = (item, wh) => (st[`${item}|${wh}`] = st[`${item}|${wh}`] || { item, wh, qty: 0, val: 0, layers: [] });
    moves.forEach((mv) => {
      if (upTo && mv.date > upTo) return;
      if (mv.kind === 'in') {
        const s = get(mv.item, mv.wh); s.qty += mv.qty; s.val += mv.amt;
        if (mv.qty > 0) s.layers.push({ qty: mv.qty, unit: mv.amt / mv.qty });
      } else if (mv.kind === 'out') {
        const s = get(mv.item, mv.wh); s.qty -= mv.qty; s.val -= mv.amt; consumeLayers(s.layers, mv.qty);
      } else {
        const a = get(mv.item, mv.wh); const b = get(mv.item, mv.whTo);
        a.qty -= mv.qty; a.val -= mv.amt; consumeLayers(a.layers, mv.qty);
        b.qty += mv.qty; b.val += mv.amt; if (mv.qty > 0) b.layers.push({ qty: mv.qty, unit: mv.amt / mv.qty });
      }
    });
    return st;
  }

  /* Provisional cost of issuing qty at date. FIFO and moving average are final; BQGQ is re-priced at month end. */
  function issueCost(d, { item, wh, qty, date, extra = [] }) {
    const g = goodsOf(item, d);
    const st = stockState(stockMoves(d, extra), date);
    if (g && g.method === 'FIFO') {
      const s = st[`${item}|${wh}`] || { qty: 0, layers: [] };
      return s.qty <= 0 ? r0(qty * g.price) : r0(peekLayers(s.layers, qty));
    }
    /* Average-cost methods price across all warehouses of the item (Smart Pro XULY_DG_BQGQL). */
    const all = Object.values(st).filter((x) => x.item === item).reduce((a, x) => ({ qty: a.qty + x.qty, val: a.val + x.val }), { qty: 0, val: 0 });
    if (all.qty <= 0) return r0(qty * (g ? g.price : 0));
    return qty >= all.qty ? r0(all.val) : r0((all.val / all.qty) * qty);
  }

  function stockNegative(d, lines, date) {
    const probe = [{ id: 'probe', status: 'posted', date, no: '(mới)', type: 'PXK', lines: lines.filter((l) => l.item && !l.adj) }];
    const keys = new Set(probe[0].lines.flatMap((l) => [`${l.item}|${l.wh}`]));
    const st = {}; const bad = new Map();
    stockMoves(d, probe).forEach((mv) => {
      const g = (w) => (st[`${mv.item}|${w}`] = st[`${mv.item}|${w}`] || 0);
      const set = (w, v) => { st[`${mv.item}|${w}`] = v; if (v < -1e-9 && keys.has(`${mv.item}|${w}`)) bad.set(`${mv.item}|${w}`, v); };
      if (mv.kind === 'in') set(mv.wh, g(mv.wh) + mv.qty);
      else if (mv.kind === 'out') set(mv.wh, g(mv.wh) - mv.qty);
      else { set(mv.wh, g(mv.wh) - mv.qty); set(mv.whTo, g(mv.whTo) + mv.qty); }
    });
    return [...bad.entries()].map(([k, v]) => { const [item, wh] = k.split('|'); return { item, wh, short: -v }; });
  }

  function stockTable(period, d = db()) {
    const start = `${period}-01`; const end = lastDay(period);
    const moves = stockMoves(d);
    const rows = {};
    const row = (item, wh) => (rows[`${item}|${wh}`] = rows[`${item}|${wh}`] || { item, wh, openQty: 0, openVal: 0, inQty: 0, inVal: 0, outQty: 0, outVal: 0 });
    moves.forEach((mv) => {
      if (mv.date > end) return;
      const open = mv.date < start || mv.type === 'SDDK';
      const apply = (r, sign, qty, amt) => {
        if (open) { r.openQty += sign * qty; r.openVal += sign * amt; } else if (sign > 0) { r.inQty += qty; r.inVal += amt; } else { r.outQty += qty; r.outVal += amt; }
      };
      if (mv.kind === 'in') apply(row(mv.item, mv.wh), 1, mv.qty, mv.amt);
      else if (mv.kind === 'out') apply(row(mv.item, mv.wh), -1, mv.qty, mv.amt);
      else { apply(row(mv.item, mv.wh), -1, mv.qty, mv.amt); apply(row(mv.item, mv.whTo), 1, mv.qty, mv.amt); }
    });
    return Object.values(rows).map((r) => {
      const endQty = r.openQty + r.inQty - r.outQty; const endVal = r.openVal + r.inVal - r.outVal;
      return { ...r, endQty, endVal, avg: endQty > 0 ? endVal / endQty : 0 };
    });
  }

  function stockCard(item, wh, period, d = db()) {
    const start = `${period}-01`; const end = lastDay(period);
    let qty = 0; let val = 0; let openQty = 0; let openVal = 0; const rows = [];
    stockMoves(d).forEach((mv) => {
      if (mv.item !== item || mv.date > end) return;
      let dq = 0; let dv = 0; let kind = '';
      if (mv.kind === 'in' && mv.wh === wh) { dq = mv.qty; dv = mv.amt; kind = 'in'; }
      else if ((mv.kind === 'out' || mv.kind === 'xfer') && mv.wh === wh) { dq = -mv.qty; dv = -mv.amt; kind = 'out'; }
      else if (mv.kind === 'xfer' && mv.whTo === wh) { dq = mv.qty; dv = mv.amt; kind = 'in'; }
      else return;
      qty += dq; val += dv;
      if (mv.date < start || mv.type === 'SDDK') { openQty = qty; openVal = val; return; }
      rows.push({ mv, kind, inQty: dq > 0 ? dq : 0, inVal: dv > 0 ? dv : 0, outQty: dq < 0 ? -dq : 0, outVal: dv < 0 ? -dv : 0, qty, val });
    });
    return { openQty, openVal, rows, endQty: qty, endVal: val };
  }

  /* Lot balances: ins by lot, issues taken FEFO (earliest expiry first) because issue lines do not name a lot. */
  function lotBalances(d = db(), upTo) {
    const out = {};
    const expiry = Object.fromEntries(d.lots.map((l) => [l.code, l.expiry]));
    const bucket = (item, wh) => (out[`${item}|${wh}`] = out[`${item}|${wh}`] || { item, wh, lots: {}, issued: 0 });
    stockMoves(d).forEach((mv) => {
      if (upTo && mv.date > upTo) return;
      const g = goodsOf(mv.item, d); if (!g || !g.lot) return;
      if (mv.kind === 'in' && mv.qty > 0) { const b = bucket(mv.item, mv.wh); const k = mv.lot || '(chưa có lô)'; b.lots[k] = (b.lots[k] || 0) + mv.qty; }
      if (mv.kind === 'out' || mv.kind === 'xfer') bucket(mv.item, mv.wh).issued += mv.qty;
      if (mv.kind === 'xfer') { const b = bucket(mv.item, mv.whTo); const k = mv.lot || '(chưa có lô)'; b.lots[k] = (b.lots[k] || 0) + mv.qty; }
    });
    const rows = [];
    Object.values(out).forEach((b) => {
      let left = b.issued;
      Object.entries(b.lots).sort((x, y) => (expiry[x[0]] || '9').localeCompare(expiry[y[0]] || '9')).forEach(([lot, q]) => {
        const take = Math.min(q, left); left -= take;
        if (q - take > 1e-9) rows.push({ item: b.item, wh: b.wh, lot, qty: q - take, expiry: expiry[lot] || '' });
      });
    });
    return rows;
  }

  /* Re-price every issue by the item's method and return per-move standard cost. */
  function recost(moves, goods) {
    const std = new Map();
    const byItem = {};
    moves.forEach((mv) => { if (!mv.adj) (byItem[mv.item] = byItem[mv.item] || []).push(mv); });
    Object.entries(byItem).forEach(([item, list]) => {
      const g = goods.find((x) => x.code === item); const method = g ? g.method : 'BQDD';
      if (method === 'BQGQ') {
        let carry = { qty: 0, val: 0 };
        [...new Set(list.map((m) => m.date.slice(0, 7)))].sort().forEach((p) => {
          const inM = list.filter((m) => m.date.slice(0, 7) === p && m.kind === 'in');
          const outs = list.filter((m) => m.date.slice(0, 7) === p && m.kind === 'out');
          const inQty = inM.reduce((s, m) => s + m.qty, 0); const inVal = inM.reduce((s, m) => s + m.amt, 0);
          const poolQty = carry.qty + inQty; const poolVal = carry.val + inVal;
          const price = poolQty > 0 ? poolVal / poolQty : 0;
          const outQty = outs.reduce((s, m) => s + m.qty, 0);
          let used = 0;
          outs.forEach((m, i) => {
            const isLast = i === outs.length - 1 && Math.abs(outQty - poolQty) < 1e-9;
            const c = isLast ? r0(poolVal) - used : r0(m.qty * price);
            used += c; std.set(m.seq, c);
          });
          carry = { qty: poolQty - outQty, val: poolVal - used };
          if (Math.abs(carry.qty) < 1e-9) carry = { qty: 0, val: 0 };
        });
      } else if (method === 'BQDD') {
        const pool = { qty: 0, val: 0 };
        list.forEach((m) => {
          if (m.kind === 'in') { pool.qty += m.qty; pool.val += m.amt; return; }
          const c = pool.qty <= 0 ? r0(m.qty * (g ? g.price : 0)) : m.qty >= pool.qty - 1e-9 ? r0(pool.val) : r0((pool.val / pool.qty) * m.qty);
          std.set(m.seq, c);
          if (m.kind === 'out') { pool.qty -= m.qty; pool.val -= c; }
        });
      } else {
        const st = {};
        const get = (w) => (st[w] = st[w] || { qty: 0, layers: [] });
        const take = (s, q) => { const c = r0(consumeLayers(s.layers, q).cost); s.qty -= q; return c; };
        list.forEach((m) => {
          if (m.kind === 'in') { const s = get(m.wh); s.qty += m.qty; if (m.qty > 0) s.layers.push({ qty: m.qty, unit: m.amt / m.qty }); }
          else if (m.kind === 'out') { const s = get(m.wh); std.set(m.seq, s.qty > 0 ? take(s, m.qty) : r0(m.qty * (g ? g.price : 0))); }
          else {
            const a = get(m.wh); const b = get(m.whTo);
            const c = a.qty > 0 ? take(a, m.qty) : r0(m.qty * (g ? g.price : 0));
            std.set(m.seq, c); b.qty += m.qty; if (m.qty > 0) b.layers.push({ qty: m.qty, unit: c / m.qty });
          }
        });
      }
    });
    return std;
  }

  /* Difference between the re-priced issues of a period and what the ledger already holds (incl. earlier adjustments). */
  function stockCostPlan(period = state.period, d = db()) {
    const moves = stockMoves(d);
    const std = recost(moves, d.goods);
    const groups = {};
    moves.forEach((mv) => {
      if (mv.adj || mv.date.slice(0, 7) !== period || mv.kind !== 'out') return;
      const key = `${mv.item}|${mv.wh}|${mv.dr}|${mv.cr}|${mv.ct}|${mv.kind === 'xfer' ? mv.whTo : ''}`;
      const g = groups[key] = groups[key] || { item: mv.item, wh: mv.wh, whTo: mv.whTo, dr: mv.dr, cr: mv.cr, ct: mv.ct, kind: mv.kind, qty: 0, std: 0, posted: 0 };
      g.qty += mv.qty; g.std += std.get(mv.seq) || 0; g.posted += mv.amt;
    });
    moves.forEach((mv) => {
      if (!mv.adj || mv.date.slice(0, 7) !== period) return;
      const key = `${mv.item}|${mv.wh}|${mv.adjDr || mv.line.adjDr}|${mv.adjCr || mv.line.adjCr}|${mv.ct}|`;
      const g = groups[key]; if (!g) return;
      g.posted += mv.kind === 'out' ? mv.amt : -mv.amt;
    });
    const rows = Object.values(groups).map((g) => ({ ...g, diff: g.std - g.posted, dgStd: g.qty ? g.std / g.qty : 0 }));
    const lines = rows.filter((g) => g.diff !== 0).map((g) => (g.diff > 0
      ? L(g.dr, g.cr, g.diff, null, `Điều chỉnh giá xuất kho ${g.item}`, { item: g.item, wh: g.wh, qty: 0, adj: true, adjDr: g.dr, adjCr: g.cr, ct: g.ct || undefined })
      : L(g.cr, g.dr, -g.diff, null, `Điều chỉnh giá xuất kho ${g.item}`, { item: g.item, wh: g.wh, qty: 0, adj: true, adjDr: g.dr, adjCr: g.cr, ct: g.ct || undefined })));
    return { rows, lines, std };
  }

  function stockVsLedger(period = state.period, d = db()) {
    const t = stockTable(period, d);
    const bad = [];
    ['152', '153', '155', '1561'].forEach((code) => {
      const goodsVal = t.filter((r) => (goodsOf(r.item, d) || {}).tkKho === code).reduce((s, r) => s + r.endVal, 0);
      const gl = net(code, period, d);
      if (goodsVal !== gl) bad.push({ code, goodsVal, gl });
    });
    const neg = t.filter((r) => r.endQty < -1e-9);
    return { bad, neg };
  }

  /* ---------- Payroll engine ---------- */
  const parseCell = (c) => {
    const m = /^([XNPLOK]?)(?:\+(\d+(?:\.\d+)?))?$/i.exec(String(c || '').trim());
    return m ? { code: m[1].toUpperCase(), ot: Number(m[2] || 0) } : { code: '', ot: 0 };
  };
  const sheetStats = (cells) => {
    const s = { x: 0, n: 0, p: 0, l: 0, o: 0, k: 0, ot: 0 };
    cells.forEach((c) => { const { code, ot } = parseCell(c); if (code) s[code.toLowerCase()] += 1; s.ot += ot; });
    return { ...s, paid: s.x + s.n * 0.5 + s.p + s.l, leave: s.p, off: s.o + s.k };
  };
  const dayOfWeek = (p, day) => new Date(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1, day).getDay();
  const isHoliday = (iso, d = db()) => d.holidays.find(([h]) => h === iso);
  function defaultSheet(period, d = db()) {
    return Array.from({ length: daysIn(period) }, (_, i) => {
      const day = i + 1;
      if (isHoliday(`${period}-${String(day).padStart(2, '0')}`, d)) return 'L';
      return dayOfWeek(period, day) === 0 ? '' : 'X';
    });
  }
  const sheetFor = (period, code, d = db()) => ((d.timesheets[period] || {})[code]) || defaultSheet(period, d);

  const pitOf = (taxable, brackets) => r0(brackets.reduce((s, b) => s + Math.max(0, Math.min(taxable, b.to == null ? Infinity : b.to) - b.from) * b.rate / 100, 0));
  const pct = (base, rate) => r0((base * rate) / 100);

  function payRow(emp, st, par, brackets, advance = 0) {
    const allow = emp.pc.reduce((s, v) => s + v, 0);
    const salaryByDay = r0((emp.base / par.ngayCongChuan) * st.paid);
    const allowByDay = r0((allow / par.ngayCongChuan) * st.paid);
    const hourly = (emp.base + allow) / par.ngayCongChuan / par.gioMotNgay;
    const ot = r0((hourly * par.otHeSo / 100) * st.ot);
    const gross = salaryByDay + allowByDay + ot;
    const bhBase = emp.ins ? Math.min(emp.bhxh, par.tranBhxh) : 0;
    const bhtnBase = emp.ins ? Math.min(emp.bhxh, par.tranBhtn) : 0;
    const empBhxh = pct(bhBase, par.nldBhxh); const empBhyt = pct(bhBase, par.nldBhyt); const empBhtn = pct(bhtnBase, par.nldBhtn);
    const coBhxh = pct(bhBase, par.ctyBhxh); const coBhyt = pct(bhBase, par.ctyBhyt); const coBhtn = pct(bhtnBase, par.ctyBhtn);
    const kpcd = emp.ins ? pct(bhBase, par.kpcd) : 0;
    const empIns = empBhxh + empBhyt + empBhtn;
    const selfDeduct = par.giamTruBanThan; const depDeduct = emp.deps * par.giamTruPhuThuoc;
    const taxable = Math.max(0, gross - empIns - selfDeduct - depDeduct);
    const pit = pitOf(taxable, brackets);
    return {
      code: emp.code, name: emp.name, dept: emp.dept, position: emp.position, tkCp: emp.tkCp, ct: emp.ct || '', ins: emp.ins, deps: emp.deps,
      workDays: st.paid, otHours: st.ot, base: emp.base, allow, salaryByDay, allowByDay, ot, gross, bhBase, bhtnBase,
      empBhxh, empBhyt, empBhtn, empIns, coBhxh, coBhyt, coBhtn, kpcd, coIns: coBhxh + coBhyt + coBhtn,
      selfDeduct, depDeduct, taxable, pit, advance, net: gross - empIns - pit - advance,
    };
  }
  const advanceOf = (d, code, period) => d.advances.filter((a) => a.emp === code && a.date.slice(0, 7) === period).reduce((s, a) => s + a.amt, 0);

  function createPayroll(d, period) {
    const rows = d.employees.filter((e) => e.active).map((e) => payRow(e, sheetStats(sheetFor(period, e.code, d)), d.params, d.taxBrackets, advanceOf(d, e.code, period)));
    d.payrolls[period] = { period, rows, par: { ...d.params }, createdBy: state.user.name, status: 'draft' };
    return d.payrolls[period];
  }
  const payTotals = (rows) => rows.reduce((t, r) => { Object.keys(r).forEach((k) => { if (typeof r[k] === 'number' && !['deps', 'base'].includes(k)) t[k] = (t[k] || 0) + r[k]; }); return t; }, {});

  /* Text shown in the formula popover. Mirrors payRow field by field. */
  function payFormulas(r, par) {
    const m = E.money; const std = par.ngayCongChuan;
    return {
      salaryByDay: `Lương cơ bản ÷ ${std} × công thực tế = ${m(r.base)} ÷ ${std} × ${String(r.workDays).replace('.', ',')} = ${m(r.salaryByDay)}`,
      allowByDay: `Phụ cấp (chức vụ, trách nhiệm, ăn, thâm niên) ÷ ${std} × công = ${m(r.allow)} ÷ ${std} × ${String(r.workDays).replace('.', ',')} = ${m(r.allowByDay)}`,
      ot: `(Lương cơ bản + phụ cấp) ÷ ${std} ÷ ${par.gioMotNgay} × ${par.otHeSo}% × ${r.otHours} giờ = ${m(r.ot)}`,
      gross: `Lương theo công + phụ cấp + OT = ${m(r.salaryByDay)} + ${m(r.allowByDay)} + ${m(r.ot)} = ${m(r.gross)}`,
      empBhxh: `Lương đóng BH (${m(r.bhBase)}, trần ${m(par.tranBhxh)}) × ${par.nldBhxh}% = ${m(r.empBhxh)}`,
      empBhyt: `Lương đóng BH (${m(r.bhBase)}) × ${par.nldBhyt}% = ${m(r.empBhyt)}`,
      empBhtn: `Lương đóng BHTN (${m(r.bhtnBase)}, trần ${m(par.tranBhtn)}) × ${par.nldBhtn}% = ${m(r.empBhtn)}`,
      coBhxh: `Lương đóng BH (${m(r.bhBase)}) × ${par.ctyBhxh}% = ${m(r.coBhxh)}`,
      coBhyt: `Lương đóng BH (${m(r.bhBase)}) × ${par.ctyBhyt}% = ${m(r.coBhyt)}`,
      coBhtn: `Lương đóng BHTN (${m(r.bhtnBase)}) × ${par.ctyBhtn}% = ${m(r.coBhtn)}`,
      kpcd: `Lương đóng BH (${m(r.bhBase)}) × ${par.kpcd}% = ${m(r.kpcd)}`,
      deduct: `Bản thân ${m(r.selfDeduct)} + ${r.deps} người phụ thuộc × ${m(par.giamTruPhuThuoc)} = ${m(r.selfDeduct + r.depDeduct)}`,
      taxable: `Tổng thu nhập − BH người lao động − giảm trừ = ${m(r.gross)} − ${m(r.empIns)} − ${m(r.selfDeduct + r.depDeduct)} = ${m(r.taxable)}`,
      pit: `Biểu lũy tiến từng phần trên ${m(r.taxable)} = ${m(r.pit)}`,
      net: `Tổng thu nhập − BH − thuế TNCN − tạm ứng = ${m(r.gross)} − ${m(r.empIns)} − ${m(r.pit)} − ${m(r.advance)} = ${m(r.net)}`,
    };
  }

  const payProposals = (d, period, kind) => d.proposals.filter((p) => p.source.run === 'payroll' && p.payKind === kind && p.period === period && p.status !== 'rejected');
  function payrollState(d = db(), period = state.period) {
    const pr = d.payrolls[period];
    const acc = payProposals(d, period, 'accrue'); const out = payProposals(d, period, 'payout');
    const posted = (l) => l.length > 0 && l.every((p) => p.status === 'posted');
    return { payroll: pr || null, accrued: posted(acc), accruePending: acc.some((p) => p.status !== 'posted'), accrueAny: acc.length > 0, paid: posted(out), payoutPending: out.some((p) => p.status !== 'posted'), payoutAny: out.length > 0 };
  }

  function payrollPost(d = db(), period = state.period) {
    const pr = d.payrolls[period];
    const rm_ = REGIME_MAP[d.regime];
    const label = E.periodLabel(period);
    const byDept = {};
    pr.rows.forEach((r) => { (byDept[r.dept] = byDept[r.dept] || []).push(r); });
    const created = [];
    Object.entries(byDept).forEach(([dept, rows]) => {
      const lines = [];
      rows.forEach((r) => {
        const dim = r.tkCp === '622' && r.ct ? { ct: r.ct, ytcp: 'LUONG' } : { ytcp: 'LUONG' };
        if (r.gross) lines.push(L(r.tkCp, rm_.salary, r.gross, r.code, `Lương tháng ${label} – ${r.name}`, dim));
      });
      const groups = {};
      rows.forEach((r) => { const k = `${r.tkCp}|${r.tkCp === '622' ? r.ct : ''}`; const g = groups[k] = groups[k] || { tk: r.tkCp, ct: r.tkCp === '622' ? r.ct : '', bhxh: 0, bhyt: 0, bhtn: 0, kpcd: 0 }; g.bhxh += r.coBhxh; g.bhyt += r.coBhyt; g.bhtn += r.coBhtn; g.kpcd += r.kpcd; });
      Object.values(groups).forEach((g) => {
        const dim = g.ct ? { ct: g.ct, ytcp: 'LUONG' } : { ytcp: 'LUONG' };
        [[rm_.bhxh, g.bhxh, 'BHXH'], [rm_.bhyt, g.bhyt, 'BHYT'], [rm_.bhtn, g.bhtn, 'BHTN'], [rm_.kpcd, g.kpcd, 'KPCĐ']].forEach(([acc, amt, n]) => { if (amt) lines.push(L(g.tk, acc, amt, null, `${n} phần công ty tháng ${label} – ${dept}`, dim)); });
      });
      rows.forEach((r) => {
        [[rm_.bhxh, r.empBhxh, 'BHXH'], [rm_.bhyt, r.empBhyt, 'BHYT'], [rm_.bhtn, r.empBhtn, 'BHTN'], [rm_.pit, r.pit, 'Thuế TNCN']].forEach(([acc, amt, n]) => { if (amt) lines.push(L(rm_.salary, acc, amt, r.code, `${n} khấu trừ tháng ${label} – ${r.name}`)); });
      });
      const p = { id: uid('p'), type: 'PKT', date: lastDay(period), desc: `Lương và bảo hiểm tháng ${label} – ${dept}`, cp: null, lines, source: { kind: 'job', label: 'Job · Lương', run: 'payroll' }, doc: null, status: 'proposed', edited: false, sensitive: true, payKind: 'accrue', period };
      d.proposals.push(p); created.push(p);
    });
    return created;
  }

  function payrollPayout(d = db(), period = state.period, method = 'bank') {
    const pr = d.payrolls[period];
    const acc = method === 'cash' ? '1111' : '11211';
    const lines = pr.rows.filter((r) => r.net > 0).map((r) => L(REGIME_MAP[d.regime].salary, acc, r.net, r.code, `Trả lương tháng ${E.periodLabel(period)} – ${r.name}`));
    const p = { id: uid('p'), type: method === 'cash' ? 'PC' : 'UNC', date: lastDay(period), desc: `Chi lương tháng ${E.periodLabel(period)} (${method === 'cash' ? 'tiền mặt' : 'chuyển khoản'})`, cp: null, lines, source: { kind: 'job', label: 'Job · Chi lương', run: 'payroll' }, doc: null, status: 'proposed', edited: false, sensitive: true, payKind: 'payout', period };
    d.proposals.push(p);
    return p;
  }

  function addAdvance(d, { emp, date, amt }) {
    const e = d.employees.find((x) => x.code === emp);
    const entry = postEntry({ type: 'UNC', date, desc: `Ứng lương – ${e.name}`, lines: [L('334', '11211', amt, emp, `Ứng lương – ${e.name}`)], source: 'manual' }, d);
    d.advances.push({ id: uid('adv'), emp, date, amt, entryNo: entry.no });
    return entry;
  }

  /* ---------- Costing engine ---------- */
  const TRANSFER_TYPES = ['KCCP', 'KCGT', 'KC'];
  const ctOf = (l, side) => (side === 'cr' ? (l.ctCr !== undefined ? l.ctCr : l.ct) : l.ct) || '';
  const ELEMENTS = [['621', 'NVL trực tiếp'], ['622', 'Nhân công trực tiếp'], ['623', 'Máy thi công'], ['627', 'Sản xuất chung'], ['154', 'CP tập hợp trực tiếp 154']];

  function costLines(d, period, acc, ct) {
    const rows = [];
    d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && e.date.slice(0, 7) === period && !TRANSFER_TYPES.includes(e.type))
      .forEach((e) => e.lines.forEach((l) => {
        if (l.dr === acc && ctOf(l, 'dr') === (ct || '')) rows.push({ e, l, amt: l.amt });
        if (l.cr === acc && ctOf(l, 'cr') === (ct || '')) rows.push({ e, l, amt: -l.amt });
      }));
    return rows;
  }
  const costNet = (d, period, acc, ct) => costLines(d, period, acc, ct).reduce((s, r) => s + r.amt, 0);

  function costMatrix(period = state.period, d = db()) {
    const objs = d.costObjects.filter((o) => o.active);
    const mk = (code) => { const el = {}; ELEMENTS.forEach(([a]) => { el[a] = costNet(d, period, a, code); }); return { code, el, total: Object.values(el).reduce((s, v) => s + v, 0) }; };
    const rows = objs.map((o) => ({ ...mk(o.code), obj: o }));
    const un = mk('');
    const totals = {}; ELEMENTS.forEach(([a]) => { totals[a] = rows.reduce((s, r) => s + r.el[a], 0) + un.el[a]; });
    return { rows, unassigned: un, totals };
  }

  const wipOpen = (d, period, obj) => {
    const prev = Object.keys(d.wip).filter((p) => p < period).sort().pop();
    if (prev && d.wip[prev][obj] && d.wip[prev][obj].close) return d.wip[prev][obj].close;
    const o = (d.opening.wip || []).find((x) => x.obj === obj);
    return { 621: 0, 622: 0, 623: 0, 627: 0, 154: 0, ...(o ? o.e : {}) };
  };

  /* Dở dang cuối kỳ by object. NVL: only 621 stays in WIP; SLHTTD: 621 at 100%, conversion cost at pct; DINHMUC: qty × norm. */
  function wipClose(d, period, o, inc, open) {
    const set = (d.wip[period] || {})[o.code] || {};
    if (set.manual) return set.close;
    const method = set.method || o.method; const qtyWip = set.qtyWip != null ? set.qtyWip : o.qtyWip; const pctWip = set.pct != null ? set.pct : o.pct;
    const done = o.qtyDone; const close = { 621: 0, 622: 0, 623: 0, 627: 0, 154: 0 };
    if (method === 'DINHMUC') {
      const nm = d.norms[o.code] || {};
      ['621', '622', '623', '627'].forEach((a) => { close[a] = r0(qtyWip * (nm[a] || 0) * (a === '621' ? 1 : pctWip / 100)); });
      return close;
    }
    ['621', '622', '623', '627', '154'].forEach((a) => {
      const pool = (open[a] || 0) + (inc[a] || 0);
      const share = method === 'NVL' ? (a === '621' ? 1 : 0) : (a === '621' ? 1 : pctWip / 100);
      const eq = done + qtyWip * share;
      close[a] = share > 0 && eq > 0 && qtyWip > 0 ? r0((pool * qtyWip * share) / eq) : 0;
    });
    return close;
  }

  function costCard(period, code, d = db(), matrix) {
    const o = d.costObjects.find((x) => x.code === code);
    const m = matrix || costMatrix(period, d);
    const row = m.rows.find((r) => r.code === code);
    const inc = row ? row.el : {}; const open = wipOpen(d, period, code);
    const close = wipClose(d, period, o, inc, open);
    const z = {}; let zTotal = 0;
    ELEMENTS.forEach(([a]) => { z[a] = (open[a] || 0) + (inc[a] || 0) - (close[a] || 0); zTotal += z[a]; });
    return { obj: o, open, inc, close, z, zTotal, unit: o.qtyDone > 0 ? zTotal / o.qtyDone : 0, openTotal: Object.values(open).reduce((s, v) => s + v, 0), incTotal: Object.values(inc).reduce((s, v) => s + v, 0), closeTotal: Object.values(close).reduce((s, v) => s + v, 0) };
  }

  const ALLOC_KEYS = [['DT', 'Doanh thu'], ['NC', 'Nhân công trực tiếp (622)'], ['NVL', 'NVL trực tiếp (621)'], ['TAY', 'Tỷ lệ nhập tay']];
  function revenueByCt(d, period, code) {
    let s = 0;
    d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && e.date.slice(0, 7) === period && e.type !== 'KC').forEach((e) => e.lines.forEach((l) => {
      if (ctOf(l, 'cr') === code && /^511/.test(l.cr || '')) s += l.amt;
      if (ctOf(l, 'dr') === code && /^(511|521)/.test(l.dr || '')) s -= l.amt;
    }));
    return s;
  }
  /* pool: accounts whose unassigned balance is spread over objects (627, optionally 642). */
  function costAllocPlan(period, { pool = ['627'], key = 'NC', manual = {} } = {}, d = db()) {
    const objs = d.costObjects.filter((o) => o.active);
    const base = {};
    objs.forEach((o) => {
      base[o.code] = key === 'DT' ? revenueByCt(d, period, o.code) : key === 'NC' ? costNet(d, period, '622', o.code) : key === 'NVL' ? costNet(d, period, '621', o.code) : Number(manual[o.code] || 0);
    });
    const totalBase = Object.values(base).reduce((s, v) => s + Math.max(0, v), 0);
    const lines = []; const rows = [];
    pool.forEach((acc) => {
      const amt = costNet(d, period, acc, '');
      if (amt <= 0 || totalBase <= 0) return;
      let left = amt;
      const live = objs.filter((o) => base[o.code] > 0);
      live.forEach((o, i) => {
        const share = i === live.length - 1 ? left : r0((amt * base[o.code]) / totalBase);
        left -= share;
        rows.push({ acc, obj: o.code, base: base[o.code], pct: (base[o.code] / totalBase) * 100, amt: share });
        if (share > 0) lines.push(L(acc, acc, share, null, `Phân bổ ${acc} cho ${o.code}`, { ct: o.code, ctCr: '', ytcp: 'PBCP' }));
      });
    });
    return { rows, lines, totalBase, poolAmt: Object.fromEntries(pool.map((a) => [a, costNet(d, period, a, '')])) };
  }
  function runCostAlloc(opts, d = db()) {
    purgePending(d, 'alloc');
    const plan = costAllocPlan(state.period, opts, d);
    if (!plan.lines.length) return { error: 'Không có chi phí chung chưa phân bổ hoặc tiêu thức phân bổ bằng 0.' };
    d.proposals.push({ id: uid('p'), type: 'PBCP', date: lastDay(state.period), desc: `Phân bổ chi phí chung ${opts.pool.join(', ')} tháng ${E.periodLabel(state.period)} (tiêu thức: ${(ALLOC_KEYS.find((k) => k[0] === opts.key) || [])[1]})`, cp: null, lines: plan.lines, source: { kind: 'job', label: 'Job · Phân bổ chi phí', run: 'alloc' }, doc: null, status: 'proposed', edited: false });
    d.runs.alloc = state.period;
    return { plan };
  }

  /* Step 9: 621/622/623/627 → 154, then 154 → 155/632 for finished output. */
  function runCostTransfer(d = db()) {
    const period = state.period; const rm_ = REGIME_MAP[d.regime];
    const m = costMatrix(period, d);
    const stuck = ['621', '622', '623', '627'].reduce((s, a) => s + m.unassigned.el[a], 0);
    if (stuck > 0) return { error: `Còn ${E.money(stuck)} đ chi phí chưa gắn đối tượng. Phân bổ ở màn Giá thành trước khi kết chuyển.`, stuck };
    purgePending(d, 'cost');
    const posted = (type, pred) => d.entries.filter((e) => e.status === 'posted' && e.type === type && e.date.slice(0, 7) === period).reduce((s, e) => s + e.lines.filter(pred).reduce((x, l) => x + l.amt, 0), 0);
    const kc = []; const gt = []; const cards = {};
    m.rows.forEach((r) => {
      const card = costCard(period, r.code, d, m); cards[r.code] = card;
      rm_.elements.forEach((a) => {
        const v = r.el[a] - posted('KCCP', (l) => l.cr === a && l.ct === r.code);
        if (v > 0) kc.push(L('154', a, v, null, `Kết chuyển ${a} → 154 – ${r.obj.name}`, { ct: r.code, ytcp: a }));
      });
      const z = card.zTotal - posted('KCGT', (l) => l.cr === '154' && l.ct === r.code);
      if (z > 0 && r.obj.qtyDone > 0) {
        if (r.obj.out === '155') {
          const g = goodsOf(r.obj.item, d);
          gt.push(L('155', '154', z, null, `Nhập kho thành phẩm ${r.obj.name} (giá thành đơn vị ${E.money(card.unit)})`, { ct: r.code, item: r.obj.item, wh: d.warehouses[d.warehouses.length > 1 ? 1 : 0].code, qty: r.obj.qtyDone, lot: g && g.lot ? `LO-${g.code}-2612` : undefined }));
        } else gt.push(L(rm_.cogs, '154', z, null, `Giá vốn ${r.obj.name} (kết chuyển giá thành)`, { ct: r.code }));
      }
    });
    d.wip[period] = d.wip[period] || {};
    m.rows.forEach((r) => { d.wip[period][r.code] = { ...(d.wip[period][r.code] || {}), close: cards[r.code].close }; });
    const date = lastDay(period); const label = E.periodLabel(period);
    const src = { kind: 'job', label: 'Job · Giá thành', run: 'cost' };
    const first = kc.length ? { id: uid('p'), type: 'KCCP', date, desc: `Kết chuyển chi phí sản xuất sang 154 tháng ${label}`, cp: null, lines: kc, source: src, doc: null, status: 'proposed', edited: false } : null;
    if (first) d.proposals.push(first);
    if (gt.length) d.proposals.push({ id: uid('p'), type: 'KCGT', date, desc: `Kết chuyển giá thành tháng ${label}`, cp: null, lines: gt, source: src, doc: null, status: 'proposed', edited: false, requires: first ? first.id : undefined });
    d.runs.cost = period;
    return { kc: kc.length, gt: gt.length, cards };
  }

  /* ---------- Opening balances (SDDK) ---------- */
  function openingLines(d) {
    const op = d.opening; const lines = [];
    op.rows.forEach((r) => lines.push(r.side === 'D' ? L(r.acc, null, r.amt, r.cp) : L(null, r.acc, r.amt, r.cp)));
    op.goods.forEach((g) => { const it = goodsOf(g.item, d); if (g.val > 0 || g.qty > 0) lines.push(L(it.tkKho, null, g.val, null, `Tồn đầu kỳ ${it.name}`, { item: g.item, wh: g.wh, lot: g.lot || undefined, qty: g.qty })); });
    op.wip.forEach((w) => { const v = Object.values(w.e).reduce((s, x) => s + x, 0); if (v > 0) lines.push(L('154', null, v, null, `Dở dang đầu kỳ ${w.obj}`, { ct: w.obj })); });
    return lines;
  }
  function openingCheck(d = db()) {
    const lines = openingLines(d);
    const dr = lines.filter((l) => l.dr).reduce((s, l) => s + l.amt, 0); const cr = lines.filter((l) => l.cr).reduce((s, l) => s + l.amt, 0);
    return { dr, cr, diff: dr - cr, lines };
  }
  function saveOpening(d = db()) {
    const e = d.entries.find((x) => x.source === 'smartpro_import');
    e.lines = openingLines(d);
    e.desc = 'Số dư đầu kỳ khai báo ở màn Số dư đầu kỳ';
    return e;
  }

  /* ---------- Seed ---------- */
  function seed(company) {
    const f = company.factor; const ind = company.industry; const rg = REGIME_MAP[company.regime];
    const m = (n) => r0((n * f) / 1000) * 1000;
    const costing = hasModule(company, 'costing'); const production = costing;
    const dec = (u) => (['tấn', 'm²'].includes(u) ? 100 : 1);
    const sq = (u, q) => Math.max(1 / dec(u), r0(q * f * dec(u)) / dec(u));

    const accounts = [...ACCOUNTS, ...REGIME_EXTRA[company.regime]].map(([code, name, side, cp]) => ({ code, name, side, cp: !!cp, active: true }));
    accounts.forEach((a) => {
      const parent = accounts.filter((p) => p.code !== a.code && a.code.startsWith(p.code)).sort((x, y) => y.code.length - x.code.length)[0];
      a.parent = parent ? parent.code : null;
    });
    accounts.forEach((a) => { a.postable = !accounts.some((c) => c.parent === a.code); });

    const nEmp = company.noPayroll ? 0 : clamp(r0(10 * f), 2, 10);
    const payAcc = (e) => {
      if (!production) return e.dept === 'Kinh doanh' ? '6421' : '6422';
      return { 'Công trường': '622', 'Phòng Kỹ thuật': '627', Kho: '627', 'Kinh doanh': '6421' }[e.dept] || '6422';
    };
    const projects = PROJECTS.map(([code, name, kind, investor, value, start, end, status, contractNo]) => ({ code, name, kind, investor, value: m(value), start, end, status, contractNo, active: true }));
    const prodDefs = COST_PRODUCTS[company.id] || [];
    const costObjects = ind === 'Xây dựng'
      ? PROJECTS.map(([code, name, , , , , , , , unit, done, wipQ, wipPct]) => ({ code, name, kind: 'Công trình', unit, qtyDone: r0(done * f), qtyWip: r0(wipQ * f), pct: wipPct, method: 'SLHTTD', out: '632', item: '', active: true }))
      : prodDefs.map(([code, name, unit, item, done, wipQ, wipPct]) => ({ code, name, kind: 'Sản phẩm', unit, qtyDone: r0(done * f), qtyWip: r0(wipQ * f), pct: wipPct, method: 'SLHTTD', out: '155', item, active: true }));
    const ctCode = (idx) => (idx >= 0 && costObjects[idx % costObjects.length] ? costObjects[idx % costObjects.length].code : '');
    const employees = EMPLOYEES.slice(0, nEmp).map((e) => ({ code: e.code, name: e.name, dept: e.dept, position: e.position, mst: e.mst, deps: e.deps, base: e.base, bhxh: e.bhxh, pc: [...e.pc], contract: [...e.contract], ins: e.ins, tkCp: payAcc(e), ct: production ? ctCode(e.ctIdx) : '', active: true }));
    const cps = CPS.map(([code, name, kind, mst, address]) => ({ code, name, kind, mst, address, active: true }));
    const empCps = EMPLOYEES.slice(0, Math.max(nEmp, 2)).map((e) => ({ code: e.code, name: e.name, kind: 'employee', mst: '', address: e.dept, active: true }));
    cps.push(...empCps);

    const data = {
      regime: company.regime, industry: ind, accounts, cps, entries: [], invoices: [], proposals: [], items: [], assets: [], rules: [], checks: [],
      goods: [], warehouses: [], lots: [], projects, vtypes: VTYPES.map((v) => ({ ...v, tkno: v.code === 'HDCK' ? rg.discount : v.code === 'HTL' ? rg.returnRev : v.tkno })), employees, timesheets: {}, holidays: HOLIDAYS.map((h) => [...h]), advances: [], payrolls: {},
      taxBrackets: TAX_BRACKETS.map((b) => ({ ...b })), params: { ...PAY_PARAMS }, costObjects, wip: {}, norms: {},
      opt: { blockNegStock: true, citRate: 20, allocPool642: false },
      opening: { rows: [], goods: [], wip: [] },
      periods: { '2026-12': { locked: true, lockedBy: 'Hệ thống (nhập từ Smart Pro)', lockedAt: '2026-12-31' }, '2027-01': { locked: false } },
      acks: {}, runs: { depreciation: false, cogs: false, closing: false }, aiEnabled: company.id !== 'c4', aiBudget: 5000000,
      aiUsage: [['2026-11', 412, 286000], ['2026-12', 538, 371000], ['2027-01', 164, 118500]],
      counters: {}, audit: [{ at: '2026-12-31 18:02', who: 'Hệ thống', what: 'Khóa kỳ 12/2026 sau khi nhập dữ liệu Smart Pro' }], lastSync: '2027-01-30 02:00',
    };
    const { entries, invoices, proposals } = data;
    const E_ = (type, no, date, desc, lines, extra = {}) => entries.push({ id: uid('e'), type, no, date, desc, lines, source: extra.source || 'manual', status: 'posted', ref: extra.ref || '', createdBy: extra.by || 'Phạm Quang Cang' });

    /* goods, warehouses, lots */
    const catalog = [...TRADE_GOODS, ...(MAN_GOODS[company.id] || [])];
    const whs = ind === 'Sản xuất' ? [['K01', 'Kho nguyên vật liệu', 'Hoàng Thị Lan'], ['K02', 'Kho thành phẩm', 'Bùi Văn Sơn'], ['K03', 'Kho hàng hóa', 'Ngô Thị Hạnh']]
      : ind === 'Xây dựng' ? [['K01', 'Kho vật tư trung tâm', 'Hoàng Thị Lan'], ['K02', 'Kho công trình Sông Hồng', 'Bùi Văn Sơn']]
        : [['K01', 'Kho chính', 'Hoàng Thị Lan'], ['K02', 'Kho chi nhánh', 'Ngô Thị Hạnh']];
    data.warehouses = whs.map(([code, name, keeper]) => ({ code, name, keeper, active: true }));
    const whMain = (g) => (ind === 'Sản xuất' ? (g.tkKho === '155' ? 'K02' : g.tkKho === '1561' ? 'K03' : 'K01') : 'K01');
    data.goods = catalog.map((g) => ({ code: g.code, name: g.name, group: g.group, unit: g.unit, units: g.units.map(([u, h]) => ({ unit: u, factor: h })), tkKho: g.tkKho, tkDt: g.tkDt || '5111', tkGv: '632', vat: g.vat, method: g.method, lot: g.lot, price: g.price, buyPrice: g.price, active: true }));
    const buyPrice = { HH001: 23300000, HH002: 1600000, HH003: 110000, HH004: 26000000, HH005: 70000, NL001: 14800, NL002: 21500, NL003: 66500, NL101: 17900000, NL102: 39000, NL103: 96000 };
    data.goods.forEach((g) => { if (buyPrice[g.code]) g.buyPrice = buyPrice[g.code]; });
    const openRows = [];
    catalog.forEach((c, i) => {
      const g = data.goods[i]; const q = sq(c.unit, c.qty);
      const wh = whMain(g);
      const parts = ind !== 'Sản xuất' && data.warehouses.length > 1 && g.tkKho === '1561' ? [[wh, 0.75], [data.warehouses[1].code, 0.25]] : [[wh, 1]];
      let left = q;
      parts.forEach(([w, share], k) => {
        const part = k === parts.length - 1 ? left : r0(q * share * dec(c.unit)) / dec(c.unit);
        left = r0((left - part) * dec(c.unit)) / dec(c.unit);
        if (part <= 0) return;
        if (g.lot) {
          const a = r0(part * 0.6 * dec(c.unit)) / dec(c.unit);
          [[`LO-${g.code}-2610`, a], [`LO-${g.code}-2612`, r0((part - a) * dec(c.unit)) / dec(c.unit)]].forEach(([lot, lq]) => { if (lq > 0) openRows.push({ item: g.code, wh: w, lot, qty: lq, val: r0(lq * c.price) }); });
        } else openRows.push({ item: g.code, wh: w, lot: '', qty: part, val: r0(part * c.price) });
      });
    });
    data.opening.goods = openRows;
    const lotExpiry = (g, i) => (g.tkKho === '155' || g.tkKho === '152' ? ['2027-07-31', '2027-11-30'] : ['2028-10-31', '2029-06-30'])[i];
    data.goods.filter((g) => g.lot).forEach((g) => {
      [...new Set(openRows.filter((r) => r.item === g.code).map((r) => r.wh))].forEach((w) => ['2610', '2612'].forEach((mth, i) => data.lots.push({ code: `LO-${g.code}-${mth}`, item: g.code, wh: w, expiry: lotExpiry(g, i) })));
    });

    /* Dec payroll → opening liabilities (334 by employee, 3335, 338x) */
    const fullDec = { paid: PAY_PARAMS.ngayCongChuan, ot: 0 };
    const decRows = employees.map((e) => payRow(e, fullDec, data.params, data.taxBrackets, 0));
    const sum = (k) => decRows.reduce((s, r) => s + r[k], 0);
    const rows = [
      ['1111', 'D', m(85400000)], ['11211', 'D', m(1236750000)], ['11212', 'D', m(412300000)],
      ['131', 'D', m(1520000000), 'KH0001'], ['131', 'D', m(480000000), 'KH0002'], ['131', 'D', m(180000000), 'KH0003'],
      ['2111', 'D', m(1850000000)], ['242', 'D', m(36000000)],
      ['2141', 'C', m(460625000)], ['331', 'C', m(812000000), 'NCC0001'], ['331', 'C', m(245000000), 'NCC0002'], ['331', 'C', m(268600000), 'NCC0003'],
      ['3334', 'C', m(58200000)], ['4111', 'C', m(3000000000)],
      ...decRows.map((r) => ['334', 'C', r.net, r.code]),
      ['3335', 'C', sum('pit')], ['3382', 'C', sum('kpcd')], ['3383', 'C', sum('empBhxh') + sum('coBhxh')], ['3384', 'C', sum('empBhyt') + sum('coBhyt')], [rg.bhtn, 'C', sum('empBhtn') + sum('coBhtn')],
    ].filter((r) => r[2] > 0);
    if (costing) {
      const split = ind === 'Xây dựng' ? [0.4, 0.35, 0.25] : [0.6, 0.4, 0];
      const total = m(ind === 'Xây dựng' ? 210000000 : company.id === 'c5' ? 85000000 : 160000000);
      const mix = { 621: 0.55, 622: 0.2, 623: ind === 'Xây dựng' ? 0.1 : 0, 627: ind === 'Xây dựng' ? 0.15 : 0.25 };
      costObjects.forEach((o, i) => {
        const v = r0(total * (split[i] != null ? split[i] : 0));
        if (!v) return;
        const e = {}; let used = 0;
        ['622', '623', '627'].forEach((a) => { e[a] = r0(v * mix[a]); used += e[a]; });
        e['621'] = v - used; e['154'] = 0;
        data.opening.wip.push({ obj: o.code, e });
      });
    }
    data.opening.rows = rows.map(([acc, side, amt, cp], i) => ({ id: `o${i}`, acc, side, amt, cp: cp || null }));
    const chk = openingCheck(data);
    data.opening.rows.push({ id: 'o-eq', acc: '4211', side: chk.diff > 0 ? 'C' : 'D', amt: Math.abs(chk.diff), cp: null });
    entries.push({ id: uid('e'), type: 'SDDK', no: 'SDDK', date: '2026-12-31', desc: 'Số dư đầu kỳ chuyển từ Smart Pro (đã khớp CĐPS 2026)', lines: openingLines(data), source: 'smartpro_import', status: 'posted', ref: '', createdBy: 'Phạm Quang Cang' });

    /* Jan 2027 postings. Goods lines carry item/wh/qty so stock is always derived from the ledger. */
    const buy = (code, baseQty) => { const g = goodsOf(code, data); const c = catalog.find((x) => x.code === code); const qty = sq(c.unit, baseQty); return { g, qty, price: g.buyPrice, amt: r0(qty * g.buyPrice), wh: whMain(g) }; };
    const issueLine = (date, dr, g, wh, qty, desc, ct) => { const c = issueCost(data, { item: g.code, wh, qty, date }); return L(dr, g.tkKho, c, null, desc, { item: g.code, wh, qty, ct: ct || undefined }); };

    E_('PC', 'PC0001', '2027-01-02', 'Tạm ứng công tác phí – Nguyễn Văn Hùng', [L('141', '1111', m(10000000), 'NV001')]);
    const b1 = buy('HH001', 8);
    E_('HDMV', 'HDMV0001', '2027-01-05', 'Mua thép tấm theo HĐ 00001245', [L('1561', '331', b1.amt, 'NCC0001', 'Tiền hàng', { item: 'HH001', wh: b1.wh, qty: b1.qty }), L('1331', '331', pct(b1.amt, 8), 'NCC0001', 'Thuế GTGT 8%')], { source: 'einvoice', ref: 'inv-1245' });
    if (decRows.length) E_('UNC', 'UNC0001', '2027-01-08', 'Trả lương tháng 12/2026', decRows.map((r) => L('334', '11211', r.net, r.code, `Trả lương tháng 12/2026 – ${r.name}`)), { source: 'bank' });
    const ctRev = costing && ind === 'Xây dựng';
    E_('HD', 'HD0001', '2027-01-08', 'Nghiệm thu đợt 3 – Dự án Sông Hồng Residence, HĐ 0000087', [L('131', '5113', m(850000000), 'KH0001', 'Doanh thu', { ct: 'CT-HL01' }), L('131', '33311', m(85000000), 'KH0001', 'Thuế GTGT 10%', { ct: 'CT-HL01' })], { source: 'einvoice', ref: 'inv-87' });
    E_('TNH', 'TNH0001', '2027-01-10', 'Sông Hồng thanh toán HĐ 0000071', [L('11211', '131', m(620000000), 'KH0001', '', { ct: 'CT-HL01' })], { source: 'bank' });
    E_('UNC', 'UNC0002', '2027-01-12', 'Thanh toán HĐ 00000932 – Xi măng Bắc Sơn', [L('331', '11211', m(245000000), 'NCC0002')], { source: 'bank' });
    E_('CNH', 'CNH0001', '2027-01-12', 'Phí chuyển tiền UNC0002', [L('6422', '11211', 22000)], { source: 'bank' });
    E_('PC', 'PC0002', '2027-01-15', 'Tiền điện, nước văn phòng tháng 12/2026 – HĐ 0004512', [L('6422', '1111', m(3850000), null, 'Tiền dịch vụ'), L('1331', '1111', m(385000), null, 'Thuế GTGT 10%')], { source: 'einvoice', ref: 'inv-4512' });
    const b2 = buy('HH002', 60);
    E_('HDMV', 'HDMV0002', '2027-01-16', 'Mua xi măng PCB40 theo HĐ 00000961', [L('1561', '331', b2.amt, 'NCC0002', 'Tiền hàng', { item: 'HH002', wh: b2.wh, qty: b2.qty }), L('1331', '331', pct(b2.amt, 8), 'NCC0002', 'Thuế GTGT 8%')], { source: 'einvoice', ref: 'inv-961' });
    E_('PT', 'PT0001', '2027-01-18', 'Rút tiền gửi Vietcombank nhập quỹ', [L('1111', '11211', m(50000000))]);
    E_('HD', 'HD0002', '2027-01-20', 'Thi công hạng mục cảnh quan – HĐ 0000091', [L('131', '5113', m(420000000), 'KH0002', 'Doanh thu', { ct: 'CT-HL02' }), L('131', '33311', m(42000000), 'KH0002', 'Thuế GTGT 10%', { ct: 'CT-HL02' })], { source: 'einvoice', ref: 'inv-91' });
    E_('TNH', 'TNH0002', '2027-01-22', 'Ban QLDA Cầu Giấy thanh toán đợt 1', [L('11211', '131', m(300000000), 'KH0002', '', { ct: 'CT-HL02' })], { source: 'bank' });

    /* goods sale (HDBR) with provisional cost, one invoice, three items */
    const sale = [['HH001', 3, 29500000], ['HH002', 20, 1950000], ['HH004', 2, 31000000]].map(([code, q, price]) => { const g = goodsOf(code, data); const qty = sq(g.unit, q); const wh = whMain(g); return { g, qty, price, wh, net: r0(qty * price) }; });
    const saleNet = sale.reduce((s, x) => s + x.net, 0);
    const saleLines = [...sale.map((x) => L('131', x.g.tkDt, x.net, 'KH0003', `${x.g.name} × ${x.qty} ${x.g.unit}`, { item: x.g.code, qty: x.qty, ct: ctRev ? 'CT-HL03' : undefined })), L('131', '33311', pct(saleNet, 10), 'KH0003', 'Thuế GTGT 10%', { ct: ctRev ? 'CT-HL03' : undefined }), ...sale.map((x) => issueLine('2027-01-21', '632', x.g, x.wh, x.qty, `Giá vốn ${x.g.name}`, ctRev ? 'CT-HL03' : ''))];
    E_('HDBR', 'HDBR0001', '2027-01-21', 'Bán vật liệu cho Kiến trúc Nhà Việt – HĐ 0000092', saleLines, { source: 'einvoice', ref: 'inv-92' });

    if (costing) {
      const issues = ind === 'Xây dựng'
        ? [['2027-01-12', 'HH001', 5, 'CT-HL01'], ['2027-01-18', 'HH002', 30, 'CT-HL02'], ['2027-01-22', 'HH003', 400, 'CT-HL03']]
        : company.id === 'c5' ? [['2027-01-12', 'NL001', 3000, 'SP-BQ01'], ['2027-01-14', 'NL002', 1500, 'SP-BQ01'], ['2027-01-18', 'NL001', 1800, 'SP-BQ02'], ['2027-01-20', 'NL003', 300, 'SP-BQ02'], ['2027-01-22', 'BB001', 8000, 'SP-BQ01']]
          : [['2027-01-12', 'NL101', 6, 'SP-CK01'], ['2027-01-14', 'NL102', 300, 'SP-CK01'], ['2027-01-18', 'NL101', 5, 'SP-CK02'], ['2027-01-20', 'NL103', 80, 'SP-CK02']];
      if (ind === 'Sản xuất') {
        const purchases = company.id === 'c5' ? [['NL001', 2000, 'NCC0010'], ['NL003', 400, 'NCC0010']] : [['NL101', 4, 'NCC0001'], ['NL102', 200, 'NCC0001']];
        const bl = purchases.map(([code, q, sp]) => { const b = buy(code, q / f); return { ...b, sp }; });
        E_('PNK', 'PNK0001', '2027-01-06', 'Nhập nguyên vật liệu theo HĐ 00002001', bl.flatMap((b) => [L(b.g.tkKho, '331', b.amt, b.sp, 'Tiền hàng', { item: b.g.code, wh: b.wh, qty: b.qty, lot: b.g.lot ? `LO-${b.g.code}-2612` : undefined }), L('1331', '331', pct(b.amt, b.g.vat), b.sp, `Thuế GTGT ${b.g.vat}%`)]), { source: 'einvoice' });
      }
      issues.forEach(([date, code, q, ct], i) => {
        const g = goodsOf(code, data); const qty = sq(g.unit, q); const wh = whMain(g);
        E_('PXK', `PXK${String(i + 1).padStart(4, '0')}`, date, `Xuất ${g.name} cho ${ct}`, [issueLine(date, '621', g, wh, qty, `Xuất ${g.name} cho ${ct}`, ct)]);
      });
      E_('UNC', 'UNC0003', '2027-01-20', 'Tiền điện, nước xưởng và công trường tháng 12/2026', [L('627', '11211', m(18000000), null, 'Chi phí sản xuất chung')], { source: 'bank' });
    }
    const advances = employees.filter((_, i) => [0, 3, 4].includes(i));
    advances.forEach((e) => {
      const amt = r0(e.base / 2 / 1000000) * 1000000;
      data.advances.push({ id: uid('adv'), emp: e.code, date: '2027-01-15', amt, entryNo: 'UNC0004' });
    });
    if (advances.length) E_('UNC', 'UNC0004', '2027-01-15', 'Ứng lương kỳ 1 tháng 01/2027', data.advances.map((a) => L('334', '11211', a.amt, a.emp, `Ứng lương – ${data.employees.find((e) => e.code === a.emp).name}`)), { source: 'bank' });

    /* timesheets */
    data.timesheets['2027-01'] = {};
    employees.forEach((e, i) => { const sh = defaultSheet('2027-01', data); Object.entries(SHEET_PATCH[i] || {}).forEach(([day, code]) => { sh[Number(day) - 1] = code; }); data.timesheets['2027-01'][e.code] = sh; });

    /* invoices */
    const INV = (id, dir, serial, no, date, party, rate, net, items, status = 'valid', extra = {}) => {
      const vat = Math.round(net * rate / 100);
      invoices.push({ id, dir, serial, no, date, party, rate, net, vat, total: net + vat, items, status, ...extra });
    };
    INV('inv-1245', 'in', '1C27TTP', '00001245', '2027-01-05', 'NCC0001', 8, b1.amt, [['Thép tấm SS400 dày 10mm', 'tấn', b1.qty, b1.price, 'HH001']]);
    INV('inv-4512', 'in', '1C27THL', '0004512', '2027-01-14', 'NCC0008', 10, m(3850000), [['Điện, nước văn phòng tháng 12/2026', 'tháng', 1, m(3850000)]]);
    INV('inv-961', 'in', '1C27TBS', '00000961', '2027-01-16', 'NCC0002', 8, b2.amt, [['Xi măng PCB40 bao 50kg', 'tấn', b2.qty, b2.price, 'HH002']]);
    const b3 = buy('HH003', 530); const b5 = buy('HH004', 12); const b6 = buy('HH005', 120);
    INV('inv-452', 'in', '1C27TDA', '0000452', '2027-01-21', 'NCC0003', 8, b3.amt, [['Gạch ốp lát 60x60 men bóng', 'm²', b3.qty, b3.price, 'HH003']]);
    INV('inv-123987', 'in', '1C27TKN', '0123987', '2027-01-22', 'NCC0005', 8, m(1200000), [['Cước internet cáp quang tháng 01/2027', 'tháng', 1, m(1200000)]]);
    INV('inv-318', 'in', '1C27TTS', '0000318', '2027-01-24', 'NCC0004', 10, m(36000000), [['Thuê máy xúc 0,7m³ kèm người lái', 'ca', 24, m(1500000)]], 'valid', { sellerFlag: 'Người bán đang ở trạng thái "Tạm ngừng hoạt động" trên cổng thuế từ 15/01/2027' });
    INV('inv-2231', 'in', '1C27THH', '0002231', '2027-01-27', 'NCC0006', 10, m(2450000), [['Giấy A4 Double A 70gsm', 'ram', 40, m(42500)], ['Mực in HP 107A', 'hộp', 3, m(250000)]]);
    INV('inv-1302', 'in', '1C27TTP', '00001302', '2027-01-28', 'NCC0001', 8, b5.amt, [['Thép hộp mạ kẽm 50x100x1.8', 'tấn', b5.qty, b5.price, 'HH004']]);
    INV('inv-455', 'in', '1C27TDA', '0000455', '2027-01-29', 'NCC0003', 8, b6.amt, [['Keo dán gạch Weber 25kg', 'bao', b6.qty, b6.price, 'HH005']], 'cancelled', { cancelNote: 'Người bán hủy ngày 30/01/2027, sẽ xuất hóa đơn thay thế' });
    INV('inv-7781', 'in', '1C27TPX', '0007781', '2027-01-19', 'NCC0009', 8, m(520000), [['Suất ăn trưa', 'suất', 8, m(65000)]], 'valid', { ignored: 'Chi phí cá nhân của nhân viên, không hạch toán' });
    INV('inv-87', 'out', '1C27THL', '0000087', '2027-01-08', 'KH0001', 10, m(850000000), [['Nghiệm thu khối lượng đợt 3 – Sông Hồng Residence', 'đợt', 1, m(850000000)]]);
    INV('inv-91', 'out', '1C27THL', '0000091', '2027-01-20', 'KH0002', 10, m(420000000), [['Thi công hạng mục cảnh quan', 'gói', 1, m(420000000)]]);
    INV('inv-92', 'out', '1C27THL', '0000092', '2027-01-21', 'KH0003', 10, saleNet, sale.map((x) => [x.g.name, x.g.unit, x.qty, x.price, x.g.code]));
    INV('inv-94', 'out', '1C27THL', '0000094', '2027-01-28', 'KH0003', 10, m(280000000), [['Thiết kế, thi công nội thất văn phòng', 'gói', 1, m(280000000)]]);

    /* proposals */
    const P = (type, date, desc, cp, lines, source, doc, extra = {}) => proposals.push({ id: uid('p'), type, date, desc, cp, lines, source, doc, status: 'proposed', edited: false, ...extra });
    const bank = (acc, dir, amt, content, date) => ({ kind: 'bank', bank: acc === '11212' ? 'Techcombank' : 'Vietcombank', account: acc, dir, amount: amt, content, date });
    const vatL = (net, rate, cpCode, cr) => L('1331', cr, pct(net, rate), cpCode, `Thuế GTGT ${rate}%`);
    P('HDMV', '2027-01-21', 'Mua gạch ốp lát 60x60 – HĐ 0000452', 'NCC0003', [L('1561', '331', b3.amt, 'NCC0003', 'Tiền hàng', { item: 'HH003', wh: b3.wh, qty: b3.qty }), vatL(b3.amt, 8, 'NCC0003', '331')], { kind: 'rule', label: 'Đông Á · Vật liệu → 1561', ruleId: 'r2' }, { kind: 'invoice', id: 'inv-452' });
    P('HDMV', '2027-01-22', 'Cước internet cáp quang tháng 01/2027 – HĐ 0123987', 'NCC0005', [L('6422', '331', m(1200000), 'NCC0005', 'Tiền dịch vụ'), vatL(m(1200000), 8, 'NCC0005', '331')], { kind: 'rule', label: 'Kết Nối · Dịch vụ → 6422', ruleId: 'r4' }, { kind: 'invoice', id: 'inv-123987' });
    P('TNH', '2027-01-23', 'Kiến trúc Nhà Việt thanh toán HĐ 0000079', 'KH0003', [L('11211', '131', m(154000000), 'KH0003')], { kind: 'ai', label: 'AI', conf: 0.91, reason: 'Nội dung chuyển khoản nhắc HĐ 0000079 của Kiến trúc Nhà Việt; số tiền khớp khoản còn phải thu của hóa đơn này.' }, bank('11211', 'in', m(154000000), 'CT TNHH KIEN TRUC NHA VIET TT HD 0000079', '2027-01-23'), { batch: 'VCB-01' });
    P('CNH', '2027-01-23', 'Phí quản lý tài khoản tháng 01/2027', null, [L('6422', '11211', 55000)], { kind: 'rule', label: 'Sao kê · Phí ngân hàng', ruleId: 'r5' }, bank('11211', 'out', 55000, 'PHI QUAN LY TAI KHOAN THANG 01/2027', '2027-01-23'), { batch: 'VCB-01' });
    P('TNH', '2027-01-25', 'Lãi tiền gửi tháng 01/2027', null, [L('11211', '515', m(1284500))], { kind: 'rule', label: 'Sao kê · Lãi tiền gửi', ruleId: 'r6' }, bank('11211', 'in', m(1284500), 'TRA LAI TIEN GUI THANG 01/2027', '2027-01-25'), { batch: 'VCB-01' });
    const machineTk = ind === 'Xây dựng' ? '623' : production ? '627' : '6422';
    P('HDMV', '2027-01-24', 'Thuê máy xúc công trình Sông Hồng – HĐ 0000318', 'NCC0004', [L(machineTk, '331', m(36000000), 'NCC0004', 'Tiền dịch vụ', ind === 'Xây dựng' ? { ct: 'CT-HL01' } : undefined), vatL(m(36000000), 10, 'NCC0004', '331')], { kind: 'ai', label: 'AI', conf: 0.74, reason: `Chưa có rule cho Cơ giới Trường Sơn. Thuê máy thi công nên đề xuất ghi vào ${machineTk}.` }, { kind: 'invoice', id: 'inv-318' });
    P('UNC', '2027-01-26', 'Trả tiền thuê văn phòng tháng 01/2027 – Ông Trần Quốc Bảo', null, [L('3388', '11211', m(25000000), null)], { kind: 'ai', label: 'AI', conf: 0.68, reason: 'Giống khoản trả tiền thuê nhà cho ông Trần Quốc Bảo các tháng 10–12/2026 (Nợ 3388 / Có 11211).' }, bank('11211', 'out', m(25000000), 'CHUYEN TIEN THUE VAN PHONG T01/2027 TRAN QUOC BAO', '2027-01-26'), { batch: 'VCB-01' });
    P('HDMV', '2027-01-27', 'Mua giấy A4, mực in văn phòng – HĐ 0002231', 'NCC0006', [L('6422', '1111', m(2450000), null, 'Tiền hàng'), vatL(m(2450000), 10, null, '1111')], { kind: 'rule', label: 'Hồng Hà · VPP → 6422', ruleId: 'r3' }, { kind: 'invoice', id: 'inv-2231' });
    P('HDMV', '2027-01-28', 'Mua thép hộp mạ kẽm – HĐ 00001302', 'NCC0001', [L('1561', '331', b5.amt, 'NCC0001', 'Tiền hàng', { item: 'HH004', wh: b5.wh, qty: b5.qty }), vatL(b5.amt, 8, 'NCC0001', '331')], { kind: 'rule', label: 'Tân Phát · Thép → 1561', ruleId: 'r1' }, { kind: 'invoice', id: 'inv-1302' });
    P('HD', '2027-01-28', 'Thiết kế, thi công nội thất văn phòng – HĐ 0000094', 'KH0003', [L('131', '5113', m(280000000), 'KH0003', 'Doanh thu', { ct: 'CT-HL03' }), L('131', '33311', pct(m(280000000), 10), 'KH0003', 'Thuế GTGT 10%', { ct: 'CT-HL03' })], { kind: 'rule', label: 'Mặc định · HĐ bán ra', ruleId: 'r8' }, { kind: 'invoice', id: 'inv-94' });
    P('PT', '2027-01-29', 'Hoàn ứng công tác phí – Nguyễn Văn Hùng', 'NV001', [L('1111', '141', m(1350000), 'NV001')], { kind: 'manual', label: 'Nhập tay · Lê Thị Mai' }, null);
    P('HDMV', '2027-01-29', 'Mua keo dán gạch – HĐ 0000455', 'NCC0003', [L('1561', '331', b6.amt, 'NCC0003', 'Tiền hàng', { item: 'HH005', wh: b6.wh, qty: b6.qty, lot: 'LO-HH005-2612' }), vatL(b6.amt, 8, 'NCC0003', '331')], { kind: 'rule', label: 'Đông Á · Vật liệu → 1561', ruleId: 'r2' }, { kind: 'invoice', id: 'inv-455' });
    P('CNH', '2027-01-30', 'Quảng cáo Facebook 100 USD × 25.400', 'NCC0007', [L('6421', '11212', 2540000)], { kind: 'ai', label: 'AI', conf: 0.86, reason: 'Thanh toán thẻ cho Meta (quảng cáo Facebook). Chi phí bán hàng; nhà cung cấp nước ngoài nên cần kiểm tra thuế nhà thầu.' }, bank('11212', 'out', 2540000, 'FACEBK *ADS 100.00 USD TY GIA 25400', '2027-01-30'), { batch: 'TCB-01', fx: { cur: 'USD', amount: 100, rate: 25400 } });

    const items = data.items;
    const I = (a, cpCode, side, date, ref, amt) => items.push({ id: uid('oi'), acc: a, cp: cpCode, side, date, ref, amt, remaining: amt, matchedBy: null });
    I('131', 'KH0001', 'D', '2026-10-20', 'HĐ 0000064', m(900000000));
    I('131', 'KH0001', 'D', '2026-11-28', 'HĐ 0000071', m(620000000));
    I('131', 'KH0001', 'D', '2027-01-08', 'HĐ 0000087', m(935000000));
    I('131', 'KH0001', 'C', '2027-01-10', 'TNH0001 · TT HĐ 0000071', m(620000000));
    I('131', 'KH0002', 'D', '2026-09-05', 'HĐ 0000059', m(480000000));
    I('131', 'KH0002', 'D', '2027-01-20', 'HĐ 0000091', m(462000000));
    I('131', 'KH0002', 'C', '2027-01-22', 'TNH0002 · TT đợt 1', m(300000000));
    I('131', 'KH0003', 'D', '2026-12-18', 'HĐ 0000079', m(154000000));
    I('131', 'KH0003', 'D', '2026-12-02', 'HĐ 0000075', m(180000000) - m(154000000));
    I('131', 'KH0003', 'D', '2027-01-21', 'HĐ 0000092', saleNet + pct(saleNet, 10));
    I('331', 'NCC0001', 'C', '2026-12-10', 'HĐ 00001198', m(812000000));
    I('331', 'NCC0001', 'C', '2027-01-05', 'HĐ 00001245', b1.amt + pct(b1.amt, 8));
    I('331', 'NCC0002', 'C', '2026-12-20', 'HĐ 00000932', m(245000000));
    I('331', 'NCC0002', 'C', '2027-01-16', 'HĐ 00000961', b2.amt + pct(b2.amt, 8));
    I('331', 'NCC0002', 'D', '2027-01-12', 'UNC0002 · TT HĐ 00000932', m(245000000));
    I('331', 'NCC0003', 'C', '2026-11-25', 'HĐ 0000411', m(268600000));

    const aStatus = (id, name, kind, acc, dep, cost, months, start, alloc, usedBefore) => ({ id, name, kind, acc, dep, cost: m(cost), months, start, alloc, usedBefore, status: 'active' });
    const machineAlloc = ind === 'Xây dựng' ? '623' : production ? '627' : '6422';
    const sxcAlloc = production ? '627' : '6422';
    data.assets = [
      aStatus('A001', 'Máy xúc đào bánh xích 0,7m³', 'TSCĐ', '2111', '2141', 1200000000, 120, '2023-07', [[machineAlloc, 100]], 42),
      aStatus('A002', 'Ô tô bán tải chở vật tư', 'TSCĐ', '2111', '2141', 650000000, 96, '2026-07', [['6422', 100]], 6),
      aStatus('T001', 'Bản quyền phần mềm dự toán (2 năm)', 'Trả trước', '242', '242', 24000000, 24, '2026-07', [['6422', 100]], 6),
      aStatus('T002', 'Giàn giáo thép công trình', 'CCDC', '242', '242', 12000000, 12, '2026-10', [[sxcAlloc, 100]], 3),
      aStatus('T003', 'Bảo hiểm vật chất xe ô tô', 'Trả trước', '242', '242', 12000000, 12, '2026-10', [['6422', 100]], 3),
    ];

    data.rules = [
      { id: 'r1', tier: 1, name: 'Tân Phát · Thép → 1561', cond: { kind: 'in', cp: 'NCC0001', keyword: 'thép' }, tpl: [['D', '1561', 'net'], ['D', '1331', 'vat'], ['C', '331', 'gross']], hits: 14, active: true, version: 3 },
      { id: 'r2', tier: 1, name: 'Đông Á · Vật liệu → 1561', cond: { kind: 'in', cp: 'NCC0003' }, tpl: [['D', '1561', 'net'], ['D', '1331', 'vat'], ['C', '331', 'gross']], hits: 9, active: true, version: 1 },
      { id: 'r3', tier: 1, name: 'Hồng Hà · VPP → 6422', cond: { kind: 'in', cp: 'NCC0006' }, tpl: [['D', '6422', 'net'], ['D', '1331', 'vat'], ['C', '1111', 'gross']], hits: 6, active: true, version: 2 },
      { id: 'r4', tier: 2, name: 'Kết Nối · Dịch vụ → 6422', cond: { kind: 'in', cp: 'NCC0005' }, tpl: [['D', '6422', 'net'], ['D', '1331', 'vat'], ['C', '331', 'gross']], hits: 3, active: true, version: 1 },
      { id: 'r5', tier: 3, name: 'Sao kê · Phí ngân hàng', cond: { kind: 'bank', dir: 'out', keyword: 'phi' }, tpl: [['D', '6422', 'gross'], ['C', 'BANK', 'gross']], hits: 27, active: true, version: 1 },
      { id: 'r6', tier: 3, name: 'Sao kê · Lãi tiền gửi', cond: { kind: 'bank', dir: 'in', keyword: 'lai tien gui' }, tpl: [['D', 'BANK', 'gross'], ['C', '515', 'gross']], hits: 12, active: true, version: 1 },
      { id: 'r7', tier: 3, name: 'Thuê nhà cá nhân · Trần Quốc Bảo', cond: { kind: 'bank', dir: 'out', keyword: 'thue van phong' }, tpl: [['D', '3388', 'gross'], ['C', 'BANK', 'gross']], hits: 0, active: false, version: 1 },
      { id: 'r8', tier: 4, name: 'Mặc định · HĐ bán ra (dịch vụ)', cond: { kind: 'out' }, tpl: [['D', '131', 'gross'], ['C', '5113', 'net'], ['C', '33311', 'vat']], hits: 31, active: true, version: 1 },
      { id: 'r10', tier: 3, name: 'Mặc định · HĐ bán ra có hàng hóa', cond: { kind: 'out', goods: true }, tpl: [['D', '131', 'gross'], ['C', '5111', 'net'], ['C', '33311', 'vat'], ['D', '632', 'cogs'], ['C', '1561', 'cogs']], hits: 0, active: true, version: 1 },
      { id: 'r9', tier: 4, name: 'Mặc định · HĐ mua vào', cond: { kind: 'in' }, tpl: [['D', '1561', 'net'], ['D', '1331', 'vat'], ['C', '331', 'gross']], hits: 18, active: true, version: 1 },
    ];

    data.checks = [
      { id: 'k1', type: 'Hóa đơn đã hủy', severity: 'fail', title: 'HĐ 0000455 của Đông Á đã bị người bán hủy', detail: `Đề xuất ghi sổ ${E.money(b6.amt + pct(b6.amt, 8))} đ từ hóa đơn đã hủy. Không được tính vào chi phí và không được khấu trừ thuế.`, legal: 'Điều 9 NĐ 70/2025/NĐ-CP', link: 'review', status: 'open' },
      { id: 'k2', type: 'Người bán ngừng hoạt động', severity: 'warn', title: 'Cơ giới Trường Sơn đang tạm ngừng hoạt động', detail: `HĐ 0000318 (${E.money(m(36000000) + pct(m(36000000), 10))} đ) lập sau ngày người bán tạm ngừng. Cần xác minh trước khi khấu trừ.`, legal: 'Khoản 1 Điều 14 TT 219/2013/TT-BTC', link: 'invoices', status: 'open' },
      { id: 'k3', type: 'Thuế nhà thầu', severity: 'warn', title: 'Quảng cáo Facebook chưa khai thuế nhà thầu', detail: 'Meta Platforms Ireland đã đăng ký thuế tại Việt Nam qua cổng NCCNN, cần lưu chứng từ thanh toán thẻ.', legal: 'TT 80/2021/TT-BTC, Điều 76–81', link: 'review', status: 'open' },
      { id: 'k4', type: 'Không chứng từ', severity: 'warn', title: 'Tiền thuê nhà ông Trần Quốc Bảo thiếu hợp đồng đính kèm', detail: 'Khoản chi 25.000.000 đ chưa có hợp đồng thuê và chứng từ khai thay thuế của cá nhân.', legal: 'Điều 4 TT 96/2015/TT-BTC', link: 'review', status: 'open' },
    ];

    if (costing) {
      data.norms = Object.fromEntries(costObjects.map((o) => [o.code, ind === 'Xây dựng' ? { 621: 420000, 622: 180000, 623: 90000, 627: 60000 } : company.id === 'c5' ? { 621: 21000, 622: 7000, 627: 5500 } : { 621: 9800000, 622: 2900000, 627: 2100000 }]));
    }
    entries.forEach((e) => { data.counters[e.type] = (data.counters[e.type] || 0) + 1; });
    return data;
  }

  /* ---------- State ---------- */
  const USERS = [
    { name: 'Phạm Quang Cang', initials: 'PC', role: 'ADMIN', payroll: true },
    { name: 'Lê Thị Mai', initials: 'LM', role: 'USER', payroll: true },
    { name: 'Đỗ Minh Tuấn', initials: 'ĐT', role: 'USER', payroll: false },
  ];
  const state = {
    users: USERS,
    user: { ...USERS[0], canAccessSensitive: true },
    companies: COMPANIES,
    companyId: 'c1',
    period: '2027-01',
    data: {},
    route: { view: 'companies', params: {} },
  };
  COMPANIES.forEach((c) => { state.data[c.id] = seed(c); });

  const db = () => state.data[state.companyId];
  const company = () => COMPANIES.find((c) => c.id === state.companyId);
  const rm = (d = db()) => REGIME_MAP[d.regime];
  const acc = (code, d = db()) => d.accounts.find((a) => a.code === code);
  const cp = (code, d = db()) => d.cps.find((c) => c.code === code);
  const cpName = (code) => (code ? (cp(code) || {}).name || code : '');
  const invoice = (id, d = db()) => d.invoices.find((i) => i.id === id);
  const isLocked = (period = state.period, d = db()) => !!(d.periods[period] && d.periods[period].locked);
  const isReadonly = () => !!company().readonly;
  const periodOf = (date) => date.slice(0, 7);
  const kindLabel = { customer: 'Khách hàng', supplier: 'Nhà cung cấp', employee: 'Nhân viên', other: 'Khác' };
  const canPayroll = () => !!state.user.payroll;
  const setUser = (i) => { state.user = { ...USERS[i], canAccessSensitive: USERS[i].payroll }; };

  /* ---------- Validation (runs in the browser, no server round trip) ---------- */
  function validateLines(lines, { period, doc, date } = {}, d = db()) {
    const errors = [];
    if (!lines.length) errors.push({ msg: 'Chứng từ chưa có dòng nào.' });
    lines.forEach((l, i) => {
      ['dr', 'cr'].forEach((side) => {
        const code = l[side];
        const label = side === 'dr' ? 'TK Nợ' : 'TK Có';
        if (!code) { errors.push({ line: i, field: side, msg: `Dòng ${i + 1}: thiếu ${label}.` }); return; }
        const a = acc(code, d);
        if (!a) errors.push({ line: i, field: side, msg: `Dòng ${i + 1}: ${label} ${code} không có trong hệ thống tài khoản.` });
        else if (!a.postable) errors.push({ line: i, field: side, msg: `Dòng ${i + 1}: ${code} là TK tổng hợp, hãy chọn TK chi tiết.` });
        else if (a.cp && !l.cp) errors.push({ line: i, field: 'cp', msg: `Dòng ${i + 1}: TK ${code} bắt buộc chọn đối tượng.` });
      });
      if (!(l.amt > 0)) errors.push({ line: i, field: 'amt', msg: `Dòng ${i + 1}: số tiền phải lớn hơn 0.` });
      if (l.item) {
        const g = goodsOf(l.item, d);
        const stockSide = isStockAcc(l.dr) || isStockAcc(l.cr);
        if (!g) errors.push({ line: i, field: 'item', msg: `Dòng ${i + 1}: mã hàng ${l.item} không có trong danh mục VTHH.` });
        else if (stockSide) {
          if (!l.adj && !l.alloc && !(l.qty > 0)) errors.push({ line: i, field: 'qty', msg: `Dòng ${i + 1}: nhập số lượng hàng ${l.item} lớn hơn 0.` });
          if (!l.wh || !d.warehouses.some((w) => w.code === l.wh)) errors.push({ line: i, field: 'wh', msg: `Dòng ${i + 1}: chọn kho cho hàng ${l.item}.` });
          const sa = isStockAcc(l.dr) ? l.dr : l.cr;
          if (sa !== g.tkKho) errors.push({ line: i, field: 'dr', msg: `Dòng ${i + 1}: TK kho của ${l.item} là ${g.tkKho}, không phải ${sa}.` });
          if (g.lot && !l.lot && isStockAcc(l.dr) && !l.adj && !l.alloc) errors.push({ line: i, field: 'lot', msg: `Dòng ${i + 1}: hàng ${l.item} theo dõi lô, nhập số lô.` });
        }
      }
    });
    if (period && isLocked(period, d)) errors.unshift({ msg: `Kỳ ${E.periodLabel(period)} đã khóa. Mở khóa kỳ ở màn Chốt sổ trước khi ghi.` });
    if (doc && doc.kind === 'invoice') {
      const inv = invoice(doc.id, d);
      if (inv && inv.status === 'cancelled') errors.push({ msg: `HĐ ${inv.no} đã bị người bán hủy. Từ chối đề xuất này.` });
    }
    if (d.opt.blockNegStock && lines.some((l) => l.item && isStockAcc(l.cr) && !l.adj) && !errors.length) {
      stockNegative(d, lines, date || lastDay(period || state.period)).forEach((n) => {
        const g = goodsOf(n.item, d);
        errors.push({ msg: `Xuất ${n.item} (${g ? g.name : ''}) từ kho ${n.wh} vượt tồn ${Number(n.short.toFixed(2)).toLocaleString('vi-VN')} ${g ? g.unit : ''}. Nhập thêm hàng hoặc giảm số lượng xuất.` });
      });
    }
    return errors;
  }

  function proposalWarnings(p, d = db()) {
    const w = [];
    if (p.source.kind === 'ai' && p.source.conf < 0.8) w.push(`Độ tin cậy AI thấp (${String(p.source.conf).replace('.', ',')}). Kiểm tra TK trước khi duyệt.`);
    if (p.fx) w.push('Nhà cung cấp nước ngoài: kiểm tra thuế nhà thầu.');
    if (p.doc && p.doc.kind === 'invoice') {
      const inv = invoice(p.doc.id, d);
      if (inv && inv.sellerFlag) w.push(inv.sellerFlag);
    }
    if (p.sensitive && !canPayroll()) w.push('Đề xuất lương: chỉ người có quyền lương duyệt được.');
    return w;
  }
  const approveBlock = (p) => (p.sensitive && !canPayroll() ? `${state.user.name} không có quyền lương nên không duyệt được đề xuất lương.` : '');

  /* ---------- Posting ---------- */
  function nextNo(type, d = db()) {
    d.counters[type] = (d.counters[type] || 0) + 1;
    return `${type}${String(d.counters[type]).padStart(4, '0')}`;
  }

  function postEntry({ type, date, desc, lines, source, ref, cp: headCp }, d = db()) {
    const entry = { id: uid('e'), type, no: nextNo(type, d), date, desc, lines: lines.map((l) => ({ ...l })), source: source || 'manual', status: 'posted', ref: ref || '', createdBy: state.user.name, cp: headCp || null };
    d.entries.push(entry);
    entry.lines.forEach((l) => {
      ['dr', 'cr'].forEach((side) => {
        if ((l[side] === '131' || l[side] === '331') && l.cp) {
          d.items.push({ id: uid('oi'), acc: l[side], cp: l.cp, side: side === 'dr' ? 'D' : 'C', date, ref: `${entry.no} · ${desc}`, amt: l.amt, remaining: l.amt, matchedBy: null });
        }
      });
    });
    return entry;
  }

  function reverseEntry(id, d = db()) {
    const e = d.entries.find((x) => x.id === id);
    const lines = e.lines.map((l) => ({ ...l, dr: l.cr, cr: l.dr, ct: l.ctCr !== undefined ? l.ctCr : l.ct, ctCr: l.ctCr !== undefined ? l.ct : undefined, adj: l.adj }));
    const rev = postEntry({ type: 'PKT', date: e.date < `${state.period}-01` ? `${state.period}-01` : e.date, desc: `Đảo bút toán ${e.no} – ${e.desc}`, lines, source: 'reversal', ref: e.id }, d);
    e.reversedBy = rev.no;
    return rev;
  }

  function approveProposal(id, d = db()) {
    const p = d.proposals.find((x) => x.id === id);
    const block = approveBlock(p);
    if (block) throw new Error(block);
    if (p.requires) { const dep = d.proposals.find((x) => x.id === p.requires); if (dep && dep.status === 'proposed') approveProposal(dep.id, d); }
    const entry = postEntry({ type: p.type, date: p.date, desc: p.desc, lines: p.lines, source: p.source.kind === 'ai' ? 'ai' : p.doc && p.doc.kind === 'bank' ? 'bank' : p.doc ? 'einvoice' : p.source.kind === 'job' ? 'closing' : 'manual', ref: p.doc && p.doc.id, cp: p.cp }, d);
    p.status = 'posted';
    p.entryNo = entry.no;
    if (p.source.ruleId) { const r = d.rules.find((x) => x.id === p.source.ruleId); if (r) r.hits += 1; }
    return entry;
  }

  /* A cancelled job proposal frees its run flag so the job can run again. Depreciation keeps its original behaviour. */
  function rejectProposal(p, reason, d = db()) {
    p.status = 'rejected'; p.rejectReason = reason;
    const run = p.source.run;
    if (run && run !== 'depreciation' && d.runs[run]) d.runs[run] = false;
    d.proposals.forEach((x) => { if (x.requires === p.id && x.status === 'proposed') { x.status = 'rejected'; x.rejectReason = 'Đề xuất đi kèm đã bị từ chối'; } });
  }
  function purgePending(d, run) {
    d.proposals = d.proposals.filter((p) => !(p.source.run === run && (p.status === 'proposed' || p.status === 'rejected')));
  }

  /* ---------- Balances ---------- */
  function balances(period = state.period, d = db()) {
    const start = `${period}-01`;
    const map = {};
    const get = (code) => (map[code] = map[code] || { openD: 0, openC: 0, psD: 0, psC: 0, byCp: {} });
    const cpGet = (b, c) => (b.byCp[c] = b.byCp[c] || { open: 0, ps: 0 });
    d.entries.forEach((e) => {
      if (e.status !== 'posted') return;
      const isOpen = e.source === 'smartpro_import' || e.date < start;
      if (!isOpen && periodOf(e.date) !== period) return;
      e.lines.forEach((l) => {
        if (l.dr) { const b = get(l.dr); isOpen ? (b.openD += l.amt) : (b.psD += l.amt); if (l.cp) { const c = cpGet(b, l.cp); isOpen ? (c.open += l.amt) : (c.ps += l.amt); } }
        if (l.cr) { const b = get(l.cr); isOpen ? (b.openC += l.amt) : (b.psC += l.amt); if (l.cp) { const c = cpGet(b, l.cp); isOpen ? (c.open -= l.amt) : (c.ps -= l.amt); } }
      });
    });
    return map;
  }

  /* Trial balance rows. level: 'detail' | 'top'. Accounts tracked by counterparty show gross Nợ/Có, not netted. */
  function trialBalance(period = state.period, level = 'detail', d = db()) {
    const b = balances(period, d);
    const split = (n) => (n >= 0 ? [n, 0] : [0, -n]);
    const rowFor = (a, codes) => {
      let openD = 0, openC = 0, psD = 0, psC = 0, endD = 0, endC = 0;
      codes.forEach((code) => {
        const x = b[code]; if (!x) return;
        psD += x.psD; psC += x.psC;
        const ac = acc(code, d);
        if (ac.cp && Object.keys(x.byCp).length) {
          Object.values(x.byCp).forEach((c) => {
            const [od, oc] = split(c.open); openD += od; openC += oc;
            const [ed, ec] = split(c.open + c.ps); endD += ed; endC += ec;
          });
        } else {
          const [od, oc] = split(x.openD - x.openC); openD += od; openC += oc;
          const [ed, ec] = split(x.openD - x.openC + x.psD - x.psC); endD += ed; endC += ec;
        }
      });
      return { code: a.code, name: a.name, postable: a.postable, depth: depth(a, d), openD, openC, psD, psC, endD, endC };
    };
    const leaves = d.accounts.filter((a) => a.postable);
    const used = (a) => leaves.filter((l) => l.code.startsWith(a.code)).some((l) => b[l.code]);
    const list = level === 'top' ? d.accounts.filter((a) => !a.parent) : d.accounts;
    return list.filter(used).map((a) => rowFor(a, leaves.filter((l) => l.code.startsWith(a.code)).map((l) => l.code)));
  }
  const depth = (a, d) => { let n = 0; let p = a.parent; while (p) { n++; p = acc(p, d).parent; } return n; };

  /* Net balance (Dr − Cr) at period end for codes with the given prefix. */
  function net(prefix, period = state.period, d = db(), what = 'end') {
    const b = balances(period, d);
    return Object.entries(b).filter(([c]) => c.startsWith(prefix)).reduce((s, [, x]) => s + (what === 'ps' ? x.psD - x.psC : what === 'psD' ? x.psD : what === 'psC' ? x.psC : x.openD - x.openC + x.psD - x.psC), 0);
  }

  function totals(period = state.period, d = db()) {
    const rows = trialBalance(period, 'top', d);
    return rows.reduce((t, r) => ({ openD: t.openD + r.openD, openC: t.openC + r.openC, psD: t.psD + r.psD, psC: t.psC + r.psC, endD: t.endD + r.endD, endC: t.endC + r.endC }), { openD: 0, openC: 0, psD: 0, psC: 0, endD: 0, endC: 0 });
  }

  /* Ledger lines for an account (and optional counterparty) in a period, with running balance. */
  function ledger(prefix, period = state.period, cpCode = null, d = db()) {
    const b = balances(period, d);
    let open = 0;
    Object.entries(b).forEach(([code, x]) => {
      if (!code.startsWith(prefix)) return;
      if (cpCode) open += (x.byCp[cpCode] || { open: 0 }).open; else open += x.openD - x.openC;
    });
    const rows = [];
    d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && periodOf(e.date) === period)
      .sort((a, z) => a.date.localeCompare(z.date) || a.no.localeCompare(z.no))
      .forEach((e) => e.lines.forEach((l) => {
        if (cpCode && l.cp !== cpCode) return;
        if (l.dr && l.dr.startsWith(prefix)) rows.push({ e, l, contra: l.cr, d: l.amt, c: 0 });
        if (l.cr && l.cr.startsWith(prefix)) rows.push({ e, l, contra: l.dr, d: 0, c: l.amt });
      }));
    let run = open;
    rows.forEach((r) => { run += r.d - r.c; r.bal = run; });
    return { open, rows, end: run };
  }

  /* ---------- Month-end jobs ---------- */
  function monthlyDep(a) { return a.status === 'active' && a.usedBefore < a.months ? Math.round(a.cost / a.months) : 0; }

  function runDepreciation(d = db()) {
    const lines = [];
    d.assets.forEach((a) => {
      const amt = monthlyDep(a); if (!amt) return;
      a.alloc.forEach(([exp, pc]) => lines.push(L(exp, a.dep, Math.round(amt * pc / 100), null, `${a.id} · ${a.name}`)));
    });
    d.proposals.push({ id: uid('p'), type: 'CPCPB', date: `${state.period}-31`, desc: `Khấu hao TSCĐ và phân bổ chi phí trả trước tháng ${E.periodLabel(state.period)}`, cp: null, lines, source: { kind: 'job', label: 'Job · Khấu hao' }, doc: null, status: 'proposed', edited: false });
    d.runs.depreciation = true;
    d.assets.forEach((a) => { if (monthlyDep(a)) a.usedBefore += 1; });
    return lines.length;
  }

  /* Re-prices every issue of the period by its method; only the difference is proposed so cost is never booked twice. */
  function runCogs(d = db()) {
    purgePending(d, 'cogs');
    const plan = stockCostPlan(state.period, d);
    d.runs.cogs = state.period;
    if (plan.lines.length) {
      d.proposals.push({ id: uid('p'), type: 'PXK', date: lastDay(state.period), desc: `Điều chỉnh giá xuất kho tháng ${E.periodLabel(state.period)} (tính giá xuất theo phương pháp của từng mặt hàng)`, cp: null, lines: plan.lines, source: { kind: 'job', label: 'Job · Giá vốn', run: 'cogs' }, doc: null, status: 'proposed', edited: false });
    }
    return { plan, diff: plan.rows.reduce((s, r) => s + r.diff, 0), lines: plan.lines.length };
  }

  const PL_RE = /^(5|63|64|7|8)/;
  const pretaxProfit = (d, period) => {
    const b = balances(period, d);
    return -Object.entries(b).filter(([c]) => PL_RE.test(c) && !c.startsWith(rm(d).cit)).reduce((s, [, x]) => s + x.openD - x.openC + x.psD - x.psC, 0);
  };
  const citRateOf = (d) => Number(d.opt.citRate) || 0;

  /* Step 10: provisional corporate income tax, then every P&L account → 911. */
  function runClosing(d = db()) {
    purgePending(d, 'closing');
    const period = state.period; const rm_ = rm(d); const date = lastDay(period); const label = E.periodLabel(period);
    const b = balances(period, d);
    const bal = {};
    Object.entries(b).forEach(([code, x]) => { if (PL_RE.test(code)) bal[code] = x.openD - x.openC + x.psD - x.psC; });
    const lines = [];
    const revCodes = Object.keys(bal).filter((c) => /^511/.test(c) && bal[c] < 0).sort((x, y) => bal[x] - bal[y]);
    Object.keys(bal).filter((c) => /^521/.test(c) && bal[c] > 0).forEach((c) => {
      const target = revCodes[0] || '5111';
      lines.push(L(target, c, bal[c], null, `Kết chuyển giảm trừ doanh thu ${c}`));
      bal[target] = (bal[target] || 0) + bal[c]; bal[c] = 0;
    });
    const citAcc = rm_.cit;
    const pre = -Object.entries(bal).filter(([c]) => !c.startsWith(rm_.cit)).reduce((s, [, v]) => s + v, 0);
    const booked = Object.entries(bal).filter(([c]) => c.startsWith(rm_.cit)).reduce((s, [, v]) => s + v, 0);
    let taxProposal = null; let tax = booked;
    if (!booked && pre > 0 && citRateOf(d) > 0) {
      tax = r0((pre * citRateOf(d)) / 100);
      taxProposal = { id: uid('p'), type: 'PKT', date, desc: `Thuế TNDN tạm tính ${citRateOf(d)}% tháng ${label}`, cp: null, lines: [L(citAcc, '3334', tax, null, `Thuế TNDN tạm tính ${citRateOf(d)}% × ${E.money(pre)}`)], source: { kind: 'job', label: 'Job · Thuế TNDN', run: 'closing' }, doc: null, status: 'proposed', edited: false };
      d.proposals.push(taxProposal);
      bal[citAcc] = tax;
    }
    let profit = 0;
    Object.entries(bal).forEach(([code, n]) => {
      if (!n) return;
      if (n < 0) { lines.push(L(code, '911', -n, null, `Kết chuyển ${code}`)); profit += -n; } else { lines.push(L('911', code, n, null, `Kết chuyển ${code}`)); profit -= n; }
    });
    if (lines.length) d.proposals.push({ id: uid('p'), type: 'KC', date, desc: `Kết chuyển xác định kết quả kinh doanh tháng ${label}`, cp: null, lines, source: { kind: 'job', label: 'Job · Kết chuyển', run: 'closing' }, doc: null, status: 'proposed', edited: false, requires: taxProposal ? taxProposal.id : undefined });
    d.runs.closing = period;
    return { pre, tax, profit };
  }

  /* Step 11: offset input VAT against output VAT. */
  function runVatKc(d = db()) {
    purgePending(d, 'vat');
    const period = state.period;
    const inV = net('1331', period, d); const outV = -net('33311', period, d);
    const amt = Math.min(inV, outV);
    d.runs.vat = period;
    if (amt <= 0) return { amt: 0 };
    d.proposals.push({ id: uid('p'), type: 'KC', date: lastDay(period), desc: `Kết chuyển thuế GTGT được khấu trừ tháng ${E.periodLabel(period)}`, cp: null, lines: [L('33311', '1331', amt, null, 'Kết chuyển 1331 → 33311')], source: { kind: 'job', label: 'Job · Kết chuyển GTGT', run: 'vat' }, doc: null, status: 'proposed', edited: false });
    return { amt };
  }

  /* Step 12: 911 → 4212. */
  function runProfitKc(d = db()) {
    purgePending(d, 'profit');
    const period = state.period;
    const n = net('911', period, d);
    d.runs.profit = period;
    if (!n) return { profit: 0 };
    const profit = -n;
    d.proposals.push({ id: uid('p'), type: 'KC', date: lastDay(period), desc: `Kết chuyển ${profit > 0 ? 'lãi' : 'lỗ'} sau thuế sang 4212 tháng ${E.periodLabel(period)}`, cp: null, lines: [profit > 0 ? L('911', '4212', profit, null, 'Kết chuyển lãi') : L('4212', '911', -profit, null, 'Kết chuyển lỗ')], source: { kind: 'job', label: 'Job · Kết chuyển lãi lỗ', run: 'profit' }, doc: null, status: 'proposed', edited: false });
    return { profit };
  }

  /* ---------- Close checklist (derived). Prep checks first, then the 13 Smart Pro steps in document order. ---------- */
  const ran = (d, key, period) => d.runs[key] === period || d.runs[key] === true;

  function checklist(d = db(), period = state.period) {
    const pending = d.proposals.filter((p) => p.status === 'proposed' && periodOf(p.date) === period);
    const pendRun = (run) => pending.some((p) => p.source.run === run);
    const invPending = d.invoices.filter((i) => periodOf(i.date) === period && i.status === 'valid' && !i.ignored && invoiceStatus(i, d) !== 'posted');
    const bankPending = pending.filter((p) => p.doc && p.doc.kind === 'bank');
    const cash = ledger('1111', period, null, d);
    const minCash = Math.min(cash.open, ...cash.rows.map((r) => r.bal));
    const openChecks = d.checks.filter((k) => k.status === 'open');
    const t = totals(period, d);
    const unbalanced = Math.abs(t.endD - t.endC) > 0 || Math.abs(t.psD - t.psC) > 0;
    const plLeft = Object.entries(balances(period, d)).filter(([c, x]) => PL_RE.test(c) && x.openD - x.openC + x.psD - x.psC !== 0).length;
    const unmatched = d.items.filter((i) => i.remaining > 0 && ((i.acc === '131' && i.side === 'C') || (i.acc === '331' && i.side === 'D'))).length;
    const vatIn = net('1331', period, d, 'psD');
    const vatOut = net('33311', period, d, 'psC');
    const invVatIn = d.invoices.filter((i) => i.dir === 'in' && invoiceStatus(i, d) === 'posted' && periodOf(i.date) === period).reduce((s, i) => s + i.vat, 0);
    const invVatOut = d.invoices.filter((i) => i.dir === 'out' && invoiceStatus(i, d) === 'posted' && periodOf(i.date) === period).reduce((s, i) => s + i.vat, 0);
    const c = state.companies.find((x) => x.id === state.companyId) || company();
    const m = E.money;

    const ps = payrollState(d, period);
    const hasEmp = d.employees.some((e) => e.active);
    const stockOn = hasModule(c, 'stock'); const costOn = hasModule(c, 'costing') && d.costObjects.length > 0;
    const sv = stockVsLedger(period, d);
    const plan = stockCostPlan(period, d);
        const periodMovesAny = stockMoves(d).some((mv) => mv.date.slice(0, 7) === period && mv.type !== 'SDDK');
    const periodMoves = stockMoves(d).filter((mv) => mv.date.slice(0, 7) === period && mv.type !== 'SDDK');
    const outValue = periodMoves.reduce((x, mv) => x + (mv.kind === 'out' && mv.dr === '632' ? mv.amt : mv.kind === 'in' && mv.cr === '632' ? -mv.amt : 0), 0);
    const cogsLedger = d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && periodOf(e.date) === period && e.type !== 'KC' && e.type !== 'KCGT')
      .reduce((x, e) => x + e.lines.reduce((y, l) => y + (l.dr === '632' ? l.amt : 0) - (l.cr === '632' ? l.amt : 0), 0), 0);
    const manual632 = cogsLedger - outValue;
    const matrix = costOn ? costMatrix(period, d) : null;
    const costLeft = costOn ? rm(d).elements.reduce((s, a) => s + net(a, period, d), 0) : 0;
    const costStuck = costOn ? ['621', '622', '623', '627'].reduce((s, a) => s + matrix.unassigned.el[a], 0) : 0;
    const costIncurred = costOn ? matrix.rows.some((r) => r.total) : false;
    const fxBal = (d.fxAccounts || []).length;
    const badEntries = d.entries.filter((e) => e.status === 'posted' && e.source !== 'smartpro_import' && periodOf(e.date) === period).reduce((s, e) => s + e.lines.filter((l) => [l.dr, l.cr].some((code) => !acc(code, d) || !acc(code, d).postable)).length, 0);
    const opening = openingCheck(d);
    const vatMove = Math.min(net('1331', period, d), -net('33311', period, d));
    const n911 = net('911', period, d);

    const steps = [
      { id: 's1', group: 'prep', title: 'Hóa đơn điện tử khớp sổ', ok: invPending.length === 0, warn: true, detail: invPending.length ? `${invPending.length} hóa đơn hợp lệ chưa ghi sổ (đang chờ duyệt hoặc chưa xử lý).` : 'Mọi hóa đơn hợp lệ trong kỳ đã có bút toán.', link: 'invoices', linkLabel: 'Mở hóa đơn' },
      { id: 's2', group: 'prep', title: 'Sao kê ngân hàng đã xử lý hết', ok: bankPending.length === 0, detail: bankPending.length ? `${bankPending.length} dòng sao kê đang chờ duyệt.` : 'Mọi dòng sao kê đã ghi sổ.', link: 'review', linkLabel: 'Duyệt sao kê', params: { source: 'bank' } },
      !hasEmp
        ? { id: 's3', group: 'prep', title: 'Lương và bảo hiểm', skip: true, detail: 'Công ty chưa khai báo nhân viên nên không có bảng lương kỳ này.', link: 'staff', linkLabel: 'Mở nhân viên' }
        : { id: 's3', group: 'prep', title: 'Lương và bảo hiểm', ok: ps.payroll && ps.accrued && !ps.accruePending, detail: !ps.payroll ? 'Chưa tạo bảng lương kỳ này.' : !ps.accrueAny ? 'Bảng lương đã tạo, chưa ghi sổ.' : ps.accruePending ? 'Đề xuất ghi sổ lương đang chờ duyệt.' : `Bảng lương đã ghi sổ${ps.paid ? ' và đã chi lương' : ', chưa chi lương'}.`, link: 'payroll', linkLabel: 'Mở bảng lương' },
      { id: 's6', group: 'prep', title: 'Kiểm tra chi phí hợp lý', ok: openChecks.length === 0, warn: !openChecks.some((k) => k.severity === 'fail'), detail: openChecks.length ? `${openChecks.length} mục cần xử lý (${openChecks.filter((k) => k.severity === 'fail').length} lỗi).` : 'Không còn mục cần xử lý.', link: 'checks', linkLabel: 'Mở kiểm tra' },
      { id: 's7', group: 'prep', title: 'Đối chiếu công nợ', ok: unmatched === 0, warn: true, detail: unmatched ? `${unmatched} khoản thanh toán chưa khớp với hóa đơn.` : 'Mọi khoản thanh toán đã khớp hóa đơn.', link: 'ar', linkLabel: 'Mở công nợ' },
      { id: 's9', group: 'prep', title: 'Tiền mặt không âm', ok: minCash >= 0, detail: minCash >= 0 ? `Số dư quỹ thấp nhất trong kỳ ${m(minCash)} đ.` : `Quỹ bị âm ${m(minCash)} đ.`, link: 'books', linkLabel: 'Sổ quỹ', params: { tab: 'cash' } },

      { id: 'p1', group: 'doc', docNo: '1', title: 'Xử lý số dư các danh mục', ok: !opening.diff && !sv.bad.length && !sv.neg.length, detail: opening.diff ? `Số dư đầu kỳ lệch Nợ/Có ${m(Math.abs(opening.diff))} đ.` : sv.bad.length ? `Tồn kho lệch sổ TK ${sv.bad.map((x) => `${x.code} (kho ${m(x.goodsVal)} / sổ ${m(x.gl)})`).join(', ')}.` : sv.neg.length ? `${sv.neg.length} dòng tồn kho âm.` : 'Số dư đầu kỳ cân, tồn kho khớp sổ các TK 152/153/155/156.', link: sv.bad.length || sv.neg.length ? 'stock' : 'opening', linkLabel: sv.bad.length || sv.neg.length ? 'Mở tồn kho' : 'Mở số dư đầu kỳ' },
      { id: 's8', group: 'doc', docNo: '2', title: 'Kiểm tra thuế GTGT đầu vào', ok: vatIn === invVatIn, warn: true, detail: vatIn === invVatIn ? `1331 = ${m(vatIn)} đ, khớp bảng kê mua vào.` : `Sổ 1331 ${m(vatIn)} đ / bảng kê ${m(invVatIn)} đ.`, link: 'reports', linkLabel: 'Xem tờ khai', params: { tab: 'vat' } },
      { id: 'p3', group: 'doc', docNo: '3', title: 'Kiểm tra thuế GTGT đầu ra', ok: vatOut === invVatOut, warn: true, detail: vatOut === invVatOut ? `33311 = ${m(vatOut)} đ, khớp bảng kê bán ra.` : `Sổ 33311 ${m(vatOut)} đ / bảng kê ${m(invVatOut)} đ.`, link: 'reports', linkLabel: 'Xem tờ khai', params: { tab: 'vat' } },
      { id: 'p4', group: 'doc', docNo: '4', title: 'Kiểm tra đối ứng hạch toán', ok: badEntries === 0, detail: badEntries ? `${badEntries} dòng hạch toán dùng TK tổng hợp hoặc TK không tồn tại.` : 'Mọi dòng hạch toán dùng TK chi tiết hợp lệ.', link: 'vouchers', linkLabel: 'Mở chứng từ' },
      { id: 's4', group: 'doc', docNo: '5–6', title: 'Khấu hao TSCĐ và phân bổ CCDC (242)', ok: d.runs.depreciation && !pending.some((p) => p.type === 'CPCPB'), detail: !d.runs.depreciation ? 'Chưa chạy khấu hao tháng này.' : pending.some((p) => p.type === 'CPCPB') ? 'Đã chạy, đề xuất khấu hao đang chờ duyệt.' : 'Đã ghi sổ khấu hao và phân bổ.', link: 'assets', linkLabel: 'Mở tài sản', run: !d.runs.depreciation ? 'depreciation' : null, runLabel: 'Chạy khấu hao' },
      !stockOn && !periodMovesAny
        ? { id: 's5', group: 'doc', docNo: '7', title: 'Xử lý đơn giá xuất kho', skip: true, detail: `Ngành ${c.industry} không theo dõi kho, chi phí ghi thẳng vào 642.` }
        : { id: 's5', group: 'doc', docNo: '7', title: 'Xử lý đơn giá xuất kho, không tồn âm', ok: ran(d, 'cogs', period) && !pendRun('cogs') && !plan.lines.length && !sv.neg.length && !sv.bad.length && Math.abs(manual632) < 1, detail: !ran(d, 'cogs', period) ? 'Chưa tính giá xuất kho tháng này.' : pendRun('cogs') ? 'Đề xuất điều chỉnh giá xuất đang chờ duyệt.' : plan.lines.length ? `Còn ${plan.lines.length} nhóm xuất kho lệch giá tính lại, chạy lại để điều chỉnh.` : sv.neg.length ? `${sv.neg.length} dòng tồn kho âm.` : Math.abs(manual632) >= 1 ? `TK 632 lệch giá trị xuất kho ${m(Math.abs(manual632))} đ (có dòng 632 nhập tay không gắn hàng).` : `Giá xuất đã tính lại, 632 = giá trị xuất kho ${m(outValue)} đ, không tồn âm.`, run: !ran(d, 'cogs', period) ? 'cogs' : null, runLabel: 'Tính giá xuất kho', link: pendRun('cogs') ? 'review' : 'stock', linkLabel: pendRun('cogs') ? 'Duyệt giá vốn' : 'Mở kho' },
      fxBal
        ? { id: 'p8', group: 'doc', docNo: '8', title: 'Chênh lệch tỷ giá cuối kỳ', ok: false, detail: 'Có số dư ngoại tệ nhưng bản này chưa tính chênh lệch tỷ giá.' }
        : { id: 'p8', group: 'doc', docNo: '8', title: 'Chênh lệch tỷ giá cuối kỳ', skip: true, detail: 'Chưa áp dụng: công ty không có số dư ngoại tệ (TK 1122, công nợ ngoại tệ) nên không phát sinh chênh lệch.' },
      !costOn
        ? { id: 'p9', group: 'doc', docNo: '9', title: 'Kết chuyển chi phí 621, 622, 627 sang 154', skip: true, detail: `Ngành ${c.industry} không tính giá thành.` }
        : { id: 'p9', group: 'doc', docNo: '9', title: 'Kết chuyển chi phí 621, 622, 623, 627 sang 154 và tính giá thành', ok: costLeft === 0 && costStuck === 0 && !pendRun('cost') && (!costIncurred || ran(d, 'cost', period)), detail: costStuck > 0 ? `Còn ${m(costStuck)} đ chi phí chung chưa phân bổ cho đối tượng.` : pendRun('cost') ? 'Đề xuất kết chuyển chi phí, giá thành đang chờ duyệt.' : costLeft !== 0 ? `Các TK 621–627 còn ${m(costLeft)} đ chưa kết chuyển.` : costIncurred ? 'Chi phí đã kết chuyển 154, giá thành đã ghi nhận.' : 'Kỳ này không phát sinh chi phí sản xuất.', link: 'costing', linkLabel: 'Mở giá thành', params: costStuck > 0 ? { tab: 'alloc' } : undefined, run: costStuck === 0 && costIncurred && !ran(d, 'cost', period) && !pendRun('cost') ? 'cost' : null, runLabel: 'Kết chuyển chi phí' },
      { id: 's10', group: 'doc', docNo: '10', title: 'Thuế TNDN tạm tính và kết chuyển doanh thu, chi phí sang 911', ok: plLeft === 0 && !pendRun('closing'), detail: plLeft === 0 ? `TK loại 5–8 đã về 0, thuế TNDN tạm tính ${citRateOf(d)}% đã ghi nhận.` : pendRun('closing') ? 'Đề xuất thuế TNDN và kết chuyển đang chờ duyệt.' : `${plLeft} TK doanh thu/chi phí còn số dư.`, run: plLeft && !pendRun('closing') ? 'closing' : null, runLabel: 'Kết chuyển' },
      { id: 'p11', group: 'doc', docNo: '11', title: 'Kết chuyển thuế GTGT được khấu trừ', ok: vatMove <= 0 && !pendRun('vat'), detail: vatMove > 0 ? (pendRun('vat') ? 'Đề xuất kết chuyển GTGT đang chờ duyệt.' : `Còn ${m(vatMove)} đ thuế đầu vào được khấu trừ vào thuế đầu ra.`) : 'Đã khấu trừ hoặc không phát sinh thuế GTGT.', run: vatMove > 0 && !pendRun('vat') ? 'vat' : null, runLabel: 'Kết chuyển GTGT' },
      { id: 'p12', group: 'doc', docNo: '12', title: 'Kết chuyển lãi, lỗ 911 sang 4212', ok: n911 === 0 && plLeft === 0 && !pendRun('profit'), detail: n911 === 0 && plLeft === 0 ? 'TK 911 đã về 0.' : pendRun('profit') ? 'Đề xuất kết chuyển lãi lỗ đang chờ duyệt.' : plLeft ? 'Hoàn tất bước 10 trước.' : `TK 911 còn ${m(Math.abs(n911))} đ.`, run: n911 !== 0 && plLeft === 0 && !pendRun('profit') ? 'profit' : null, runLabel: 'Kết chuyển lãi lỗ' },
      { id: 's11', group: 'doc', docNo: '13', title: 'Cập nhật lại số dư: bảng cân đối phát sinh cân', ok: !unbalanced, detail: unbalanced ? 'Tổng Nợ khác tổng Có.' : `Tổng phát sinh ${m(t.psD)} đ, Nợ = Có.`, link: 'books', linkLabel: 'Xem CĐPS', params: { tab: 'tb' } },
    ];
    steps.forEach((s) => {
      s.state = s.skip ? 'skip' : s.ok ? 'pass' : s.warn ? (d.acks[s.id] ? 'ack' : 'warn') : 'fail';
    });
    const canLock = steps.every((s) => s.state === 'pass' || s.state === 'skip' || s.state === 'ack');
    return { steps, canLock, done: steps.filter((s) => ['pass', 'skip', 'ack'].includes(s.state)).length };
  }

  function invoiceStatus(inv, d = db()) {
    if (inv.ignored) return 'ignored';
    const p = d.proposals.find((x) => x.doc && x.doc.kind === 'invoice' && x.doc.id === inv.id);
    if (d.entries.some((e) => e.ref === inv.id) || (p && p.status === 'posted')) return 'posted';
    if (p && p.status === 'proposed') return 'proposed';
    if (p && p.status === 'rejected') return 'rejected';
    return 'new';
  }

  /* ---------- Rule test (S04 "Thử với chứng từ") ---------- */
  function ruleMatch(doc, d = db()) {
    const text = E.fold(doc.text || '');
    return d.rules.filter((r) => r.active).sort((a, z) => a.tier - z.tier).find((r) => {
      const c = r.cond;
      if (c.kind && c.kind !== doc.kind) return false;
      if (c.cp && c.cp !== doc.cp) return false;
      if (c.dir && c.dir !== doc.dir) return false;
      if (c.goods && !doc.cogs) return false;
      if (c.keyword && !text.includes(E.fold(c.keyword))) return false;
      return true;
    });
  }
  function ruleApply(rule, doc) {
    const amt = { net: doc.net, vat: doc.vat, gross: doc.net + doc.vat, cogs: doc.cogs || 0 };
    return rule.tpl.filter(([, , base]) => amt[base] > 0).map(([side, code, base]) => ({ side, code: code === 'BANK' ? doc.account : code, amt: amt[base] }));
  }

  E.state = state;
  Object.assign(E, {
    db, company, rm, acc, cp, cpName, invoice, isLocked, isReadonly, periodOf, kindLabel, TYPE_NAMES, VTYPES, REGIME_MAP, validateLines, proposalWarnings, postEntry, reverseEntry, approveProposal, approveBlock, rejectProposal, balances, trialBalance, net, totals, ledger,
    runDepreciation, runCogs, runClosing, runVatKc, runProfitKc, runCostTransfer, runCostAlloc, checklist, invoiceStatus, ruleMatch, ruleApply, monthlyDep, L, uidp: uid,
    hasModule, canPayroll, setUser, daysIn, lastDay, pct,
    goodsOf, isStockAcc, lotBalances, stockMoves, stockState, issueCost, stockNegative, stockTable, stockCard, stockCostPlan, stockVsLedger,
    parseCell, sheetStats, defaultSheet, sheetFor, isHoliday, dayOfWeek, pitOf, payRow, advanceOf, createPayroll, payTotals, payFormulas, payrollState, payrollPost, payrollPayout, addAdvance,
    ELEMENTS, ALLOC_KEYS, ctOf, costLines, costNet, costMatrix, costCard, costAllocPlan, revenueByCt, wipOpen, wipClose, pretaxProfit,
    openingLines, openingCheck, saveOpening, STOCK_INDUSTRIES, COSTING_INDUSTRIES, PAY_PARAMS,
  });

  /* Pre-close the locked company so its numbers are real, and empty the read-only company's queue. */
  COMPANIES.forEach((c) => {
    if (!c.lockedAll && !c.readonly) return;
    const prev = state.companyId; state.companyId = c.id;
    const d = db();
    const approveAll = () => d.proposals.filter((p) => p.status === 'proposed').forEach((p) => approveProposal(p.id));
    d.proposals.filter((p) => p.status === 'proposed').forEach((p) => {
      if (p.doc && p.doc.kind === 'invoice' && invoice(p.doc.id).status === 'cancelled') { p.status = 'rejected'; p.rejectReason = 'Hóa đơn đã bị người bán hủy'; return; }
      if (!p.cp && p.lines.some((l) => acc(l.dr).cp || acc(l.cr).cp)) { p.cp = 'CN0001'; p.lines.forEach((l) => { l.cp = 'CN0001'; }); }
      approveProposal(p.id);
    });
    d.checks.forEach((k) => { k.status = k.severity === 'fail' ? 'fixed' : 'dismissed'; k.note = 'Đã xử lý khi chốt kỳ'; });
    if (d.employees.length) { createPayroll(d, state.period); payrollPost(d, state.period); approveAll(); payrollPayout(d, state.period, 'bank'); approveAll(); }
    if (c.lockedAll) {
      runDepreciation(); approveAll();
      runCogs(); approveAll();
      runClosing(); approveAll();
      runVatKc(); approveAll();
      runProfitKc(); approveAll();
      ['s1', 's7', 's8', 'p3'].forEach((s) => { d.acks[s] = 'Đã kiểm tra'; });
      d.periods['2027-01'] = { locked: true, lockedBy: 'Phạm Quang Cang', lockedAt: '2027-02-12' };
    }
    state.companyId = prev;
  });
})(window.EYN);
