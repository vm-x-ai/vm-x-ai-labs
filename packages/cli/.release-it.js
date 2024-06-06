const { whatBump } = require('../../release/util');
const { name } = require('./project.json');

const version = '${version}';

module.exports = {
  plugins: {
    '@release-it/conventional-changelog': {
      path: '.',
      infile: 'CHANGELOG.md',
      preset: 'conventionalcommits',
      whatBump,
      gitRawCommitsOpts: {
        path: '.',
      },
    },
    '@release-it/bumper': {
      in: 'package.json',
      out: 'package.json',
    },
  },
  git: {
    push: true,
    tagName: `${name}-v${version}`,
    commitsPath: '.',
    commitMessage: `chore(${name}): released version v${version} [no ci]`,
    requireCommits: true,
    requireCommitsFail: false,
    requireUpstream: false,
  },
  npm: {
    publish: true,
    publishPath: '../../dist/packages/cli',
    versionArgs: ['--allow-same-version', '--workspaces false'],
  },
  github: {
    release: true,
    releaseName: `${name}-v${version}`,
  },
  hooks: {
    'before:git:release': ['cd ../..; pnpm nx format', 'git add --all'],
    'after:bump': [`pnpm nx run ${name}:build:production`],
  },
};
