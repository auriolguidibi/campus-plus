const c = (v) => `rgb(var(--${v}) / <alpha-value>)`
/** Colors come from CSS variables (src/index.css) so light/dark never needs hard-coded colors. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: c('bg'), card: c('card'), soft: c('soft'), fg: c('fg'), muted: c('muted'),
        line: c('line'), primary: c('primary'), link: c('link'), 'primary-fg': c('primary-fg'), accent: c('accent'), danger: c('danger'),
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}
