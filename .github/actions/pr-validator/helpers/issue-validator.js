export async function validateIssue(octokit, owner, repo, issueNumber) {
  const invalid = (message) => ({ exists: false, message });

  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    return invalid(`Invalid issue number: ${issueNumber}`);
  }

  try {
    const { data } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    if (data.pull_request) {
      return invalid(`#${issueNumber} exists but is a Pull Request, not an issue.`);
    }

    if (data.state !== 'open') {
      return invalid(`#${issueNumber} is not open (state: ${data.state}).`);
    }

    if (data.locked) {
      return invalid(`#${issueNumber} is locked and cannot be acted on.`);
    }

    return { exists: true, message: `Issue #${issueNumber} exists and is open.` };
  } catch (err) {
    const status = err?.status ?? err?.statusCode ?? null;
    const errorMap = {
      404: `Issue #${issueNumber} does not exist.`,
      403: `Issue #${issueNumber} is not accessible (permission denied).`,
    };
    return invalid(errorMap[status] || `Error checking #${issueNumber}: ${err.message}`);
  }
}
