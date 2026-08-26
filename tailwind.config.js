/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1F4E78',
          accent: '#2E75B6',
        },
        success: '#70AD47',
        warning: '#F4B084',
        danger: '#C00000',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.06)',
        'soft-lg': '0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
