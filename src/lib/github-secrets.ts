// GitHub Secrets Encryption Utility
// Uses libsodium sealed box encryption (NaCl crypto_box_seal)
// Required by GitHub's REST API for setting repository secrets

import sodium from 'libsodium-wrappers';
import { sanitizeHeaderValue } from './api-utils';

let sodiumReady = false;

async function ensureSodium(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

/**
 * Get the repository's public key for secret encryption.
 * GitHub requires this key to encrypt secrets before storing them.
 */
export async function getRepoPublicKey(
  owner: string,
  repo: string,
  githubToken: string
): Promise<{ key: string; key_id: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${sanitizeHeaderValue(githubToken)}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to get repo public key (${res.status}): ${errText.substring(0, 200)}`);
  }

  return res.json();
}

/**
 * Encrypt a secret value using the repository's public key.
 * Uses libsodium's crypto_box_seal (NaCl sealed box).
 */
export async function encryptSecretValue(
  secretValue: string,
  publicKeyBase64: string
): Promise<string> {
  await ensureSodium();
  const publicKey = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const encrypted = sodium.crypto_box_seal(secretValue, publicKey);
  return sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
}

/**
 * Set or update a repository secret.
 * Encrypts the value with the repo's public key and stores it via GitHub API.
 */
export async function setRepoSecret(
  owner: string,
  repo: string,
  secretName: string,
  secretValue: string,
  githubToken: string
): Promise<boolean> {
  try {
    const { key, key_id } = await getRepoPublicKey(owner, repo, githubToken);
    const encryptedValue = await encryptSecretValue(secretValue, key);

    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/secrets/${encodeURIComponent(secretName)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sanitizeHeaderValue(githubToken)}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encrypted_value: encryptedValue,
          key_id,
        }),
      }
    );

    if (!res.ok) {
      console.error(`Failed to set secret ${secretName}: ${res.status}`);
      return false;
    }

    console.log(`Secret ${secretName} set successfully`);
    return true;
  } catch (err) {
    console.error(`Error setting secret ${secretName}:`, err);
    return false;
  }
}

/**
 * Create or update a file in a GitHub repository via the Contents API.
 * Used to push GitHub Actions workflow files.
 */
export async function createOrUpdateRepoFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  githubToken: string
): Promise<{ success: boolean; sha?: string; error?: string }> {
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;

  // Check if file already exists to get its SHA
  let sha: string | undefined;
  try {
    const checkRes = await fetch(apiBase, {
      headers: {
        Authorization: `Bearer ${sanitizeHeaderValue(githubToken)}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (checkRes.ok) {
      const data = await checkRes.json() as Record<string, unknown>;
      sha = data.sha as string;
    }
  } catch { /* File doesn't exist yet, that's fine */ }

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
  };
  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sanitizeHeaderValue(githubToken)}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { success: false, error: `Failed to create file (${res.status}): ${errText.substring(0, 300)}` };
  }

  const responseData = await res.json() as Record<string, unknown>;
  const contentObj = responseData.content as Record<string, unknown> | undefined;
  return { success: true, sha: (contentObj?.sha as string) || undefined };
}

/**
 * Trigger a GitHub Actions workflow dispatch.
 */
export async function triggerWorkflowDispatch(
  owner: string,
  repo: string,
  workflowId: string | number,
  ref: string,
  githubToken: string,
  inputs?: Record<string, string>
): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(String(workflowId))}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sanitizeHeaderValue(githubToken)}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, inputs: inputs || {} }),
    }
  );

  return res.ok;
}

/**
 * Get the latest workflow run for a specific workflow file.
 */
export async function getLatestWorkflowRun(
  owner: string,
  repo: string,
  workflowFileName: string,
  githubToken: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${sanitizeHeaderValue(githubToken)}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!res.ok) return null;

  const data = await res.json() as Record<string, unknown>;
  const runs = (data.workflow_runs as Record<string, unknown>[]) || [];
  return runs[0] || null;
}
