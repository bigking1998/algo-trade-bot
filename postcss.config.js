/**
 * Tailwind v4 PostCSS config with explicit plugin order.
 * Ensure @tailwindcss/postcss runs BEFORE postcss-import so
 * @import "tailwindcss" is intercepted by Tailwind and not parsed as CSS.
 */
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
