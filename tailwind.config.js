/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(23, 43, 56, 0.06)',
        lift: '0 18px 45px rgba(23, 43, 56, 0.12)',
      },
      colors: {
        ink: '#172B38',
        muted: '#667780',
        canvas: '#F5F6F2',
        line: '#E7EBE6',
        green: '#278566',
        'green-dark': '#1D6B52',
        'green-soft': '#E7F3EC',
        amber: '#B7791F',
        'amber-soft': '#FFF4DE',
        red: '#B94A48',
        'red-soft': '#FCECEB',
      },
    },
  },
  plugins: [],
};
