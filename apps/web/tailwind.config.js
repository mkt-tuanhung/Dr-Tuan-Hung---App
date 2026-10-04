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
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
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
        // NHẬN DIỆN ETHICS BUSINESS OS — teal trầm (muted) + xám ánh teal.
        // Định nghĩa LẠI thang `teal` và `slate` của Tailwind: ~5.600 lần
        // dùng bg-/text-/border-teal-* và slate-* trong 42 trang tự đổi
        // theo nhận diện mới, không phải sửa tay từng trang.
        // Giá trị gốc nằm ở bảng dưới — tinh chỉnh tại đây là đủ.
        // ============================================================
        teal: {
          50: "#F0F7F6",
          100: "#DDEEEC",
          200: "#BFDFDB",
          300: "#96C9C3",
          400: "#6BB0AA",
          500: "#529C96",
          600: "#468A86", // primary — nút chính
          700: "#3A7471", // hover / chữ nhấn
          800: "#305E5C",
          900: "#284D4B",
          950: "#173130",
        },
        slate: {
          50: "#F6F8F8",
          100: "#EEF2F2",
          200: "#E2E8E8", // đường viền
          300: "#CAD3D3",
          400: "#97A4A5",
          500: "#687778", // chữ phụ (đạt tương phản AA trên nền trắng)
          600: "#4E5C5E",
          700: "#3A4648",
          800: "#253033",
          900: "#172024", // chữ chính
          950: "#0D1417",
        },
        // Glassmorphism theme colors (đồng bộ theo teal mới)
        "glass-primary": "#468A86",
        "glass-primary-soft": "#6BB0AA",
        "glass-accent": "#2563EB",
        "glass-background": "#F3F6F6",
        "glass-card-bg": "rgba(255, 255, 255, 0.78)",
        "glass-card-border": "rgba(70, 138, 134, 0.12)",
        "glass-text": "#172024",
        "glass-muted": "#687778",
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
        card: "0 1px 2px rgba(23, 32, 36, 0.04), 0 6px 20px -8px rgba(40, 77, 75, 0.12)",
        soft: "0 1px 3px rgba(23, 32, 36, 0.05)",
        float: "0 12px 32px -10px rgba(40, 77, 75, 0.25)",
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