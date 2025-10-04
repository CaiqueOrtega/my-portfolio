/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: 'all',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
};

export default config;
