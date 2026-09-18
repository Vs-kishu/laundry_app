/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1B2430",
        canvas: "#F5F3EE",
        soap: "#2F6F63",
        soapDark: "#204B43",
        bubble: "#E4E0D3",
        rust: "#B5542A",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
