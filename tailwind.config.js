/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'oklch(0.1654 0.0267 266.20 / <alpha-value>)',
        surface: 'oklch(0.2070 0.0380 265.07 / <alpha-value>)',
        'surface-2': 'oklch(0.2466 0.0486 264.47 / <alpha-value>)',
        border: 'oklch(0.2992 0.0567 262.66 / <alpha-value>)',
        accent: 'oklch(0.5461 0.2152 262.88 / <alpha-value>)',
        critical: 'oklch(0.6368 0.2078 25.33 / <alpha-value>)',
        high: 'oklch(0.7049 0.1867 47.60 / <alpha-value>)',
        medium: 'oklch(0.7952 0.1617 86.05 / <alpha-value>)',
        low: 'oklch(0.7227 0.1920 149.58 / <alpha-value>)',
        text: 'oklch(0.9288 0.0126 255.51 / <alpha-value>)',
        muted: 'oklch(0.5544 0.0407 257.42 / <alpha-value>)',
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
