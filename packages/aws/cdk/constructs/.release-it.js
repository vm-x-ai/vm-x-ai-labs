const { whatBump } = require('../../../../release/util');

const version = '${version}';
const packageName = 'aws-cdk-constructs';

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
    tagName: `${packageName}-v${version}`,
    commitsPath: '.',
    commitMessage: `chore(${packageName}): released version v${version} [no ci]`,
    requireCommits: true,
    requireCommitsFail: false,
    requireUpstream: false,
  },
  npm: {
    publish: true,
    publishPath: '../../../../dist/packages/aws/cdk/constructs',
    versionArgs: ['--allow-same-version', '--workspaces false'],
  },
  github: {
    release: true,
    releaseName: `${packageName}-v${version}`,
  },
  hooks: {
    'before:git:release': ['cd ../../../..; pnpm nx format', 'git add --all'],
    'after:bump': [`pnpm nx run ${packageName}:build`],
  },
};
