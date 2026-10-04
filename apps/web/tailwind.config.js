/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  // Lớp Ethics ghép tên động (e-shift-${tone}, e-tone-${tone}) phải giữ lại khi build
  safelist: [{ pattern: /^e-(shift|tone)-(peach|success|rose|lavender|sky|neutral|brand|warning|danger|info)$/ }],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'SF Pro Display', 'SF Pro Text', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "#2DD4BF",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // ============================================================
        // NHẬN DIỆN ETHICS BUSINESS OS — lấy CHUẨN từ ethics-bos/design/tokens.json
        // (brand teal #067B7F / #12A4A5, mint #E2F6F5, ink #1B2020).
        // Định nghĩa LẠI thang `teal` và `slate` của Tailwind để mọi trang
        // dùng bg-/text-/border-teal-* và slate-* tự đổi theo.
        // ============================================================
        teal: {
          50: "#E2F6F5",  // mint_050
          100: "#CAE8E9", // teal_100
          200: "#A6D8D9",
          300: "#76C2C3", // teal_300
          400: "#3CA7A9", // teal_500
          500: "#12A4A5", // teal_600
          600: "#067B7F", // teal_800 — nút chính / menu đang chọn
          700: "#06686C", // hover / chữ nhấn
          800: "#075F63", // teal_900
          900: "#064E52",
          950: "#043538",
        },
        slate: {
          50: "#F7FAFA",  // bg_subtle
          100: "#EEF5F5",
          200: "#DCEEED", // line — đường viền
          300: "#C3D3D2",
          400: "#A3ABAA", // ink_400
          500: "#828584", // ink_500 — chữ phụ
          600: "#5B6B6A", // ink_600
          700: "#3D4D4C", // ink_700
          800: "#2A3534",
          900: "#1B2020", // ink_900 — chữ chính
          950: "#111515",
        },
        // ============================================================
        // MÀU PHỤ THEO ETHICS BOS (tokens.json: semantic + accent).
        // Quy mọi tông Tailwind mặc định về 8 tông nhẹ của Ethics để toàn
        // app đồng bộ: success / warning / peach / danger / rose / info / sky / lavender.
        // ============================================================
        success: { 50: "#E3F6EE", 100: "#C9EEDD", 200: "#9FDFC2", 300: "#6BCBA1", 400: "#3DB886", 500: "#18A875", 600: "#0F8A5F", 700: "#0C704D", 800: "#0A5A3E", 900: "#084A33", 950: "#053222" },
        warning: { 50: "#FDF1DE", 100: "#FBE4BE", 200: "#F8D293", 300: "#F5BE66", 400: "#F3B24D", 500: "#F2A93B", 600: "#C27A14", 700: "#9E6210", 800: "#7C4D0D", 900: "#5F3B0A", 950: "#3F2706" },
        peach: { 50: "#FDEEE3", 100: "#FBDDC8", 200: "#F8C9A6", 300: "#F6BC93", 400: "#F4B183", 500: "#E8935C", 600: "#C76B2C", 700: "#A35724", 800: "#80441C", 900: "#613415", 950: "#40220E" },
        danger: { 50: "#FDE8E8", 100: "#FAD0D0", 200: "#F5AAAA", 300: "#F08585", 400: "#EC6D6D", 500: "#E95757", 600: "#D04343", 700: "#AE3535", 800: "#8C2B2B", 900: "#6E2222", 950: "#4A1616" },
        info: { 50: "#E4F0FA", 100: "#CBE2F5", 200: "#A4CDEE", 300: "#79B6E6", 400: "#57A4DF", 500: "#3996D8", 600: "#2471AE", 700: "#1D5C8E", 800: "#184A72", 900: "#123A59", 950: "#0C273C" },
        lavender: { 50: "#EEEAFB", 100: "#E0DAF7", 200: "#CDC3F0", 300: "#BBAFE8", 400: "#A99BE0", 500: "#8F7DD4", 600: "#6B57C2", 700: "#5745A3", 800: "#46377F", 900: "#362B62", 950: "#241D42" },
        emerald: { 50: "#E3F6EE", 100: "#C9EEDD", 200: "#9FDFC2", 300: "#6BCBA1", 400: "#3DB886", 500: "#18A875", 600: "#0F8A5F", 700: "#0C704D", 800: "#0A5A3E", 900: "#084A33", 950: "#053222" }, // -> success
        green: { 50: "#E3F6EE", 100: "#C9EEDD", 200: "#9FDFC2", 300: "#6BCBA1", 400: "#3DB886", 500: "#18A875", 600: "#0F8A5F", 700: "#0C704D", 800: "#0A5A3E", 900: "#084A33", 950: "#053222" }, // -> success
        lime: { 50: "#E3F6EE", 100: "#C9EEDD", 200: "#9FDFC2", 300: "#6BCBA1", 400: "#3DB886", 500: "#18A875", 600: "#0F8A5F", 700: "#0C704D", 800: "#0A5A3E", 900: "#084A33", 950: "#053222" }, // -> success
        amber: { 50: "#FDF1DE", 100: "#FBE4BE", 200: "#F8D293", 300: "#F5BE66", 400: "#F3B24D", 500: "#F2A93B", 600: "#C27A14", 700: "#9E6210", 800: "#7C4D0D", 900: "#5F3B0A", 950: "#3F2706" }, // -> warning
        yellow: { 50: "#FDF1DE", 100: "#FBE4BE", 200: "#F8D293", 300: "#F5BE66", 400: "#F3B24D", 500: "#F2A93B", 600: "#C27A14", 700: "#9E6210", 800: "#7C4D0D", 900: "#5F3B0A", 950: "#3F2706" }, // -> warning
        orange: { 50: "#FDEEE3", 100: "#FBDDC8", 200: "#F8C9A6", 300: "#F6BC93", 400: "#F4B183", 500: "#E8935C", 600: "#C76B2C", 700: "#A35724", 800: "#80441C", 900: "#613415", 950: "#40220E" }, // -> peach
        red: { 50: "#FDE8E8", 100: "#FAD0D0", 200: "#F5AAAA", 300: "#F08585", 400: "#EC6D6D", 500: "#E95757", 600: "#D04343", 700: "#AE3535", 800: "#8C2B2B", 900: "#6E2222", 950: "#4A1616" }, // -> danger
        rose: { 50: "#FDE9EC", 100: "#FAD3DA", 200: "#F6B7C2", 300: "#F2A0AE", 400: "#EE8A9A", 500: "#E06B7F", 600: "#C9485E", 700: "#A63A4D", 800: "#832E3D", 900: "#66232F", 950: "#43171F" }, // -> rose
        pink: { 50: "#FDE9EC", 100: "#FAD3DA", 200: "#F6B7C2", 300: "#F2A0AE", 400: "#EE8A9A", 500: "#E06B7F", 600: "#C9485E", 700: "#A63A4D", 800: "#832E3D", 900: "#66232F", 950: "#43171F" }, // -> rose
        blue: { 50: "#E4F0FA", 100: "#CBE2F5", 200: "#A4CDEE", 300: "#79B6E6", 400: "#57A4DF", 500: "#3996D8", 600: "#2471AE", 700: "#1D5C8E", 800: "#184A72", 900: "#123A59", 950: "#0C273C" }, // -> info
        sky: { 50: "#E6F1FB", 100: "#CFE4F7", 200: "#B1D3F1", 300: "#98C6EC", 400: "#7FB8E6", 500: "#5A9FD6", 600: "#2F78B5", 700: "#275F8F", 800: "#1F4B71", 900: "#183B59", 950: "#10273B" }, // -> sky
        cyan: { 50: "#E6F1FB", 100: "#CFE4F7", 200: "#B1D3F1", 300: "#98C6EC", 400: "#7FB8E6", 500: "#5A9FD6", 600: "#2F78B5", 700: "#275F8F", 800: "#1F4B71", 900: "#183B59", 950: "#10273B" }, // -> sky
        violet: { 50: "#EEEAFB", 100: "#E0DAF7", 200: "#CDC3F0", 300: "#BBAFE8", 400: "#A99BE0", 500: "#8F7DD4", 600: "#6B57C2", 700: "#5745A3", 800: "#46377F", 900: "#362B62", 950: "#241D42" }, // -> lavender
        purple: { 50: "#EEEAFB", 100: "#E0DAF7", 200: "#CDC3F0", 300: "#BBAFE8", 400: "#A99BE0", 500: "#8F7DD4", 600: "#6B57C2", 700: "#5745A3", 800: "#46377F", 900: "#362B62", 950: "#241D42" }, // -> lavender
        indigo: { 50: "#EEEAFB", 100: "#E0DAF7", 200: "#CDC3F0", 300: "#BBAFE8", 400: "#A99BE0", 500: "#8F7DD4", 600: "#6B57C2", 700: "#5745A3", 800: "#46377F", 900: "#362B62", 950: "#241D42" }, // -> lavender
        fuchsia: { 50: "#EEEAFB", 100: "#E0DAF7", 200: "#CDC3F0", 300: "#BBAFE8", 400: "#A99BE0", 500: "#8F7DD4", 600: "#6B57C2", 700: "#5745A3", 800: "#46377F", 900: "#362B62", 950: "#241D42" }, // -> lavender
        // Glassmorphism theme colors (đồng bộ theo teal mới)
        "glass-primary": "#067B7F",
        "glass-primary-soft": "#3CA7A9",
        "glass-accent": "#2563EB",
        "glass-background": "#F3F9F9",
        "glass-card-bg": "rgba(255, 255, 255, 0.78)",
        "glass-card-border": "rgba(70, 138, 134, 0.12)",
        "glass-text": "#1B2020",
        "glass-muted": "#828584",
        "glass-success": "#10B981",
        "glass-warning": "#F59E0B",
        "glass-danger": "#EF4444",
      },
      backgroundColor: {
        glass: "rgba(255, 255, 255, 0.78)",
        "glass-dark": "rgba(15, 118, 110, 0.08)",
      },
      borderColor: {
        glass: "rgba(15, 118, 110, 0.12)",
      },
      backdropBlur: {
        glass: "10px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(40, 77, 75, 0.08)",
        "glass-sm": "0 4px 16px rgba(40, 77, 75, 0.06)",
        // Bóng mềm ám teal kiểu Ethics BOS
        card: "0 8px 24px rgba(7, 95, 99, 0.08)",
        soft: "0 2px 8px rgba(7, 95, 99, 0.06)",
        float: "0 12px 40px rgba(7, 95, 99, 0.14)",
        nav: "0 6px 16px rgba(6, 123, 127, 0.24)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};