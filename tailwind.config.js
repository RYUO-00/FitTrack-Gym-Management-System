/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17231f', forest: '#1d3c32', moss: '#2f7055', lime: '#d9ed68',
        canvas: '#f4f6f2', line: '#e5e9e3', muted: '#77817b', panel: '#ffffff',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 2px 12px rgba(23, 35, 31, 0.045)' },
    },
  },
  plugins: [],
};
