module.exports = (config) => {
  config.input = {
    index: 'packages/cli/src/index.ts',
    'bin/index': 'packages/cli/bin/index.ts',
  };
  for (const output of config.output) {
    output.preserveModules = true;
  }

  return config;
};
