const breakingHeaderPattern = /^(\w*)(?:\((.*)\))?!: (.*)$/;

function addBangNotes(commit) {
  const match = commit.header.match(breakingHeaderPattern);
  if (match && commit.notes.length === 0) {
    const noteText = match[3]; // the description of the change.

    return [
      {
        title: 'BREAKING CHANGE',
        text: noteText,
      },
    ];
  }

  return commit.notes;
}

/**
 *
 * The `@release-it/conventional-changelog` plugin never returns `ignore` as the level of the release.
 *
 * This custom `whatBump` is based on the original `whatBump` function in the conventional-changelog package,
 * but it adds support for the `ignore` release type for the following commit types:
 *
 * - build
 * - ci
 * - docs
 * - refactor
 * - test
 *
 * Reference: https://github.com/release-it/conventional-changelog/issues/22#issuecomment-1450958650
 */
module.exports = {
  whatBump: (commits, options) => {
    const defaults = {
      build: 'ignore',
      ci: 'ignore',
      docs: 'ignore',
      feat: 'minor',
      fix: 'patch',
      perf: 'patch',
      refactor: 'ignore',
      test: 'ignore',
    };

    const types = Object.assign(
      {},
      defaults,
      (options?.preset?.types || []).reduce((a, v) => {
        return { ...a, [v.type]: v.release };
      }, {}),
    );

    let breakings = 0;
    let features = 0;
    const levelSet = ['major', 'minor', 'patch', 'ignore'];
    const level = Math.min.apply(
      Math,
      commits.map((commit) => {
        commit.notes = addBangNotes(commit);
        let level = levelSet.indexOf(types[commit.type]);
        level = level < 0 ? 3 : level;
        if (commit.notes.length > 0) {
          breakings += commit.notes.length;
          level = 0;
        }
        if (commit.type === 'feat') {
          features += 1;
        }
        return level;
      }),
    );

    return {
      level: level,
      reason:
        breakings === 1
          ? `There is ${breakings} BREAKING CHANGE and ${features} features`
          : `There are ${breakings} BREAKING CHANGES and ${features} features`,
    };
  },
};
