/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Geometric color classes
    'from-ocean-900',
    'from-ocean-800',
    'via-ocean-800',
    'to-geometric-navy',
    'from-geometric-blue',
    'to-geometric-cyan',
    'from-geometric-emerald',
    'to-geometric-green',
    'from-geometric-cyan',
    'to-geometric-blue',
    'bg-geometric-pattern',
    'bg-circuit-pattern',
    'text-gradient-geometric',
    // Opacity variants
    'from-ocean-800/50',
    'via-ocean-800/50',
    'to-geometric-navy/80',
    'via-geometric-navy/20',
    'from-geometric-blue/20',
    'to-geometric-cyan/10',
    'from-geometric-emerald/20',
    'to-geometric-green/10',
    'from-geometric-cyan/20',
    'to-geometric-blue/20',
    'bg-geometric-cyan/30',
    'bg-geometric-emerald/30',
    'bg-geometric-blue/30',
    'bg-geometric-blue/25',
    'bg-geometric-emerald/25',
    'border-geometric-cyan/30',
    'border-geometric-green/30',
    'border-geometric-blue/30',
    'border-geometric-emerald/30',
    'border-geometric-green/20',
    // Animation classes
    'animate-blob',
    'animate-morph',
    'animate-gradient-shift',
    'animate-pulse',
    'animation-delay-2000',
    'animation-delay-4000',
    // Additional classes used
    'bg-gradient-to-br',
    'bg-gradient-to-r',
    'rounded-lg',
    'rounded-full',
    'rotate-45',
    'rotate-3',
    '-rotate-3',
    'rotate-2',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Geometric blue-green color palette
        ocean: {
          50: '#E0F2FE',
          100: '#BAE6FD',
          200: '#7DD3FC',
          300: '#38BDF8',
          400: '#0EA5E9',
          500: '#2980B9',
          600: '#0369A1',
          700: '#075985',
          800: '#0C4A6E',
          900: '#0D1B2A',
          950: '#0D1B2A',
        },
        geometric: {
          blue: '#2196F3',
          cyan: '#38BDF8',
          green: '#4CAF50',
          emerald: '#10B981',
          navy: '#0D1B2A',
        },
        // Modern healthcare/wellness color palette
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#2196F3',
          600: '#1E88E5',
          700: '#1976D2',
          800: '#1565C0',
          900: '#0D47A1',
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
        // Custom wellness colors
        wellness: {
          green: '#4CAF50',
          blue: '#2196F3',
          cyan: '#38BDF8',
          emerald: '#10B981',
        },
        // Status colors
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#2563eb',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-in-out",
        "slide-in": "slide-in 0.3s ease-out",
        "bounce-subtle": "bounce-subtle 2s infinite",
        // Enhanced UI animations
        "blob": "blob 7s infinite",
        "shimmer": "shimmer 2s infinite linear",
        "gradient": "gradient 3s ease infinite",
        "float": "float 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        // Enhanced UI keyframes
        "blob": {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "glow": {
          "from": { boxShadow: "0 0 20px #3b82f6" },
          "to": { boxShadow: "0 0 40px #8b5cf6, 0 0 60px #8b5cf6" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 40px rgba(139, 92, 246, 0.8)" },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
        'large': '0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 20px 25px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '3xl': '0 35px 60px -12px rgba(0, 0, 0, 0.25), 0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        'neon': '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
      },
      animationDelay: {
        '2000': '2s',
        '4000': '4s',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
  ],
}