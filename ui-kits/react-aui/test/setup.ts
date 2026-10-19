import { createLifecycle, type StateUnsubscribe, withContext } from '@airlib/react';

export function runApp(fn: () => void | Promise<void>): Promise<StateUnsubscribe> {
  return withContext(async () => {
    const scope = createLifecycle();

    await scope.run(fn);

    return () => {
      scope.destroy();
    };
  });
}
