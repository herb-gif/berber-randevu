/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {colors: {
  mc: {
    black: "#0F0F0F",
    dark: "#1A1A1A",
    bronze: "#C08A5A",
    border: "#E5E7EB",
    white: "#FFFFFF",
  },
},
fontFamily: {
  heading: ["Playfair Display", "serif"],
  body: ["Inter", "system-ui", "sans-serif"],
},
},
  },
  plugins: [],
};
