module.exports = {
  '{packages,tools,secrets}/**/*.{ts,js,jsx,tsx,json,yaml,md,html,css,scss,py}': [
    () => 'pnpm nx affected --target lint --fix',
    'pnpm nx format:write --uncommitted',
  ],
  '*.{js,ts,md,json}': ['pnpm nx format:write --uncommitted'],
};
