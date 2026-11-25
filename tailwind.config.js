/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indian: {
          terracotta: {
            50: '#FDF6F3',
            100: '#FCEBE4',
            200: '#F9D4C5',
            300: '#F4B49C',
            400: '#E88B69',
            500: '#C85A32', // Primary
            600: '#B14823',
            700: '#8C3619',
            800: '#692A15',
            900: '#481E10',
          },
          navy: {
            50: '#F0F4FA',
            100: '#DFE7F4',
            200: '#BDCEE8',
            300: '#8EB0D8',
            400: '#568AC3',
            500: '#2A63A5',
            600: '#1D4B85',
            700: '#1A2B4C', // Deep ink navy
            800: '#121C31',
            900: '#0C111E',
            950: '#070A12', // Deepest obsidian navy
          },
          gold: {
            50: '#FEFAF0',
            100: '#FDF3DB',
            200: '#FBE3B1',
            300: '#F7CE80',
            400: '#F2B54E',
            500: '#E5A93C', // Warm gold
            600: '#C48723',
            700: '#9B6619',
            800: '#754B14',
            900: '#523310',
          },
          parchment: {
            50: '#FFFFFF',
            100: '#FDFBF7', // Linen background
            200: '#F7F2E9',
            300: '#EFE8D8',
            400: '#DFD4BE',
            500: '#CBBFA4',
            600: '#AFA388',
            700: '#8E8269',
            800: '#6D634E',
            900: '#4D4536',
          },
          emerald: {
            500: '#2D6A4F',
            600: '#1B4332',
          },
          crimson: {
            500: '#A4161A',
            600: '#660708',
          },
          purple: {
            500: '#6A2155',
            600: '#48123A',
          }
        },
        group: {
          brown: '#8B4513',
          lightblue: '#38BDF8',
          pink: '#D946EF',
          orange: '#F97316',
          red: '#EF4444',
          yellow: '#EAB308',
          green: '#22C55E',
          darkblue: '#1E40AF',
        }
      },
      fontFamily: {
        serif: ['Cinzel', 'Playfair Display', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card-warm': '0 4px 16px -2px rgba(139, 69, 19, 0.08), 0 2px 6px -2px rgba(26, 43, 76, 0.05)',
        'board-elevation': '0 20px 40px -10px rgba(72, 30, 16, 0.15), 0 8px 16px -6px rgba(26, 43, 76, 0.1)',
        'token-glow': '0 0 12px rgba(229, 169, 60, 0.6)',
      },
      borderRadius: {
        'ornate': '0.75rem',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-short': 'bounce 0.6s ease-in-out 2',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

