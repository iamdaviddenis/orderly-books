/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        t1: 'rgb(var(--t1) / <alpha-value>)',
        t2: 'rgb(var(--t2) / <alpha-value>)',
        t3: 'rgb(var(--t3) / <alpha-value>)',
        t4: 'rgb(var(--t4) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}

