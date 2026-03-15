/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#FDFBF7',
          100: '#F8F4EC',
          200: '#F0EAD8',
          300: '#E5DBC4',
        },
        navy: {
          900: '#0A1628',
          800: '#0D1F38',
          700: '#122844',
          600: '#1A3556',
          500: '#254672',
        },
        teal: {
          600: '#0B6E4F',
          500: '#0D8A63',
          400: '#12A876',
          300: '#1DC98F',
          100: '#D0F4E8',
          50:  '#EAFBF3',
        },
        risk: {
          high:   '#B91C1C',
          medium: '#D97706',
          low:    '#059669',
        },
        border: 'rgba(13,31,56,0.12)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(13,31,56,0.06), 0 4px 16px rgba(13,31,56,0.05)',
        float: '0 8px 32px rgba(13,31,56,0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-up':    'fadeUp 0.5s ease forwards',
        'pulse-ring': 'pulseRing 1.5s ease-in-out infinite',
        'score-fill': 'scoreFill 1s ease forwards',
        'scan':       'scan 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)',    opacity: '1' },
          '50%':      { transform: 'scale(1.08)', opacity: '0.7' },
        },
        scan: {
          '0%':   { top: '-100%' },
          '50%':  { top: '100%' },
          '100%': { top: '-100%' },
        },
      },
    },
  },
  plugins: [],
}
