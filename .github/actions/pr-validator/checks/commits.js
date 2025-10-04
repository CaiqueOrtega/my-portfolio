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
  'perf',
  'test',
];
const COMMIT_REGEX = new RegExp(`^(${TYPE_KEYWORDS.join('|')})(\\([^\\)]*\\))?:\\s+.+`, 'i');
const ISSUE_REF_REGEX = /\bRefs?\s*(?:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+))?#(\d+)\b/gi;

export async function validateCommits(octokit, owner, repo, prNumber) {
  try {
    const perPage = 100;
    let page = 1;
    let commits = [];
    while (true) {
      const resp = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber,
        per_page: perPage,
        page,
      });
      commits.push(...(resp.data || []));
      if (!resp.data || resp.data.length < perPage) break;
      page++;
    }

    if (!commits.length) return ['No commits found in PR (unexpected).'];

    const errors = [];

    for (const c of commits) {
      const sha = (c.sha || '').slice(0, 7);
      const messageFull = c.commit?.message || '';
      const [titleLine, ...bodyLines] = messageFull.split('\n');
      const title = (titleLine || '').trim();
      const body = bodyLines.join('\n').trim();

      if (!COMMIT_REGEX.test(title)) {
        errors.push(
          `Commit ${sha}: title invalid — must follow Conventional Commits (e.g. feat(scope): description). Current: "${title || '(empty)'}"`,
        );
      }

      const refs = [];
      for (const m of body.matchAll(ISSUE_REF_REGEX)) {
        refs.push({
          owner: m[1] || owner,
          repo: m[2] || repo,
          number: Number(m[3]),
        });
      }

      if (!refs.length) {
        errors.push(
          `Commit ${sha}: no issue reference found in body (expected "Refs #<number>" or "Fixes #<number>").`,
        );
        continue;
      }

      const validationResults = await Promise.all(
        refs.map((r) => validateIssue(octokit, r.owner, r.repo, r.number)),
      );

      const anyValid = validationResults.some((res) => res.exists);
      validationResults.forEach((res, i) => {
        if (!res.exists) {
          const ref = refs[i];
          errors.push(
            `Commit ${sha}: references invalid issue ${ref.owner}/${ref.repo}#${ref.number} — ${res.message}`,
          );
        }
      });

      if (!anyValid) {
        errors.push(`Commit ${sha}: no valid issue reference found in body.`);
      }
    }

    return errors;
  } catch (err) {
    return [`Could not validate commits: ${err?.message || String(err)}`];
  }
}
