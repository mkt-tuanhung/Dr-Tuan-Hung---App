# Nội dung các trang P11–P16, P18. Được exec trong build_pages.py.

TBL_CSS = """table{width:100%;border-collapse:collapse;font-size:12.5px}
td,th{border-bottom:1px solid #E6F0F0;padding:4px 6px;text-align:left}
th{font-size:11.5px;color:#4A5A59;font-weight:700}
tr:last-child td{border-bottom:0}
"""

# ---------- P11 KPI ----------
write("P11-KPI.dc.html", 11, "KPI của tôi", "KPI &amp; Hoa hồng",
      "Chỉ tiêu và hoa hồng <b>ước tính</b> theo từng vị trí. Số chính thức là phiếu lương <b>Đã chốt</b> (trang 10).",
      row(
          phone("kpi", "Màn KPI của Sale", "KPI Sale Offline",
                [(1, 87, 30), (2, 87, 145), (3, 87, 234), (4, 87, 325)]),
          phone("kpi_dd", "Màn KPI của Điều dưỡng", "KPI Điều dưỡng",
                [(5, 87, 79), (6, 87, 161)]),
          steps([
              (1, "Đổi <b>tháng</b> bằng ‹ ›. Dòng nhỏ bên dưới cho biết bạn đang xem KPI của vị trí nào."),
              (2, "<b>Vòng tròn %</b>: mức hoàn thành chỉ tiêu chính của tháng."),
              (3, "Từng <b>chỉ tiêu được giao</b>: số đạt / số giao, kèm thanh tiến độ."),
              (4, "<b>Doanh thu &amp; Hoa hồng</b>: tổng hoa hồng ước tính và chi tiết từng phần."),
              (5, "Điều dưỡng: <b>Tổng hoa hồng ước tính</b> = trực đêm + phụ mổ + phụ mổ đối tác."),
              (6, "Ô đếm: số ca trực đêm, phụ mổ 1/2/3, ca hậu phẫu, tỉ lệ hài lòng."),
          ]),
      ) + """
  <div class="g2">
    <div class="box"><h2>Điều dưỡng</h2>
      <p>Trực đêm: <b>500.000đ</b> / khách</p>
      <table><tr><th></th><th>Phụ mổ 1</th><th>Phụ mổ 2</th><th>Phụ mổ 3</th></tr>
        <tr><td><b>Đại phẫu</b></td><td>500k</td><td>250k</td><td>150k</td></tr>
        <tr><td><b>Tiểu phẫu</b></td><td>300k</td><td>150k</td><td>100k</td></tr></table>
      <p style="margin-top: 5px">Ca hậu phẫu: chỉ đếm số ca.</p>
    </div>
    <div class="box"><h2>Telesale</h2>
      <p>Thưởng doanh thu = DT × <b>A%</b>: 0,5% (&lt; 500tr) · 1% (500tr – &lt; 1 tỷ) · 1,5% (≥ 1 tỷ)</p>
      <p>Thưởng lịch hẹn: phẫu thuật trực tiếp <b>500k</b> · đánh giá bong <b>200k</b> (+300k nếu sau đó phẫu thuật) · đánh giá cọc <b>300k</b> (+200k nếu sau đó phẫu thuật)</p>
    </div>
    <div class="box"><h2>Sale Offline</h2>
      <p>HH doanh thu = (DT − Upsale) × <b>A%</b>: 1% (&lt; 500tr) · 1,5% (500tr – &lt; 1 tỷ) · 2% (≥ 1 tỷ)</p>
      <p>HH upsale = Upsale × <b>B%</b>: 3% (&lt; 50tr) · 4% (50tr – &lt; 100tr) · 5% (≥ 100tr)</p>
    </div>
    <div class="box"><h2>Trực page</h2>
      <p>Hoa hồng = số SĐT quan tâm × <b>20.000đ</b>.</p>
      <p>Gửi <b>Báo cáo số điện thoại trong ngày</b>: mỗi ngày 1 báo cáo, gửi lại sẽ ghi đè. Có nút Import CSV.</p>
    </div>
  </div>
""",
      extra_css=TBL_CSS)

# ---------- P12 Thông báo & Tài khoản ----------
write("P12-TaiKhoan.dc.html", 12, "Thông báo và Tài khoản", "Thông báo &amp; Tài khoản",
      "Bấm chuông để xem tin mới, bấm ảnh đại diện (góc trên phải) để mở Tài khoản.",
      row(
          phone("bell", "Danh sách thông báo", "Thông báo", [(1, 87, 38)]),
          phone("account", "Màn Tài khoản", "Tài khoản",
                [(2, 140, 205), (3, 140, 263), (4, 140, 311), (5, 140, 343), (6, 140, 381)]),
          steps([
              (1, "<b>Thông báo</b>: đơn được duyệt, tạm ứng, lịch làm việc mới, bài viết, clip được chấm điểm… Mở chuông là đánh dấu <b>đã đọc tất cả</b>."),
              (2, "<b>Tài khoản nhận lương</b>: cập nhật ngân hàng + số tài khoản để nhận lương đúng."),
              (3, "<b>Hồ sơ cá nhân</b>: 3 thẻ <b>Cá nhân</b> · <b>Mật khẩu</b> · <b>Bảo mật</b>."),
              (4, "<b>Đổi mật khẩu</b>: tối thiểu 6 ký tự."),
              (5, "<b>Bật thông báo về máy</b>: tin hiện ngay trên điện thoại, kể cả khi không mở app."),
              (6, "<b>Nhận thông báo Telegram</b> qua bot của phòng khám."),
          ]),
      ) + """
  <div class="g2">
    <div class="box"><h2>Mã QR nhận lương</h2><p>Khi đã có ngân hàng và số tài khoản, Hồ sơ cá nhân tự tạo <b>Mã QR nhận lương</b> (VietQR) để kế toán chuyển khoản nhanh, không nhầm số.</p></div>
    <div class="box"><h2>Liên kết Telegram</h2><p>Bấm <b>Nhận thông báo Telegram</b> → app mở bot <b>t.me/TH_app_Bot</b> → bấm <b>Bắt đầu / Start</b> là xong.</p></div>
    <div class="box"><h2>Bảo mật 2 lớp</h2><p>Hồ sơ cá nhân → thẻ <b>Bảo mật</b>: quét mã QR bằng ứng dụng <b>Authenticator</b> trên điện thoại để bật xác thực 2 lớp.</p></div>
    <div class="box"><h2>Sau khi đổi mật khẩu</h2><p>Bạn bị <b>đăng xuất khỏi tất cả thiết bị</b> và cần đăng nhập lại bằng mật khẩu mới.</p></div>
  </div>
  <div class="tip"><b>Không chia sẻ mật khẩu.</b> Mỗi lượt chấm công, đơn từ, phiếu chi đều ghi theo tài khoản của bạn.</div>""")

# ---------- P13 Điều dưỡng ----------
write("P13-DieuDuong.dc.html", 13, "Dành cho Điều dưỡng", "Dành cho Điều dưỡng",
      "Lịch mổ, phân công, vật tư và chăm sóc hậu phẫu — tất cả trong 2 màn.",
      row(
          phone("dd_pt", "Màn Khách Phẫu thuật", "Khách Phẫu thuật",
                [(1, 87, 35), (2, 87, 81), (3, 87, 199), (4, 87, 241)]),
          phone("dd_hp", "Màn Hậu phẫu / CSKH", "Hậu phẫu / CSKH",
                [(5, 87, 76), (6, 87, 122), (7, 92, 299), (8, 139, 299)]),
          steps([
              (1, "Thẻ <b>Khách phòng khám</b> / <b>Mổ Đối Tác</b>; ca mổ xếp theo ngày."),
              (2, "Tìm khách theo tên hoặc số điện thoại."),
              (3, "Mỗi ca: dịch vụ, <b>Phụ mổ</b>, <b>Trực đêm</b>, Telesale / Sale phụ trách. Chỉ <b>Trưởng bộ phận</b> phân công."),
              (4, "<b>Báo cáo Vật tư</b> đã dùng cho ca."),
              (5, "Thẻ <b>Hậu phẫu</b> và <b>CSKH</b>."),
              (6, "Ô đếm: Tổng ca · Theo dõi · Tái khám · Ổn định · Biến chứng."),
              (7, "<b>Gọi</b> khách ngay từ thẻ."),
              (8, "<b>Mở nhật ký</b> để ghi chăm sóc, đổi trạng thái."),
          ]),
      ) + """
  <div class="g2">
    <div class="box"><h2>Mốc chăm sóc hậu phẫu</h2>
      <div class="chips"><span>Ngày 1</span><span>Ngày 2</span><span>Ngày 7</span><span>Ngày 14</span><span>Ngày 30</span></div>
      <p style="margin-top: 8px">Trạng thái: <b>Đang theo dõi</b> · <b>Tái khám</b> (tự tạo lịch tái khám) · <b>Đã ổn định</b> · <b>Có biến chứng</b>.</p>
    </div>
    <div class="warn"><h2>Dấu hiệu cảnh báo — báo bác sĩ ngay</h2>
      Sốt ≥ 38°C · Chảy máu kéo dài · Sưng đau tăng dần · Chảy dịch / mủ · Tê bì kéo dài. Chuyển trạng thái <b>Có biến chứng</b>.
    </div>
    <div class="box"><h2>CSKH</h2><p>Phân loại khách: Hài lòng · Không hài lòng · Bình thường · Tiềm năng · Gặp vấn đề. Gửi mã QR <b>Phiếu đánh giá dịch vụ</b> để khách góp ý.</p></div>
    <div class="box"><h2>Đánh giá dịch vụ</h2><p>Góp ý của khách thành phiếu có <b>trạng thái</b> và <b>mức ưu tiên</b>; theo dõi đến khi xử lý xong.</p></div>
  </div>""")

# ---------- P14 Sale ----------
write("P14-Sale.dc.html", 14, "Dành cho Sale", "Dành cho Sale &amp; Telesale",
      "Lịch hẹn → tư vấn → cọc → phẫu thuật, tất cả trên một luồng.",
      row(
          phone("sale_appt", "Màn Lịch hẹn", "Lịch hẹn",
                [(1, 87, 35), (2, 87, 94), (3, 87, 226), (4, 162, 364)]),
          phone("sale_tv", "Màn Khách tư vấn", "Khách tư vấn",
                [(5, 87, 72), (6, 87, 180), (7, 87, 253)]),
          steps([
              (1, "Thẻ <b>Lịch</b> · <b>Danh sách</b> · <b>Tái khám</b> · <b>Thống kê</b>."),
              (2, "Xem theo <b>Ngày / Tuần / Tháng</b>; bấm <b>Hôm nay</b> để quay lại."),
              (3, "Mỗi lịch: giờ, khách, dịch vụ, màu theo trạng thái. Bấm vào để <b>Tiếp nhận tư vấn</b>."),
              (4, "Nút <b>+</b> để <b>Thêm lịch hẹn</b>."),
              (5, "Số khách, đã cọc, phẫu thuật, điểm AI trong tháng. Sale Offline thấy SĐT đã <b>che bớt</b> (bảo mật)."),
              (6, "Lọc theo kết quả: Tất cả · Đã cọc · Phẫu thuật · Bong."),
              (7, "Bấm khách để mở hồ sơ, <b>Ghi âm</b> và <b>Đánh giá khách</b>."),
          ]),
      ) + """
  <div class="box"><h2>Trạng thái lịch hẹn</h2>
    <div class="chips">
      <span style="background: #FDF1E3; color: #9A5B00">Chờ tư vấn</span><span style="background: #E8F0FB; color: #2457A6">Đã cọc</span>
      <span style="background: #E2F4F3; color: #06686C">Phẫu thuật</span><span style="background: #FDECEC; color: #B42318">Khách bong</span>
      <span>Đã huỷ</span><span style="background: #EFEAFB; color: #5B3FA8">Tái khám</span>
    </div>
  </div>
  <div class="g2">
    <div class="box"><h2>Ghi âm &amp; chấm điểm AI</h2><p>Bấm <b>Ghi âm</b> khi tư vấn; file tự tách mỗi 5 phút — <b>giữ màn hình sáng</b>. AI chấm 1–10: Thiện cảm, Khai thác nhu cầu, Chuyên môn, Xử lý từ chối, Chốt, Thái độ.</p></div>
    <div class="box"><h2>Đánh giá khách</h2><p>Kết thúc tư vấn chọn <b>Bong</b>, <b>Cọc</b> hoặc <b>Phẫu thuật</b>. Khách sẽ chuyển sang đúng danh sách để chăm tiếp.</p></div>
    <div class="box"><h2>Khách Cọc</h2><p>Đang chăm sóc · Đã xét nghiệm xong · Chờ lịch bác sĩ · Khách xin hoãn. Thao tác: <b>Lên phẫu thuật</b>, <b>Hoàn cọc</b>, <b>Hủy cọc</b>.</p></div>
    <div class="box"><h2>Khách Bong</h2><p>Đang chăm sóc · Đã quay lại tư vấn · Làm nơi khác · Hủy hẳn. Thao tác: <b>Quay lại lịch hẹn</b>, <b>Chốt cọc</b>, <b>Chốt phẫu thuật</b>.</p></div>
  </div>
""", sgap=7)

# ---------- P15 Data khách hàng & Marketing ----------
write("P15-DataMarketing.dc.html", 15, "Data khách hàng và Marketing", "Data khách hàng &amp; Marketing",
      "Telesale gọi chăm data; Marketing quản lý clip và tư liệu.",
      row(
          phone("tele_data", "Màn Data khách hàng", "Data khách hàng",
                [(1, 87, 49), (2, 87, 99), (3, 154, 137), (4, 18, 228), (5, 160, 227)]),
          phone("mkt_video", "Màn Video Ads", "Video Ads",
                [(6, 87, 66), (7, 87, 192), (8, 87, 295)]),
          steps([
              (1, "<b>Tổng khách hàng</b> và <b>Cần gọi hôm nay</b>."),
              (2, "Lọc theo <b>giai đoạn</b> của khách."),
              (3, "Nút <b>gọi</b> (kèm số khách cần gọi) mở <b>hàng đợi gọi</b>, gọi lần lượt."),
              (4, "Bấm khách để mở hồ sơ: Lịch sử · Lịch hẹn · Thanh toán · Cuộc gọi · Ghi chú · Thông tin."),
              (5, "Gọi điện / <b>Zalo</b> nhanh; xong bấm <b>Ghi nhận cuộc gọi</b> hoặc <b>Tạo lịch hẹn</b>."),
              (6, "Video Ads: <b>Việc cần xử lý</b> của nhóm."),
              (7, "<b>Bảng điểm Editor</b> tháng theo điểm WIN."),
              (8, "Tìm và lọc clip theo mức điểm, dịch vụ, ngày."),
          ]),
      ) + """
  <div class="g2">
    <div class="box"><h2>Giai đoạn khách (Telesale)</h2>
      <div class="chips"><span>Tiếp cận</span><span>Nóng</span><span>Tiềm năng</span><span>Đã hẹn lịch</span><span>Cọc</span><span>Đã làm dịch vụ</span><span>Sài Gòn</span><span>Chốt Fail</span><span>Mất</span></div>
      <p style="margin-top: 6px">Xem dạng <b>Danh sách</b> hoặc <b>Pipeline</b> (cột theo giai đoạn).</p>
    </div>
    <div class="box"><h2>Kết quả cuộc gọi</h2><p>Nghe máy · Không nghe máy · Máy bận · Hẹn gọi lại · Đang cân nhắc · Từ chối · Sai số.</p><p>Hẹn gọi lại nhanh: <b>Chiều nay</b> · <b>Sáng mai</b> · <b>3 ngày nữa</b> · <b>1 tuần nữa</b>.</p></div>
    <div class="box"><h2>Kho Media (Marketing)</h2><p>Loại source: Before/After · Feedback · Hậu phẫu · Quá trình làm · Tư vấn bác sĩ · Khác. Trạng thái: Chưa dựng → Đang dựng → Đã dựng (hoặc Source lỗi, Cần bổ sung).</p><p>Chú ý nhãn <b>KHÔNG DÙNG HÌNH ẢNH</b> và <b>CHE MẶT</b>.</p></div>
    <div class="box"><h2>Video Ads</h2><p>Thẻ: Tất cả · Đang chạy · Đang duyệt · Đã tắt · Chờ duyệt. Ads <b>Duyệt clip</b>, gán chiến dịch, chấm điểm <b>WIN · Tốt · Trung bình · Tệ</b>.</p><p>Mục <b>Hình ảnh</b>: chỉ xem (designer được tải lên).</p></div>
  </div>""", sgap=7, gap=16)

# ---------- P16 Làm việc nhóm ----------
write("P16-LamViecNhom.dc.html", 16, "Làm việc nhóm", "Làm việc nhóm",
      "Bảng tin chung, phòng họp có AI ghi biên bản, và vài trò chơi nhỏ cho cả nhà.",
      row(
          phone("community", "Màn Cộng đồng", "Cộng đồng",
                [(1, 87, 35), (2, 87, 138), (3, 87, 351)]),
          phone("meetings", "Màn Phòng họp", "Phòng họp",
                [(4, 87, 57), (5, 87, 112), (6, 87, 150)]),
          steps([
              (1, "Chọn bảng tin: <b>Phòng khám</b> (chung) hoặc nhóm bộ phận của bạn."),
              (2, "Viết bài: tiêu đề, chữ đậm / nghiêng, màu; gõ <b>@</b> để tag đồng nghiệp, <b>#SĐT</b> để tag khách; thêm <b>Ảnh</b> rồi <b>Đăng</b>."),
              (3, "<b>Cảm xúc</b> (6 kiểu) và <b>Bình luận</b>, có câu trả lời nhanh."),
              (4, "Phòng họp: số cuộc họp và trạng thái của bạn."),
              (5, "<b>Hỏi kho biên bản (AI)</b>: hỏi lại quyết định, nội dung các cuộc họp cũ."),
              (6, "Lọc: Đang họp · Sắp tới · Đã xong. Nút <b>+</b> để <b>Họp ngay</b> hoặc <b>Lên lịch</b>."),
          ]),
      ) + """
  <div class="box"><h2>AI ghi biên bản cuộc họp</h2>
    <p>Trong cuộc họp bấm <b>Ghi lại cuộc họp</b>. Họp xong AI tự lập biên bản gồm 4 phần:</p>
    <div class="chips" style="margin-top: 6px"><span>Tóm tắt</span><span>Ý chính</span><span>Quyết định</span><span>Việc cần làm</span></div>
  </div>
  <div class="g2">
    <div class="box"><h2>Khi nào dùng Cộng đồng?</h2><p>Thông báo nội bộ, lịch đào tạo, chia sẻ ca đẹp, nhắc việc cho cả nhóm. Người được tag sẽ nhận thông báo.</p></div>
    <div class="box"><h2>Minigame</h2><p><b>Vòng quay</b> may mắn, <b>Dự đoán</b> kết quả trận đấu và <b>Làng Sói</b> — chơi giờ nghỉ cho vui.</p></div>
  </div>
  <div class="tip">Không đăng ảnh khách hàng khi chưa được đồng ý. Ảnh có nhãn <b>CHE MẶT</b> phải che trước khi chia sẻ.</div>""")

# ---------- P17 Trưởng bộ phận ----------
write("P17-TruongBoPhan.dc.html", 17, "Dành cho Trưởng bộ phận", "Dành cho Trưởng bộ phận",
      "Phân công người, chủ trì họp và giữ nhịp cho đội.",
      """  <div class="box"><h2>Ai xử lý việc gì trên app?</h2>
    <table>
      <tr><th>Việc</th><th>Người xử lý</th><th>Ở mục</th></tr>
      <tr><td>Phân công điều dưỡng cho ca mổ</td><td><b>Trưởng bộ phận Điều dưỡng</b>, Admin</td><td>Khách Phẫu thuật</td></tr>
      <tr><td>Phân công chăm sóc hậu phẫu, Import</td><td><b>Trưởng bộ phận Điều dưỡng</b>, CSKH, Admin</td><td>Hậu phẫu / CSKH</td></tr>
      <tr><td>Tạo và chủ trì cuộc họp</td><td><b>Mọi người</b> — người tạo kết thúc / xoá</td><td>Phòng họp</td></tr>
      <tr><td>Duyệt đơn nghỉ, đi muộn, về sớm</td><td>Admin</td><td>Quản lý nhân sự</td></tr>
      <tr><td>Xếp và công bố lịch làm việc</td><td>Admin</td><td>Lịch làm việc / Phân ca</td></tr>
      <tr><td>Giao chỉ tiêu KPI</td><td>Admin</td><td>KPI &amp; Hoa hồng</td></tr>
      <tr><td>Duyệt và hoàn phiếu tạm ứng chi</td><td>Admin, Kế toán</td><td>Tạm ứng chi</td></tr>
    </table>
  </div>
  <div class="g2">
    <div class="box"><h2>Phân công điều dưỡng</h2>
      <ol class="steps">
        <li><span class="n">1</span><span>Vào <b>Khách Phẫu thuật</b>, bấm <b>Đăng ký Phân công</b> (ca chưa có người) hoặc <b>Sửa ca</b>.</span></li>
        <li><span class="n">2</span><span>Chọn loại phẫu thuật, bác sĩ mổ, <b>Phụ mổ 1/2/3</b>, <b>Người trực đêm 1/2</b>, người chăm sóc hậu phẫu, ngày và giờ mổ.</span></li>
        <li><span class="n">3</span><span>Bấm <b>Lưu phân công</b>. Điều dưỡng được phân mới mở được hậu phẫu của ca.</span></li>
        <li><span class="n">4</span><span>Ở <b>Hậu phẫu</b>, bạn thấy tất cả ca và có nút <b>Phân công điều dưỡng</b>, <b>Import</b>.</span></li>
      </ol>
    </div>
    <div class="box"><h2>Chủ trì cuộc họp</h2>
      <ol class="steps">
        <li><span class="n">1</span><span><b>Phòng họp</b> → nút <b>+</b> → <b>Họp ngay</b> hoặc <b>Lên lịch</b>.</span></li>
        <li><span class="n">2</span><span>Bấm <b>Ghi lại cuộc họp</b> để AI lập biên bản: tóm tắt, quyết định, việc cần làm.</span></li>
        <li><span class="n">3</span><span>Chỉ người tạo (hoặc Admin) có nút <b>Kết thúc cuộc họp</b> và <b>Xoá cuộc họp</b>.</span></li>
        <li><span class="n">4</span><span>Đăng việc cần làm lên <b>Cộng đồng</b>, <b>@tag</b> người phụ trách để họ nhận thông báo.</span></li>
      </ol>
    </div>
  </div>
  <div class="box"><h2>Giữ nhịp cho đội mỗi ngày</h2>
    <div class="chips">
      <span>Nhắc chấm công Face ID đầu ca</span><span>Nhắc gửi đơn trước khi nghỉ</span><span>Xem lịch tuần đã công bố</span>
      <span>Theo dõi KPI nhóm</span><span>Kiểm tra ca hậu phẫu có biến chứng</span><span>Đăng thông báo nhóm</span>
    </div>
  </div>
  <div class="tip"><b>Phân công đúng người, đúng vai.</b> Phụ mổ 1/2/3 và trực đêm quyết định hoa hồng của điều dưỡng (trang 11). Cần duyệt đơn hay đổi lịch gấp, nhắn Admin.</div>""",
      extra_css=TBL_CSS)

# ---------- P18 Hỏi đáp ----------
QA = [
    ("Quên mật khẩu?", "Liên hệ Admin <b>0879232666</b> để được cấp lại, rồi tự đổi mật khẩu riêng (trang 12)."),
    ("Đăng nhập máy mới báo chờ duyệt?", "Thiết bị mới cần <b>Admin duyệt</b>. Báo Admin, sau đó đăng nhập lại."),
    ("Face ID không nhận ra?", "Đứng chỗ đủ sáng, nhìn thẳng, bỏ khẩu trang / kính râm, giữ máy ngang mặt. Vẫn lỗi: báo Admin kiểm tra Face ID."),
    ("Quên chấm công / sai giờ?", "Ngày đã qua bạn không tự sửa được. Báo quản lý để kiểm tra và điều chỉnh bảng công."),
    ("Bị muộn bất ngờ?", "Tạo ngay đơn <b>Xin đi muộn</b>, ghi rõ lý do — đơn gửi trước vẫn tốt hơn giải thích sau."),
    ("Lương Tạm tính khác lương Đã chốt?", "Tạm tính thay đổi theo dữ liệu mới. Số chính thức là phiếu <b>Đã chốt</b>."),
    ("KPI chưa có chỉ tiêu?", "Chỉ tiêu do quản lý giao theo tháng. Liên hệ quản lý để được thiết lập."),
    ("Không thấy một mục trong menu?", "Menu hiện theo vai trò của bạn. Cần thêm quyền, hỏi quản lý hoặc Admin."),
    ("Không nhận được thông báo?", "Bật <b>thông báo về máy</b> và liên kết <b>Telegram</b>. iPhone: Thêm app vào Màn hình chính trước."),
    ("Gửi nhầm phiếu tạm ứng chi?", "Phiếu đã gửi không tự xoá được. Báo kế toán để xử lý."),
    ("Mất điện thoại?", "Báo Admin ngay. Đăng nhập máy khác và <b>đổi mật khẩu</b> — mọi thiết bị cũ sẽ bị đăng xuất."),
    ("Thấy lỗi trên app?", "Chụp màn hình, ghi thời điểm và thao tác vừa làm, gửi Admin để sửa nhanh."),
]
qa_html = "\n".join(f'    <div class="qa"><b>{q}</b><span>{a}</span></div>' for q, a in QA)
write("P18-HoiDap.dc.html", 18, "Hỏi đáp và Hỗ trợ", "Hỏi đáp &amp; Hỗ trợ",
      "Những câu hỏi nhân viên hay gặp nhất, và nên liên hệ ai khi cần.",
      f"""  <div class="g2">
{qa_html}
  </div>
  <div class="contact">
    <div><small>Admin hệ thống</small><b>0879232666</b></div>
    <div><small>Bot thông báo</small><b>t.me/TH_app_Bot</b></div>
    <div><small>Công việc hằng ngày</small><b>Quản lý trực tiếp</b></div>
  </div>""",
      extra_css=""".qa{background:#fff;border:1px solid #DCEEED;border-radius:16px;padding:12px 15px;font-size:13px;line-height:1.5;display:flex;flex-direction:column;gap:4px}
.qa b{font-size:14px;color:#06686C}
.contact{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;background:#06686C;border-radius:18px;padding:16px 18px;color:#fff}
.contact small{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;margin-bottom:3px}
.contact b{font-size:16px}
""")
