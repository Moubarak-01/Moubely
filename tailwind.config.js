/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The core "Glass" palette
        "glass-black": "#0a0a0a", // Nearly black background
        "glass-border": "rgba(255, 255, 255, 0.1)", // Subtle white border
        "accent-blue": "#3b82f6", // Primary action color
        "text-secondary": "#a1a1aa", // Muted text
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        // The "Loading" shimmer effect
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "in 0.2s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        in: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"), // Needed for Markdown styling
  ],
}