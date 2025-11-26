/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563eb', // Tu azul
          hover: "#1d4ed8",
          dark: '#1d4ed8',
          light: '#dbeafe',
        },
        secondary: '#10b981', // Tu verde
        dark: '#111827',
      }
    },
  },
  plugins: [],
}