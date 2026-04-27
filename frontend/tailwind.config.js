/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF5F5',
          100: '#FFE8E8',
          200: '#FFCCCC',
          300: '#F5A0A0',
          400: '#E87070',
          500: '#D64035',
          600: '#C0392B',
          700: '#9B2E23',
          800: '#7A231C',
          900: '#5C1A15',
        },
        warm: {
          50:  '#FDFAF6',
          100: '#FAF5EC',
          200: '#F5EDD9',
          300: '#EAD9C4',
          400: '#D4BFA0',
        },
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
