/**
 * Merges cascading AI options across Instance defaults and Call overrides.
 * Precedence order: Call > Instance.
 * @param instanceDefaults Default options configured on createAI / createWorker.
 * @param callOverrides Options passed directly to the procedure invocation.
 * @returns Deterministically resolved options payload.
 */
export function mergeOptions<O extends Record<string, unknown>>(
  instanceDefaults?: Partial<O>,
  callOverrides?: Partial<O>
): O {
  return {
    ...instanceDefaults,
    ...callOverrides,
  } as O;
}
