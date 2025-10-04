import { validateIssue } from '../helpers/issue-validator.js';

const TYPE_KEYWORDS = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'chore',
  'revert',
  'build',
  'test',
  'perf',
];

const REQUIRED_CHECKS = [
  'Code builds successfully',
  'Linting and formatting pass without errors',
  'Feature works as expected',
  'PR linked to an issue (Resolves #<issue_number>)',
  'Branch name follows the convention (type/issue/short-description)',
  'Commit messages follow the Conventional Commits standard',
  'No debug/log statements left (`console.log`, `print`, etc.)',
];

export async function validatePrBody(octokit, owner, repo, prBody = '') {
  try {
    const errors = [];

    if (!/##\s*Types of Changes/i.test(prBody)) {
      errors.push('PR body missing "## Type of Change" section.');
    } else {
      const typeChecked = TYPE_KEYWORDS.some((t) => {
        const re = new RegExp(`^[\\s\\-*]*\\[(?:x|X|✔)\\]\\s*${t}:`, 'mi');
        return re.test(prBody);
      });
      if (!typeChecked) errors.push('Select at least one "Type of Change" in the checklist.');
    }

    if (!/##\s*Checklist/i.test(prBody)) {
      errors.push('PR body missing "## Checklist" section.');
    } else {
      for (const item of REQUIRED_CHECKS) {
        const safe = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^[\\s\\-*]*\\[(?:x|X|✔)\\]\\s*${safe}`, 'mi');
        if (!re.test(prBody)) errors.push(`Checklist item not checked: "${item}"`);
      }
    }

    if (!/##\s*Related Issue/i.test(prBody)) {
      errors.push('PR body missing "## Related Issue" section.');
    } else {
      const issueMatch = prBody.match(/Resolves\s+#(\d+)/i);
      if (!issueMatch) {
        errors.push('No issue number found in "## Related Issue". Example: "Resolves #123".');
      } else {
        const issueNumber = Number(issueMatch[1]);
        const { exists, message } = await validateIssue(octokit, owner, repo, issueNumber);
        if (!exists) errors.push(`Referenced issue #${issueNumber} is invalid: ${message}`);
      }
    }

    return errors;
  } catch (err) {
    return [`Could not validate PR body: ${err?.message || String(err)}`];
  }
}
