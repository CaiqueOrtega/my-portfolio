const TASK_BRANCHES =
  /^(test|feat|refactor|style|fix|chore|docs|build|revert)\/(\d+)\/[a-z0-9-]+$/i;
const TYPE_KEYWORDS = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'chore',
  'revert',
  'build',
  'hotfix',
  'perf',
  'test',
];

const TITLE_REGEX = new RegExp(`^(${TYPE_KEYWORDS.join('|')})(\\([a-z0-9-]+\\))?:\\s+.+`, 'i');

export async function validatePrTitle(prTitle, prBody, branch) {
  const errors = [];

  if (!prTitle || !TITLE_REGEX.test(prTitle)) {
    errors.push(
      `PR title "${prTitle || '(empty)'}" is invalid. ` +
        `It must follow: <type>(<scope>): <description>. Example: feat(login): add login button`,
    );
  }

  if (!prBody || !/##\s*Related Issue/i.test(prBody)) {
    let issueNumber = null;
    const match = branch.match(TASK_BRANCHES);
    if (match) {
      issueNumber = match[2];
    }
    if (issueNumber) {
      errors.push(`PR body missing "## Related Issue". Expected: "Resolves #${issueNumber}"`);
    } else {
      errors.push('PR body missing "## Related Issue" section.');
    }
  }

  return errors;
}
