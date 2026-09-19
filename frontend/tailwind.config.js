/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        chase: {
          blue: '#2A1848',
          purple600: '#5B3D85',
          darkBlue: '#1D1033',
          lightBlue: '#F1ECF8',
          accent: '#4B3270',
          bg: '#FAF8FC',
          card: '#FFFFFF',
          border: '#D4C8E0',
          textPrimary: '#21152F',
          textSecondary: '#6F647B',
          textMuted: '#A79CAF',
          success: '#38A169',
          userBubble: '#2A1848',
          aiBubble: '#F5F2F8',
        },
      },
    },
  },
  plugins: [],
};
