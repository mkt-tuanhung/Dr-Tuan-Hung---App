**Tôi muốn dựng một phần mềm quản lý nội bộ như thế này thế này, với các tính năng**  
1\.  Có các tính năng quản trị dành cho tài khoản admin và tính năng cho người dùng nhân viên, nhân viên và admin sẽ đăng nhập bằng ID và mật khẩu khi tạo tài khoản) đăng nhập chung trên 1 nguồn trang VD: drtuanhung.tech giao diện đăng nhập có 2 phần mục đăng nhập nhân sự và mục đăng nhập cho quản trị

**2\. Cho phép admin tạo nhân sự và phân quyền nhân sự theo chuyên môn**  
 \- Tạo và quản lí nhân sự với các trường khi tạo (ID nhân sự, mật khẩu, họ và tên, vị trí chuyên môn : TELESALE \- điều dưỡng \- marketing \- Media \- sale offline \- CSKH \- Trực page, Lương cơ bản (cạnh nút lương cơ bản sẽ có nút thử việc dành cho nhân sự thử việc khi chọn nút này thì nhân sự thử việc được tính 85% lương cơ bản, đồng thời trong giao diện quản trị danh sách nhân viên phải có nút kết thúc thử việc để hệ thống nhận diện nhân sự đó đã thành nhân sự chính thức và hưởng 100% lương), phụ cấp, số điện thoại.

**3\. Chấm công  check in, nghỉ phép**  
 \- Bảng chấm công được hiển thị theo bảng lịch, nhân sự sẽ điểm danh check in trên bảng lịch đó khi click vào 1 ngày bất kì nhân sự có thể chọn: Check in, xin nghỉ phép (nghỉ cả ngày, nghỉ chiều, nghỉ sáng), xin đi muộn/về sớm (yêu cầu nhập thời gian xin đi muộn về sớm),  
Chú ý chỉ có admin mới được chỉnh sửa bảng chấm công của nhân sự với ngày trong quá khứ, còn tài khoản nhân sự chỉ được check in, xin nghỉ phép… với ngày hiện tại và tương lại.  
**4\. lịch hẹn**  
Module lịch hẹn với các tính năng  
\- THÊM LỊCH HẸN (Quyền chỉ có telesale và sale offline và admin thêm)  
\- TRƯỜNG THÊM LỊCH HẸN gồm các tính năng như ảnh 1  
\- GIAO DIỆN LỊCH HẸN NHƯ ảnh 2, ảnh 3, ảnh 4  
\- KHI THÊM LỊCH HẸN tất cả các vị trí nhân viên đều nhận được lịch hẹn của từng khách,  
\- RIÊNG VỊ TRÍ SALE OFFLINE LÀ VỊ TRÍ TIẾP NHẬN LỊCH HẸN KHÁCH HÀNG DO VẬY HỌ SẼ LÀ NGƯỜI TƯ VẤN, và họ sẽ đánh giá khách hàng BONG \- CỌC \- PHẪU THUẬT  
Nếu chọn CỌC thì sẽ tự động hiển thị bảng nhập gồm các trường cần nhập (Tên khách hàng / ngày cọc / tiền cọc / dịch vụ sử dụng / ngày PT dự kiến)  
Nếu chọn PHẪU THUẬT thì sẽ hiển thị bảng nhập gồm các trường (tên khách hàng/ ngày PT dự kiến /doanh thu /DOANH THU upsale/dịch vụ sử dụng )  
Giao diện hiển thị có biểu đồ hiển thị trực quan và số đếm  
khi click vào chứ "đánh giá" thì GIAO DIỆN NHƯ ẢNH 5 VÀ 6 VÀ 7  
ĐỒNG Thời tự tạo MODULE menu KHÁCH CỌC, KHÁCH PHẪU THUẬT VÀ KHÁCH BONG.  
Để care sát hơn từng trường hợp khách hàng. 

5\. KHÁCH BONG/KHÁCH CỌC  
\- được chuyển từ module LỊCH HẸN SANG  
khi tư vấn xong sale offline đánh giá, nếu thuộc khách hàng bong hoặc khách cọc thì sẽ được chuyển thông tin tới modul này

5\. KPI \- HOA HỒNG  
 \- Do tài khoản quản trị giao được hiển thị trên tài khoản Admin theo từng nhân sự và được hiển thị trong tài khoản của cá nhân nhân sự đó dưới dạng số liệu và đồ thị trực quan

- **Sale Offline:**   
  \- Doanh thu: Do admin nhập liệu lên, trong mục nhập liệu của admin sẽ gán sale offline phụ trách khách hàng từ đó hệ tống sẽ tự động ghi nhận doanh thu cho sale offline đó, KPI doanh thu sẽ do admin giao cho nhân sự trong giao diện làm việc của tk admin.  
  \- Tỉ lệ chốt \= ((Khách làm dịch vụ \+ khách cọc) \- khách bong )/tổng lịch hẹn  
  \- Biều đồ thể hiện tỉ lệ hoàn thành doanh thu theo kpi admin giao  
  \- Biểu đồ thể hiện doanh thu theo các tháng, và tỉ lệ chốt theo các tháng để so sánh  
  \- Danh sách khách bong/Bong/làm dịch vụ: Do sale Offline chuyển trạng thái, từ danh sách lịch hẹn Telesale up lên, sale offline khi tư vấn khách hẹn xong sẽ click vào khách hàng trong danh sách lịch hẹn theo ngày mà Telesale up lên và có nút chuyển trạng thái CỌC / BONG / PHẪU THUẬT  
  Nếu chọn CỌC thì sẽ tự động hiển thị bảng nhập gồm các trường cần nhập (Tên khách hàng / ngày cọc / tiền cọc / dịch vụ sử dụng / ngày PT dự kiến)  
  Nếu chọn PHẪU THUẬT thì sẽ hiển thị bảng nhập gồm các trường (tên khách hàng/ ngày PT dự kiến /doanh thu /DOANH THU upsale/dịch vụ sử dụng )  
  Giao diện hiển thị có biểu đồ hiển thị trực quan và số đếm  
- **Telesale:**   
  \- Tỉ lệ chốt hẹn: Tổng lịch hẹn đã có trong tháng/tổng số điện thoại đã nhận (tổng số điện thoại đã nhận do nhân viên trực page up lên)  
  \- Tổng lịch hẹn: do Telesale nhập liệu lên  
  \- Doanh thu cá nhân: Do admin nhập liệu lên, trong mục nhập liệu của admin sẽ gán Telesale phụ trách khách hàng từ đó hệ tống sẽ tự động ghi nhận doanh thu cho telesale đó  
  \- Biều đồ thể hiện tỉ lệ hoàn thành doanh thu theo kpi admin giao  
  \- Biểu đồ thể hiện doanh thu theo các tháng, và tỉ lệ chốt theo các tháng để so sánh

\- **CSKH:**   
           \- Tổng số khách hàng đã chăm theo ngày (do nhân viên CSKH nhập lên theo ngày)  
          \- Tổng số khách hàng đã chăm theo tháng  (do nhân viên CSKH nhập lên theo ngày)  
           \- Tỉ lệ hài lòng / số khách hàng hài lòng:  (do nhân viên CSKH nhập lên theo ngày)  
          \- Tỉ lệ khách hàng không hài lòng/số khách hàng không hài lòng  (do nhân viên CSKH nhập lên theo ngày)  
**\- TRỰC PAGE:**   
\- TỔNG SỐ TIN NHẮN ĐÃ NHẬN:  
\- TỔNG SỐ ĐIỆN THOẠI ĐÃ XIN ĐƯỢC THEO NGÀY VÀ TỔNG HỢP  
\- TỈ LỆ XIN SỐ : TỔNG SỐ ĐIỆN THOẠI/TỔNG SỐ TIN NHẮN

- **MEDIA:**   
  \- TỔNG SỐ CLIP ĐÃ SẢN XUẤT:  
  \- TỔNG SỐ LIVESTREAM  
  \- TỔNG SỐ LIVESTREAM THEO NGÀY  
  \- CLIP TIKTK VIRAL  
- **MARKETING:**   
  \- NGÂN SÁCH quảng cáo ĐÃ CHI TIÊU (DO nhân viên Marketing nhập theo ngày  
  \- Tổng số điện thoại xin được: Do nhân viên Marketing nhập theo ngày  
  \- Chi phí/số điện thoại xin được:  
  Nhân viên marketing sẽ có giao diện nhập ngân sách theo ngày dạng lịch bảng, khi click vào 1 ngày trong tháng sẽ hiện ra 1 bảng nhập gồm các trường (Ngân sách chạy / Số điện thoại xin được)  
- **ĐIỀU DƯỠNG**  
  \- TỔNG SỐ CA TRỰC ĐÊM : Do nhân sự nhập lên gồm các trường (TÊN KH / NGÀY PHẪU THUẬT)  
  DỊCH VỤ ĐẠI PHẪU  
  \- TỔNG SỐ CA PHỤ 1: Do nhân sự nhập lên gồm các trường(TÊN KH / NGÀY PHẪU THUẬT)  
  \- TỔNG SỐ CA PHỤ 2:Do nhân sự nhập lên gồm các trường (TÊN KH / NGÀY PHẪU THUẬT)  
  \- TỔNG SỐ CA PHỤ 3:Do nhân sự nhập lên gồm các trường (TÊN KH / NGÀY PHẪU THUẬT)  
    
  DỊCH VỤ TIỂU PHẪU  
  \- TỔNG SỐ CA PHỤ 1: Do nhân sự nhập lên gồm các trường(TÊN KH / NGÀY PHẪU THUẬT)  
  \- TỔNG SỐ CA PHỤ 2: Do nhân sự nhập lên gồm các trường(TÊN KH / NGÀY PHẪU THUẬT)  
  \- TỔNG SỐ CA PHỤ 3: Do nhân sự nhập lên gồm các trường (TÊN KH / NGÀY PHẪU THUẬT)


**6\. DOANH THU**  
**gồm các phần**  
**A.** THÔNG KÊ TRỰC QUAN THEO BIỂU ĐỒ   
HIỂN THỊ CÁC CHỈ SỐ NỔI BẬT:  
\- DOANH THU TỔNG ĐÃ GHI NHẬN:  
\- DOANH THU UPSALE GHI NHẬN:  
\- TỔNG SỐ KHÁCH HÀNG:  
\- KHÁCH TỪ ADS:  
\- BIỂU ĐỒ SO SANH NGUỒN KHÁCH HÀNG  
\- BIỂU ĐỒ SO SÁNH NHÓM DỊCH VỤ

**B.** Nhập doanh thu khách hàng  
 GỒM CÁC TRƯỜNG:  
\- NGÀY  
\- HỌ TÊN KHÁCH HÀNG  
\- SĐT KHÁCH HÀNG  
\- THÔNG TIN DỊCH VỤ SỬ DỤNG  
\- NHÓM DỊCH VỤ : HÀM MẶT/BODY/TIỂU PHẪU  
\- NGUỒN KHÁCH : ADS/CTV/NGƯỜI QUEN/CSKH  
\- TỆP KHÁCH HÀNG: KH MỚI/KH CŨ  
\- DOANH THU TỔNG:  
\- DOANH THU UPSALE  
\- SALE PHỤ TRÁCH: cho phép gán nhân viên sale offline đã tạo (phục vụ lấy dữ liệu sau này tính lương và tính kpi  
\- TELESALE PHỤ TRÁCH: cho phép gán nhân viên TELESALE đã tạo (phụC  vụ lấy dữ liệu sau này tính lương và tính kpi  
\- CHI CHÚ THÊM

C. DANH SÁCH DOANH THU KHÁCH HÀNG ĐƯỢC HIỂN THỊ DẠNG THẺ CHO CHUYÊN NGHIỆP  
Sau khi nhập doanh thu khách hàng xong sẽ được hiển thị tại phần này

**7\. BẢNG LƯƠNG**  
Tự động liên kết dữ liệu từ tất cả các module trên để xuất Phiếu lương (Payslip) hàng tháng cho từng người.

* **Công thức tính tự động:** `Lương thực nhận = [Lương cứng + Thưởng ca/Trực đêm + Tiền phụ mổ + % Hoa hồng + thưởng khác] - [Tiền tạm ứng chưa hoàn + Các khoản khấu trừ khác]`  
  `Biểu đồ hiện thị lương các tháng và tăng trưởng`  
  **LƯƠNG CƠ BẢN**  
  \- Dựa vào lương cơ bản khi admin tạo tài khoản đã nhập, dựa vào số công check in sẽ tính được lương cơ bản của nhân sự tới ngày hiện tại trong tháng. (Lưu ý lương cơ bản ứng với 26 công, ví dụ lương cơ bản là 26.000.000đ tức là ứng với 26 ngày công trognt háng đi làm 1 ngày là được 1.000.000đ)  
  **LƯƠNG HOA HỒNG**

**\- nhân viên TRỰC PAGE:** 20.000đ x số điện thoại xin được  
**\- nhân viên TELESALE:**   
           Hoa hồng hẹn khách: 500.000đ x số khách hẹn và làm dịch vụ \+ 250.000đ x số khách hẹn và cọc \+  250.000đ x số khách hẹn và bị bong  
           Hoa hồng doanh thu: 0.5% x Doanh thu (khi doanh thu cá nhân telesale dưới 500.000.000đ), 1% x Doanh thu (khi doanh thu cá nhân telesale từ  500.000.000đ đến dưới 1 tỷ đồng), 1,5% x Doanh thu (khi doanh thu cá nhân telesale từ  1.000.000.000đ đến dưới 1.500.000.000đ)  
**\- nhân viên SALE OFFLINE:**   
            Hoa hồng upsale: 3% x DOANH THU UPSALE (được lấy tại mục KPI của SALE OFFLINE)  
           Hoa hồng doanh thu: : 1% x Doanh thu (khi doanh thu cá nhân telesale dưới 500.000.000đ), 1.5% x Doanh thu (khi doanh thu cá nhân telesale từ  500.000.000đ đến dưới 1 tỷ đồng), 2% x Doanh thu (khi doanh thu cá nhân telesale từ  1.000.000.000đ đến dưới 1.500.000.000đ)  
**\- Nhân viên Media:**   
**\- Nhân viên Điều dưỡng:** 

- THƯỞNG TRỰC ĐÊM: 500.000Đ \* KHÁCH HÀNG  
- THƯỞNG PHỤ MỔ:   
     ĐẠI PHẪU: Phụ 1: 500.000đ x khách hàng, Phụ 2: 250.000đ x khách hàng, phụ 3: 150.000đ x khách hàng  
     TIỂU PHẪU: Phụ 1: 300.000đ x khách hàng, Phụ 2: 150.000đ x khách hàng, phụ 3: 100.000đ x khách hàng

              
8\. Quản lí thu chi tạm ứng của nhân sự

- Mỗi nhân sự của công ty khi tạm ứng 1 khoản tiền trước cho công ty thì sẽ nhập lên trên phần mềm. TẠM ỨNG SẼ ĐƯỢC CHIA T  
- **Form Nhập liệu:** Cho phép ghi nhận các khoản thu/chi. Tích hợp tính năng tải lên hình ảnh minh chứng (bill chuyển khoản, hóa đơn) và ghi chú chi tiết.  
- **Phân loại Chi phí:** Tự động thống kê theo các danh mục: MKT, Vật tư, Văn phòng, v.v.  
- **Quản lý Tạm ứng cá nhân:** Theo dõi luồng tiền tạm ứng của từng nhân sự (Ví dụ: Vũ Minh Dũng).  
  - Hiển thị chi tiết:   
    `Tổng đã chi (Tạm ứng)`  
     `Tổng đã thanh toán (Hoàn ứng)`   
     `Còn thiếu`.  
  - Lưu trữ lịch sử giao dịch chi tiết kèm hình ảnh của từng cá nhân.  
- **Biểu đồ Thống kê:** Cung cấp biểu đồ trực quan mô tả tỷ trọng các khoản thu/chi và biến động dòng tiền.

Khoản tạm ứng sẽ được thống kê trên tài khoản cá nhân nhân sự và được thống kê trên tài khoản admin để admin nắm bắt nhân sự đó đã tạm ứng cho công ty bao nhiêu và có thể xử lí hoàn ứng để clear cho nhân sự.

9\. Thông báo phê duyệt

10\. KÊ TOÁN TÀI CHÍNH DOANH NGHIỆP (phần này của admin và cổ đông, admin cấp quyền và tạo tài khoản cho kế toán cổ đông và có thể phân quyền cho kế toán xem thêm các mục khác trong tài khoản quản trị như doanh thu, thu chi nhân sự…..)  
\- số tiền chuyển khoản nhận/chi theo ngày

| STT | NGÀY | NHẬN TIỀN | SỐ TIỀN | TIỀN MẶT/CK | NGƯỜI BÀN GIAO | GHI CHÚ |
| :---- | :---: | :---: | :---: | :---: | :---: | :---: |

\- số tiền mặt nhận/chi theo ngày

| STT | NGÀY | NHẬN TIỀN | SỐ TIỀN | TIỀN MẶT/CK | NGƯỜI BÀN GIAO | GHI CHÚ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

Biểu đồ hiển thị trực quan dòng tiền nhận/chi theo ngày  
Hiển thị dòng vốn lưu động.

11\. Group cộng đồng, tạo các topic và group   
topic nằm trong group các nhân sự có thể comment, thả tim xác nhận, hình ảnh

12\. Viện phí

13\. Kế toán kho  
\- Xuất nhập vật tư