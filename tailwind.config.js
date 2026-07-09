/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        redlife: {
          bg: '#05060A',
          panel: '#0B0D14',
          ink: '#E8EAF0',
          muted: '#8B8FA3',
          accent: '#FF003C',
          accentDim: '#B3002A',
          // Secondary accent — reserved ONLY for interactive/clickable
          // affordances (link hovers, focus rings, card-hover action cue).
          // Red stays the brand/structural color (wordmark, rim light, borders).
          action: '#00E5FF',
          actionDim: '#0099B3',
          line: 'rgba(255,255,255,0.08)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(255,0,60,0.35), 0 0 4px rgba(255,0,60,0.55)',
        glowAction: '0 0 24px rgba(0,229,255,0.35), 0 0 4px rgba(0,229,255,0.55)',
        panel: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
