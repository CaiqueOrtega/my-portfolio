import * as core from '@actions/core';
import * as github from '@actions/github';
import { validateBranch } from './checks/branch-name.js';
import { validateCommits } from './checks/commits.js';
import { validatePrBody } from './checks/pr-body.js';
import { validatePrTitle } from './checks/pr-title.js';

const COMMENT_MARKER = '<!-- pr-validator-comment -->';

function ensureArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v.flat().filter(Boolean) : [v].filter(Boolean);
}

function summarizeResults(results) {
  const totalErrors = results.reduce((acc, r) => acc + (r.messages?.length || 0), 0);
  const statusLine = totalErrors
    ? `### PR Validation — Failed ❌  — **${totalErrors} issue(s)** found`
    : `✅ PR validation passed — no issues found`;

  const sections = results.map(({ name, messages }) => {
    if (!messages || messages.length === 0) {
      return `**${name}** — ✅ OK`;
    }

    const list = messages.map((m) => `- ${m}`).join('\n');
    return (
      `**${name}** — ❌ ${messages.length} issue(s)\n\n` +
      `<details>\n<summary>Show ${name} details</summary>\n\n${list}\n\n</details>`
    );
  });

  return [
    COMMENT_MARKER,
    statusLine,
    '',
    ...sections,
    '',
    '_Please fix the items above and update the PR._',
  ].join('\n\n');
}

async function upsertPrComment(octokit, owner, repo, issue_number, body) {
  const listResp = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number,
    per_page: 100,
  });

  const existing = (listResp.data || []).find((c) => c.body && c.body.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
  }
}

async function runChecks(octokit, owner, repo, prNumber, branch, prTitle, prBody) {
  const checks = [
    {
      name: 'Branch name',
      fn: async () => ensureArray(await validateBranch(branch, octokit, owner, repo)),
    },
    {
      name: 'Commits',
      fn: async () => ensureArray(await validateCommits(octokit, owner, repo, prNumber)),
    },
    {
      name: 'PR Title & Issue',
      fn: async () => ensureArray(await validatePrTitle(prTitle, prBody, branch)),
    },
    {
      name: 'PR body',
      fn: async () => ensureArray(await validatePrBody(octokit, owner, repo, prBody)),
    },
  ];

  const results = [];

  for (const check of checks) {
    core.startGroup(`🔎 ${check.name}`);
    try {
      const messages = await check.fn();
      if (messages.length) {
        messages.forEach((m) => core.warning(`[${check.name}] ${m}`));
      } else {
        core.info(`✅ ${check.name} OK`);
      }
      results.push({ name: check.name, messages });
    } catch (err) {
      const msg = `Internal error running ${check.name}: ${err?.message || String(err)}`;
      core.error(msg);
      results.push({ name: check.name, messages: [msg] });
    } finally {
      core.endGroup();
    }
  }

  return results;
}

export default async function main() {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const context = github.context;
    const pr = context.payload.pull_request;

    if (!pr) {
      core.setFailed('PR context unavailable. Run this action on pull_request events.');
      return;
    }

    const { owner, repo } = context.repo;
    const prNumber = pr.number;
    const branch = pr.head?.ref || '';
    core.info(`Validating PR #${prNumber} on ${owner}/${repo} (branch: ${branch})`);

    const results = await runChecks(octokit, owner, repo, prNumber, branch, pr.title, pr.body);

    const totalIssues = results.reduce((s, r) => s + (r.messages?.length || 0), 0);

    const commentBody = summarizeResults(results);
    await upsertPrComment(octokit, owner, repo, prNumber, commentBody);

    if (totalIssues > 0) {
      core.setFailed(
        `PR validation failed — ${totalIssues} issue(s) found. See PR comment for details.`,
      );
    } else {
      core.info('PR validation passed.');
    }
  } catch (err) {
    core.setFailed(`Unexpected error: ${err?.message || String(err)}`);
  }
}

main();
