import { createSign } from "node:crypto";

export type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function parseServiceAccountJson(value: unknown): ServiceAccountJson {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Service Account JSON is required.");
  }
  const parsed = JSON.parse(value) as Partial<ServiceAccountJson>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service Account JSON must include client_email and private_key.");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key, token_uri: parsed.token_uri };
}

export async function getServiceAccountAccessToken(serviceAccountJson: unknown, scopes: string[]) {
  const serviceAccount = parseServiceAccountJson(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: scopes.join(" "),
    aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key, "base64url");
  const assertion = `${unsigned}.${signature}`;
  const request = () => fetch(claim.aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const response = await fetchWithRetry(request, "Google token request");
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.access_token !== "string") {
    throw new Error(`Google token request failed: ${body.error_description ?? body.error ?? response.status}`);
  }
  return body.access_token as string;
}

async function fetchWithRetry(request: () => Promise<Response>, label: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await request();
      if (!isRetryableStatus(response.status) || attempt === attempts) return response;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempt === attempts) {
        throw new Error(`${label} failed before response: ${describeFetchError(error)}`);
      }
    }
    await sleep(750 * attempt);
  }
  throw new Error(`${label} failed: ${describeFetchError(lastError)}`);
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function isRetryableFetchError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { code?: string } | undefined;
  return ["UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"].includes(cause?.code ?? "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const causeRecord = cause as { code?: string; errno?: string; syscall?: string; hostname?: string; message?: string };
    return [
      error.message,
      causeRecord.code ? `code=${causeRecord.code}` : null,
      causeRecord.errno ? `errno=${causeRecord.errno}` : null,
      causeRecord.syscall ? `syscall=${causeRecord.syscall}` : null,
      causeRecord.hostname ? `host=${causeRecord.hostname}` : null,
      causeRecord.message ? `cause=${causeRecord.message}` : null,
    ].filter(Boolean).join("; ");
  }
  return error.message;
}
