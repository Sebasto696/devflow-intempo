/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans:    ['DM Sans', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#111111',
          low:     '#0a0a0a',
          high:    '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
}
