import { validateIssue } from '../helpers/issue-validator.js';

const MAIN_BRANCHES = /^(master|develop)$/;
export const TASK_BRANCHES =
  /^(test|feat|refactor|style|fix|chore|docs|build|revert)\/(\d+)\/[a-z0-9-]+$/i;

export async function validateBranch(branch, octokit, owner, repo) {
  try {
    if (!branch) return ['Branch name could not be determined.'];

    if (MAIN_BRANCHES.test(branch)) return [];

    const match = branch.match(TASK_BRANCHES);
    if (!match) {
      return [
        `Branch \`${branch}\` is invalid.`,
        'Expected format: `<type>/<issue>/<short-description>`',
        'Example: `feat/123/short-description`',
      ];
    }

    const issueNumber = Number(match[2]);
    const { exists, message } = await validateIssue(octokit, owner, repo, issueNumber);

    if (!exists) {
      return [
        `Branch references issue #${issueNumber} which failed validation.`,
        `Issue check: ${message}`,
      ];
    }

    return [];
  } catch (err) {
    return [`Could not validate branch name: ${err?.message || String(err)}`];
  }
}
