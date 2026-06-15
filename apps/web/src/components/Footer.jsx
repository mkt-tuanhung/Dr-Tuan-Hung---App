import React from 'react';
import { Activity, Mail, Phone, MapPin } from 'lucide-react';
const Footer = () => {
  return <footer className="mt-auto border-t border-white/10 bg-card/50 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-foreground tracking-tight">PK DR TUẤN HÙNG</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Hệ thống quản lý tài chính và chi phí nội bộ chuyên nghiệp, an toàn và tối ưu cho phòng khám đa khoa.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Liên hệ hỗ trợ</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-3 hover:text-primary transition-colors cursor-pointer">
                <Phone className="h-4 w-4" />
                1900 1234
              </li>
              <li className="flex items-center gap-3 hover:text-primary transition-colors cursor-pointer">
                <Mail className="h-4 w-4" />
                support@medifinance.vn
              </li>
              <li className="flex items-center gap-3 hover:text-primary transition-colors cursor-pointer">
                <MapPin className="h-4 w-4" />
                Tòa nhà Y Tế, Quận 1, TP.HCM
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Liên kết</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><span className="hover:text-primary transition-colors cursor-pointer">Hướng dẫn sử dụng</span></li>
              <li><span className="hover:text-primary transition-colors cursor-pointer">Chính sách bảo mật</span></li>
              <li><span className="hover:text-primary transition-colors cursor-pointer">Điều khoản dịch vụ</span></li>
            </ul>
          </div>

        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MediFinance. Tất cả các quyền được bảo lưu.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">Hệ thống đang hoạt động ổn định</span>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;