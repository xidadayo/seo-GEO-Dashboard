export type ProviderResult<T> = { ok: true; data: T; syncedAt: string } | { ok: false; error: string; retryable: boolean };
export interface ProviderAdapter<TConfig, TResult> {
  test(config: TConfig): Promise<ProviderResult<{ message: string }>>;
  sync(config: TConfig): Promise<ProviderResult<TResult>>;
}

export async function withRetry<T>(operation: () => Promise<T>, attempts = 3, timeoutMs = 15000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Provider timeout")), timeoutMs))]);
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
