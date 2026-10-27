import { createLifecycle, isReactive, mutable, setReactive } from '@airlib/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPackage,
  IRPC_BASE_CONTEXT,
  type IRPCCall,
  IRPCResolver,
  IRPCRouter,
  IRPCStream,
  IRPCTransport,
  type RemoteState,
  stream,
  withContext,
} from '../src/index.js';

class LoopbackTransport extends IRPCTransport {
  public router?: IRPCRouter;

  public async dispatch(calls: IRPCCall[]): Promise<void> {
    const router = this.router!;

    for (const call of calls) {
      const req = {
        id: call.id,
        name: call.payload.name,
        args: call.payload.args,
        package: call.payload.package,
        type: call.payload.type,
        callId: call.payload.callId,
      };
      const pkg = router.packageOf(req);
      const resolver = new IRPCResolver(req, pkg);
      const irpcStream = new IRPCStream(req.id, req.name, () => resolver.resolve(), resolver.spec, router);

      irpcStream.pipe((packet) => {
        call.enqueue(packet);
      });
    }
  }
}

describe('IRPC Duplex (ask / answer)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  describe('Local execution (intercept)', () => {
    it('allows server to ask client for state during a call', async () => {
      type AIQueries = {
        getState: () => { currentApp: string };
      };

      const irpc = createPackage({ name: 'ai-local', version: '1.0.0' });
      const askAi = irpc.declare<(prompt: string) => RemoteState<{ progress: number; status: string }, AIQueries>>({
        name: 'askAi',
        stream: true,
        seed: () => ({ progress: 0, status: 'idle' }),
        coalesce: false,
      });

      irpc.construct(askAi, (prompt) => {
        return stream((state, resolve) => {
          state.data.status = `processing: ${prompt}`;
          state.ask('getState').then((appState) => {
            state.data.progress = 1;
            state.data.status = `opened in ${appState?.currentApp}`;
            resolve();
          });
        }, { progress: 0, status: 'idle' });
      });

      const msg = askAi('open the Photos app');
      msg.answer('getState', () => ({ currentApp: 'Finder' }));

      const final = await msg;
      expect(final).toEqual({
        progress: 1,
        status: 'opened in Finder',
      });
    });

    it('allows client to ask server during an active call', async () => {
      type UploadQueries = {
        getQuota: (unit: 'mb' | 'gb') => number;
      };

      const irpc = createPackage({ name: 'upload-local', version: '1.0.0' });
      const upload = irpc.declare<(file: string) => RemoteState<{ done: boolean }, UploadQueries>>({
        name: 'upload',
        stream: true,
        seed: () => ({ done: false }),
        coalesce: false,
      });

      irpc.construct(upload, () => {
        return stream((state, resolve) => {
          state.answer('getQuota', (unit) => (unit === 'gb' ? 10 : 10240));

          setTimeout(() => {
            state.data.done = true;
            resolve();
          }, 20);
        }, { done: false });
      });

      const msg = upload('photo.png');
      const quotaMb = await msg.ask('getQuota', 'mb');
      const quotaGb = await msg.ask('getQuota', 'gb');

      expect(quotaMb).toBe(10240);
      expect(quotaGb).toBe(10);

      const final = await msg;
      expect(final.done).toBe(true);
    });

    it('supports bi-directional ask and answer in the same call', async () => {
      type SyncQueries = {
        confirm: (msg: string, required?: boolean) => Promise<boolean>;
        getServerVersion: () => string;
      };

      const irpc = createPackage({ name: 'sync-local', version: '1.0.0' });
      const syncData = irpc.declare<() => RemoteState<{ synced: boolean }, SyncQueries>>({
        name: 'syncData',
        stream: true,
        seed: () => ({ synced: false }),
        coalesce: false,
      });

      irpc.construct(syncData, () => {
        return stream((state, resolve) => {
          state.answer('getServerVersion', () => '2.4.0');

          state.ask('confirm', 'Overwrite remote changes?', true).then((confirmed) => {
            state.data.synced = Boolean(confirmed);
            resolve();
          });
        }, { synced: false });
      });

      const msg = syncData();
      let serverVersionDuringConfirm = '';

      msg.answer('confirm', async (prompt, required) => {
        expect(prompt).toBe('Overwrite remote changes?');
        expect(required).toBe(true);
        serverVersionDuringConfirm = (await msg.ask('getServerVersion')) ?? '';
        return true;
      });

      const result = await msg;
      expect(serverVersionDuringConfirm).toBe('2.4.0');
      expect(result.synced).toBe(true);
    });

    it('resolves to undefined (no-op) when the peer never registers answer()', async () => {
      type OptionalQueries = {
        getOptionalState: () => string;
        getServerHint: () => string;
      };

      const irpc = createPackage({ name: 'noop-local', version: '1.0.0' });
      const runTask = irpc.declare<() => RemoteState<{ received?: string }, OptionalQueries>>({
        name: 'runTask',
        stream: true,
        seed: () => ({}),
        coalesce: false,
      });

      irpc.construct(runTask, () => {
        return stream((state, resolve) => {
          state.ask('getOptionalState').then((val) => {
            state.data.received = val ?? 'fallback';
            resolve();
          });
        }, {});
      });

      const msg = runTask();
      const hint = await msg.ask('getServerHint');
      const final = await msg;

      expect(hint).toBeUndefined();
      expect(final.received).toBe('fallback');
    });

    it('runs the handler cleanup when the caller closes the call', async () => {
      const irpc = createPackage({ name: 'close-local', version: '1.0.0' });
      const watch = irpc.declare<() => RemoteState<{ ticks: number }>>({
        name: 'watch',
        stream: true,
        seed: () => ({ ticks: 0 }),
        coalesce: false,
      });
      const cleanup = vi.fn();

      irpc.construct(watch, () => stream(() => cleanup, { ticks: 0 }));

      const msg = watch();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(cleanup).not.toHaveBeenCalled();

      msg.close();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('settles the handler pending ask with undefined when the caller closes the call', async () => {
      type Queries = { confirm: () => boolean };
      const irpc = createPackage({ name: 'close-local-ask', version: '1.0.0' });
      const task = irpc.declare<() => RemoteState<{ done: boolean }, Queries>>({
        name: 'task',
        stream: true,
        seed: () => ({ done: false }),
        coalesce: false,
      });
      let answered: boolean | undefined | 'pending' = 'pending';

      irpc.construct(task, () =>
        stream((state) => {
          state.ask('confirm').then((value) => {
            answered = value;
          });
        }, { done: false })
      );

      const msg = task();
      msg.answer('confirm', () => new Promise<boolean>(() => {}));
      await new Promise((resolve) => setTimeout(resolve, 0));

      msg.close();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(answered).toBeUndefined();
    });

    it('runs the handler cleanup only once when a close and an abort both arrive', async () => {
      const irpc = createPackage({ name: 'close-local-once', version: '1.0.0' });
      const watch = irpc.declare<() => RemoteState<{ ticks: number }>>({
        name: 'watch',
        stream: true,
        seed: () => ({ ticks: 0 }),
        coalesce: false,
      });
      const cleanup = vi.fn();
      const controller = new AbortController();

      irpc.construct(watch, () => stream(() => cleanup, { ticks: 0 }));

      await withContext([[IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal]], async () => {
        const msg = watch();
        await new Promise((resolve) => setTimeout(resolve, 0));
        msg.close();
        controller.abort();
      });

      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Remote transport execution (Router + Stream)', () => {
    function setupRemote(pkgName: string) {
      const transport = new LoopbackTransport();
      const irpc = createPackage({ name: pkgName, version: '1.0.0', transport, bypassLocal: true });
      const router = new IRPCRouter(irpc, transport);
      transport.router = router;
      return { irpc, transport, router };
    }

    it('allows server to ask client and receive answer over transport', async () => {
      type AIQueries = {
        getState: () => { app: string };
      };

      const { irpc } = setupRemote('ai-remote');
      const askAi = irpc.declare<(prompt: string) => RemoteState<{ progress: number; app?: string }, AIQueries>>({
        name: 'askAi',
        seed: () => ({ progress: 0 }),
        stream: true,
        coalesce: false,
      });

      irpc.construct(askAi, () => {
        return stream((state, resolve) => {
          state.data.progress = 0.5;
          state.ask('getState').then((s) => {
            state.data.app = s?.app;
            state.data.progress = 1;
            resolve();
          });
        }, { progress: 0 });
      });

      const msg = askAi('open the Photos app');
      msg.answer('getState', () => ({ app: 'Photos' }));

      const final = await msg;
      expect(final).toEqual({
        progress: 1,
        app: 'Photos',
      });
    });

    it('allows client to ask server and receive answer over transport', async () => {
      type JobQueries = {
        getStepDetail: (step: number) => { label: string };
      };

      const { irpc } = setupRemote('job-remote');
      const startJob = irpc.declare<() => RemoteState<{ completed: boolean }, JobQueries>>({
        name: 'startJob',
        seed: () => ({ completed: false }),
        stream: true,
        coalesce: false,
      });

      let finishServer!: () => void;

      irpc.construct(startJob, () => {
        return stream((state, resolve) => {
          state.answer('getStepDetail', (step) => ({ label: `Step #${step}` }));
          finishServer = () => {
            state.data.completed = true;
            resolve();
          };
        }, { completed: false });
      });

      const msg = startJob();

      await new Promise((r) => setTimeout(r, 10));

      const detail = await msg.ask('getStepDetail', 3);
      expect(detail).toEqual({ label: 'Step #3' });

      finishServer();
      const final = await msg;
      expect(final.completed).toBe(true);
    });

    it('supports multiple sequential and concurrent ask/answer exchanges over transport', async () => {
      type WizardQueries = {
        promptInput: (field: string) => Promise<string>;
        validateToken: (token: string) => boolean;
      };

      const { irpc } = setupRemote('wizard-remote');
      const runWizard = irpc.declare<() => RemoteState<{ user?: string; email?: string; valid?: boolean }, WizardQueries>>({
        name: 'runWizard',
        seed: () => ({}),
        stream: true,
        coalesce: false,
      });

      irpc.construct(runWizard, () => {
        return stream(async (state, resolve) => {
          state.answer('validateToken', (token) => token === 'secret-123');

          const [user, email] = await Promise.all([
            state.ask('promptInput', 'username'),
            state.ask('promptInput', 'email'),
          ]);

          state.data.user = user;
          state.data.email = email;
          resolve();
        }, {});
      });

      const msg = runWizard();
      msg.answer('promptInput', async (field) => {
        const isValid = await msg.ask('validateToken', 'secret-123');
        expect(isValid).toBe(true);
        return field === 'username' ? 'mahdaen' : 'mahdaen@example.com';
      });

      const final = await msg;
      expect(final).toEqual({
        user: 'mahdaen',
        email: 'mahdaen@example.com',
      });
    });

    it('resolves to undefined over transport when the other side never calls answer()', async () => {
      type NoopQueries = {
        missingClientHandler: () => string;
        missingServerHandler: () => string;
      };

      const { irpc } = setupRemote('noop-remote');
      const checkNoop = irpc.declare<() => RemoteState<{ clientReply: string }, NoopQueries>>({
        name: 'checkNoop',
        seed: () => ({ clientReply: 'initial' }),
        stream: true,
        coalesce: false,
      });

      let finishServer!: () => void;

      irpc.construct(checkNoop, () => {
        return stream((state, resolve) => {
          state.ask('missingClientHandler').then((res) => {
            state.data.clientReply = res === undefined ? 'none' : res;
          });

          finishServer = () => resolve();
        }, { clientReply: 'initial' });
      });

      const msg = checkNoop();

      await new Promise((r) => setTimeout(r, 10));

      const serverReply = await msg.ask('missingServerHandler');
      expect(serverReply).toBeUndefined();

      finishServer();
      const final = await msg;
      expect(final.clientReply).toBe('none');
    });

    it('cleans up in-flight server and client queries when parent call closes or disconnects', async () => {
      type HangingQueries = {
        slowClientOp: () => Promise<string>;
        slowServerOp: () => Promise<string>;
      };

      const { irpc, router } = setupRemote('cleanup-remote');
      const startTask = irpc.declare<() => RemoteState<{ step: string }, HangingQueries>>({
        name: 'startTask',
        seed: () => ({ step: 'started' }),
        stream: true,
        coalesce: false,
      });

      let serverAskResult: string | undefined = 'pending';

      irpc.construct(startTask, () => {
        return stream((state) => {
          state.answer(
            'slowServerOp',
            () =>
              new Promise((resolve) => {
                setTimeout(() => resolve('too-late-server'), 5000);
              })
          );

          state.ask('slowClientOp').then((res) => {
            serverAskResult = res;
          });
        }, { step: 'started' });
      });

      const msg = startTask();
      msg.answer(
        'slowClientOp',
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too-late-client'), 5000);
          })
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(router.streams.size).toBe(1);

      const clientAskPromise = msg.ask('slowServerOp');

      // Close the parent call on the client and abort active stream on the router
      msg.close();
      for (const active of router.streams.values()) {
        active.controller?.abort();
        (active as unknown as { finish: () => void }).finish();
      }

      const clientAskResult = await clientAskPromise;
      await new Promise((r) => setTimeout(r, 10));

      expect(clientAskResult).toBeUndefined();
      expect(serverAskResult).toBeUndefined();
      expect(router.streams.size).toBe(0);

      // Asking after parent call is already closed immediately resolves to undefined
      expect(await msg.ask('slowServerOp')).toBeUndefined();
    });

    it('propagates errors when client or server answer() handler throws', async () => {
      type ErrorQueries = {
        failOnClient: () => string;
        failOnServer: () => string;
      };

      const { irpc } = setupRemote('error-remote');
      const runErrorTask = irpc.declare<() => RemoteState<{ clientErr?: string }, ErrorQueries>>({
        name: 'runErrorTask',
        seed: () => ({}),
        stream: true,
        coalesce: false,
      });

      let finishServer!: () => void;

      irpc.construct(runErrorTask, () => {
        return stream((state, resolve) => {
          state.answer('failOnServer', () => {
            throw new Error('server-answer-boom');
          });

          state.ask('failOnClient').catch((err: Error) => {
            state.data.clientErr = err.message;
          });

          finishServer = () => resolve();
        }, {});
      });

      const msg = runErrorTask();
      const packetListener = vi.fn();
      msg.packetSubscribe(packetListener);

      msg.answer('failOnClient', () => {
        throw new Error('client-answer-boom');
      });

      await new Promise((r) => setTimeout(r, 15));

      await expect(msg.ask('failOnServer')).rejects.toThrow('server-answer-boom');
      expect(packetListener).toHaveBeenCalled();

      finishServer();
      const final = await msg;
      expect(final.clientErr).toBe('client-answer-boom');
    });

    it('supports duplex ask and answer with browser reactive stubs (.once)', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});

      type OnceQueries = {
        getTheme: () => string;
        getLocale: () => string;
      };

      const { irpc } = setupRemote('once-remote');
      const loadUi = irpc.declare<(page: string) => RemoteState<{ theme?: string; locale?: string }, OnceQueries>>({
        name: 'loadUi',
        seed: () => ({}),
        stream: true,
        coalesce: false,
      });

      let finishServer!: () => void;

      irpc.construct(loadUi, () => {
        return stream((state, resolve) => {
          state.answer('getLocale', () => 'en-US');

          state.ask('getTheme').then((theme) => {
            state.data.theme = theme;
          });

          finishServer = () => resolve();
        }, {});
      });

      const msg = loadUi.once('home');
      msg.answer('getTheme', () => 'dark');

      await new Promise((r) => setTimeout(r, 15));
      const locale = await msg.ask('getLocale');
      expect(locale).toBe('en-US');

      finishServer();
      await new Promise((r) => setTimeout(r, 15));

      expect(msg.data.theme).toBe('dark');

      vi.unstubAllGlobals();
    });

    it('supports duplex ask and answer across multiple reactive re-dispatches (.with and .later) isolated per call index', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});
      const prevReactive = isReactive();
      setReactive(true);

      type IndexedQueries = {
        getClientContext: (callIndex: number) => { callIndex: number; clientTag: string };
        getServerContext: (clientAskIndex: number) => { serverCallIndex: number; clientAskIndex: number };
      };

      const { irpc } = setupRemote('reactive-remote');
      const computeTask = irpc.declare<
        (input: string) => RemoteState<{ callIndex: number; input: string; matchedTag: string; serverEcho: string }, IndexedQueries>
      >({
        name: 'computeTask',
        seed: () => ({ callIndex: 0, input: '', matchedTag: '', serverEcho: '' }),
        stream: true,
        coalesce: false,
      });

      let serverCallCounter = 0;

      irpc.construct(computeTask, (input) => {
        const currentCallIndex = ++serverCallCounter;

        return stream(
          (state, resolve) => {
            // Server answers with its own captured currentCallIndex to prove client.ask hits this exact call's stream
            state.answer('getServerContext', (clientAskIndex) => ({
              serverCallIndex: currentCallIndex,
              clientAskIndex,
            }));

            // Server asks client, passing its currentCallIndex
            state.ask('getClientContext', currentCallIndex).then((ctx) => {
              state.data.callIndex = currentCallIndex;
              state.data.input = input;
              state.data.matchedTag = `${ctx?.callIndex}:${ctx?.clientTag}`;
              resolve();
            });
          },
          { callIndex: 0, input: '', matchedTag: '', serverEcho: '' }
        );
      });

      // 1. Concurrent independent calls must route ask/answer to their own call session without cross-talk
      const callA = computeTask('alpha');
      const callB = computeTask('beta');

      callA.answer('getClientContext', async (serverIdx) => {
        const srv = await callA.ask('getServerContext', 101);
        expect(srv).toEqual({ serverCallIndex: serverIdx, clientAskIndex: 101 });
        return { callIndex: serverIdx, clientTag: `client-A-for-${serverIdx}` };
      });

      callB.answer('getClientContext', async (serverIdx) => {
        const srv = await callB.ask('getServerContext', 202);
        expect(srv).toEqual({ serverCallIndex: serverIdx, clientAskIndex: 202 });
        return { callIndex: serverIdx, clientTag: `client-B-for-${serverIdx}` };
      });

      const [resA, resB] = await Promise.all([callA, callB]);
      expect(resA).toEqual({
        callIndex: 1,
        input: 'alpha',
        matchedTag: '1:client-A-for-1',
        serverEcho: '',
      });
      expect(resB).toEqual({
        callIndex: 2,
        input: 'beta',
        matchedTag: '2:client-B-for-2',
        serverEcho: '',
      });

      // 2. Test .with() across reactive dependency changes, verifying each re-dispatch binds to the new call index
      const reactiveInput = mutable({ value: 'run-3' });
      const scope = createLifecycle();

      let withMsg!: ReturnType<typeof computeTask.with>;
      scope.run(() => {
        withMsg = computeTask.with(() => [reactiveInput.value]);
      });

      const seenWithIndices: number[] = [];
      withMsg.answer('getClientContext', async (serverIdx) => {
        seenWithIndices.push(serverIdx);
        const srv = await withMsg.ask('getServerContext', serverIdx * 10);
        expect(srv).toEqual({ serverCallIndex: serverIdx, clientAskIndex: serverIdx * 10 });
        return { callIndex: serverIdx, clientTag: `with-session-${serverIdx}` };
      });

      await new Promise((r) => setTimeout(r, 20));
      expect(withMsg.data).toEqual({
        callIndex: 3,
        input: 'run-3',
        matchedTag: '3:with-session-3',
        serverEcho: '',
      });

      // Trigger reactive re-dispatch on .with() -> must create call #4 and route both ask & answer to call #4
      reactiveInput.value = 'run-4';

      await new Promise((r) => setTimeout(r, 30));
      expect(withMsg.data).toEqual({
        callIndex: 4,
        input: 'run-4',
        matchedTag: '4:with-session-4',
        serverEcho: '',
      });
      expect(seenWithIndices).toEqual([3, 4]);

      scope.destroy();

      // 3. Test .later() across multiple manual .dispatch() calls, verifying each dispatch gets a fresh call ID & session
      const laterScope = createLifecycle();
      let laterMsg!: ReturnType<typeof computeTask.later>;
      laterScope.run(() => {
        laterMsg = computeTask.later();
      });

      const seenLaterIds: string[] = [];
      laterMsg.answer('getClientContext', async (serverIdx) => {
        seenLaterIds.push(laterMsg.id);
        const srv = await laterMsg.ask('getServerContext', serverIdx * 100);
        expect(srv).toEqual({ serverCallIndex: serverIdx, clientAskIndex: serverIdx * 100 });
        return { callIndex: serverIdx, clientTag: `later-session-${serverIdx}` };
      });

      await laterMsg.dispatch('manual-5');
      await new Promise((r) => setTimeout(r, 20));
      expect(laterMsg.data).toEqual({
        callIndex: 5,
        input: 'manual-5',
        matchedTag: '5:later-session-5',
        serverEcho: '',
      });

      await laterMsg.dispatch('manual-6');
      await new Promise((r) => setTimeout(r, 20));
      expect(laterMsg.data).toEqual({
        callIndex: 6,
        input: 'manual-6',
        matchedTag: '6:later-session-6',
        serverEcho: '',
      });

      // Each .later().dispatch() must have generated a distinct call ID
      expect(seenLaterIds.length).toBe(2);
      expect(seenLaterIds[0]).not.toBe(seenLaterIds[1]);

      laterScope.destroy();
      setReactive(prevReactive!);
      vi.unstubAllGlobals();
    });

    it('resolves queued asks to undefined if state is closed before bridge is bound', async () => {
      const { stream: createStream } = await import('../src/index.js');
      let askPromise!: Promise<unknown>;

      const state = createStream((s) => {
        askPromise = s.ask('unbridged');
      }, {});

      state.close();
      expect(await askPromise).toBeUndefined();

      // Binding after close also resolves any remaining queued asks to undefined
      state.bindAsk(async () => 'never');
    });

    it('handles orphaned ask/reply packets and non-RemoteState stream queries gracefully', async () => {
      const { irpc, router } = setupRemote('orphan-remote');

      // Direct resolver calls for an unknown or already closed callId return undefined
      const orphanAsk = new IRPCResolver(
        { id: 'q1', callId: 'missing-call', type: 'ask', name: 'none', args: ['ping'] },
        irpc
      );
      expect(await orphanAsk.resolve()).toEqual({ id: 'q1', name: 'none', result: undefined });

      const orphanReply = new IRPCResolver(
        { id: 'q2', callId: 'missing-call', type: 'reply', name: 'none', args: ['pong'] },
        irpc
      );
      expect(await orphanReply.resolve()).toEqual({ id: 'q2', name: 'none', result: undefined });

      // Stream that has not initialized a RemoteState yet returns undefined for answerQuery and ignores unknown resolveQuery
      const plainStream = new IRPCStream(
        'plain-1',
        'plain',
        async () => ({ id: 'plain-1', name: 'plain', result: 'ok' }),
        undefined,
        router
      );
      expect(await plainStream.answerQuery('any')).toBeUndefined();
      expect(() => plainStream.resolveQuery('unknown-query-id', 'data')).not.toThrow();
    });
  });
});
