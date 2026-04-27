/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090e1a',
        surface: '#0f1729',
        'surface-2': '#152038',
        border: '#1e2d4a',
        accent: '#2563eb',
        critical: '#ef4444',
        high: '#f97316',
        medium: '#eab308',
        low: '#22c55e',
        text: '#e2e8f0',
        muted: '#64748b',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        flash: {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.15)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        feedIn: {
          '0%': { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
          '100%': { backgroundColor: 'transparent' },
        },
        scanline: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        flash: 'flash 1.4s ease-out 1',
        pulse: 'pulse 1.6s ease-in-out infinite',
        slideIn: 'slideIn 0.25s ease-out',
        feedIn: 'feedIn 1.2s ease-out 1',
        scanline: 'scanline 6s linear infinite',
        spin: 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
};
