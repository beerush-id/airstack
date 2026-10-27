/**
 * Transactional rollback function to undo driver side-effects upon error or abort.
 * @param error Optional error or abort reason triggering the rollback.
 */
export type RollbackFn = (error?: Error) => Promise<void> | void;

/**
 * Lifecycle control and reactive stream state passed to the adapter from the IRPC streaming constructor.
 * `state` is the live reactive proxy from stream(); the adapter seeds `state.data` and drivers
 * mutate `state.data` in real time to drive IRPC updates.
 * @template T Type of output data entity managed within the stream (e.g. ChatMessage, ImageOutput).
 */
export interface LifecycleCtx<T = unknown> {
  /** Live reactive streaming state proxy from IRPC stream(). */
  state: { data?: T };
  /** Client abort signal triggering cancellation. */
  signal?: AbortSignal;
  /** Resolves the operation and closes the IRPC stream. */
  resolve: () => void;
  /** Terminates the stream with an error. */
  reject: (error: unknown) => void;
}
