
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        navbar: {
          DEFAULT: '#2563eb',
          dark: '#1e293b',
        },
      },
    },
  },
  plugins: [],
}