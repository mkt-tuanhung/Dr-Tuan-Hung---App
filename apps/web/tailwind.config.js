/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
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