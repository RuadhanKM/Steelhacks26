/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        chase: {
          blue: '#0060AF',
          darkBlue: '#00438A',
          lightBlue: '#E8F4FD',
          accent: '#117ACA',
          bg: '#F7F9FC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          textPrimary: '#1A202C',
          textSecondary: '#718096',
          textMuted: '#A0AEC0',
          success: '#38A169',
          userBubble: '#0060AF',
          aiBubble: '#F1F5F9',
        },
      },
    },
  },
  plugins: [],
};
