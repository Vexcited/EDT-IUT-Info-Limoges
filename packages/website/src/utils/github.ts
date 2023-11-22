interface GitHubCommit {
  sha: string
  html_url: string

  commit: {
    message: string
  }

  author: {
    login: string
    html_url: string
    avatar_url: string
  }
}

export interface GitHubCommitCompareResponse {
  permalink_url: string
  total_commits: number

  base_commit: GitHubCommit
  commits: Array<GitHubCommit>
}

/**
 * Compare the given commit SHA with the main (latest commit) from GitHub.
 */
export const getGitHubCommitCompare = async (commit_sha: string): Promise<GitHubCommitCompareResponse> => {
  const response = await fetch(`https://api.github.com/repos/Vexcited/EDT-IUT-Info-Limoges/compare/${commit_sha}...main`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  const json = await response.json();
  return json;
};
