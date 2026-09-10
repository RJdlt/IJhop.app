/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: {
        4.5: '1.125rem',
      },
      colors: {
        // IJhop brand
        brand: {
          DEFAULT: '#1D9E75',
          // Donkerder merkgroen voor vlakken met witte tekst erop. Het
          // gewone merkgroen haalt met wit maar 3,4:1 en zakt daarmee door
          // de AA-ondergrens voor kleine tekst; deze tint zit op 5,0:1.
          deep: '#177F5E',
          dark: '#04342C',
        },
        // GVB ferry line colours
        f4: '#E2231A',
        f7: '#009DE0',
        ij: {
          50: '#eef6fb',
          900: '#0b1622',
          950: '#070f18',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Voor de Pontdeal: kort en klein. Geen stuiter, geen confetti; de
        // kaart komt binnen zonder de klok te overstemmen.
        // Alleen opkomen, niet bewegen: de strook staat boven de klok en
        // mag daar niets laten schuiven.
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        dealIn: {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        riseIn: 'riseIn 0.4s ease-out both',
        dealIn: 'dealIn 0.2s ease-out both',
        fadeIn: 'fadeIn 0.2s ease-out both',
      },
    },
  },
  plugins: [],
}
