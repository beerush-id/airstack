import { createContextStore, HandlerError, withContext } from '@irpclib/irpc';
import { describe, expect, it } from 'vitest';
import { fsContext } from '../../src/context.js';
import { mountAt, resolve, resolveCwd, stripMount } from '../../src/utils/path.js';

const run = <T>(fn: () => Promise<T> | T) => withContext(createContextStore(), fn);

/**
 * Full EACCES denial contract: variant, code, exact public message,
 * exact server cause, and leak-free public surface.
 *
 * @param fn - Resolution attempt expected to breach an access boundary.
 * @param want - Canonical path and op the exact server cause must carry.
 *   `gated` marks an allow-list denial inside a matching rule; otherwise an
 *   op rides the outside-path denial.
 */
function expectDenied(fn: () => unknown, want: { path: string; op?: string; gated?: boolean }): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HandlerError);
    expect((error as { code?: unknown }).code).toBe('EACCES');
    const message = (error as Error).message;
    expect(message).toBe('Permission denied');
    expect(message).not.toMatch(/[/\\]/);
    expect(message).not.toMatch(/r2|d1|bucket|sql|storage|driver/i);
    const cause = (error as { cause?: unknown }).cause;
    expect(cause).toBeInstanceOf(Error);
    const detail = (cause as Error).message;
    const expected = want.gated
      ? `Operation '${want.op}' not permitted on '${want.path}' outside accessRules`
      : want.op
        ? `Permission denied for path '${want.path}' outside accessRules (operation '${want.op}' not permitted)`
        : `Permission denied for path '${want.path}' outside accessRules`;
    expect(detail).toBe(expected);
    return;
  }
  expect.unreachable();
}

describe('resolve identity', () => {
  it('exposes resolve alongside resolveCwd and resolve.cwd', () =>
    run(() => {
      expect(typeof resolve).toBe('function');
      expect(typeof resolveCwd).toBe('function');
      expect(typeof resolve.cwd).toBe('function');
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      expect(resolve.cwd('/projects/app')).toBe('/projects/app');
      expect(resolveCwd('/projects/app')).toBe('/projects/app');
      expect(resolve.cwd()).toBe('/users/alice');
      expect(resolveCwd()).toBe('/users/alice');
    }));

  it('returns PathInfo on acme tenant mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', '~/notes.txt');
      expect(info.path).toBe('/tenants/acme/users/alice/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/acme/users/alice');
      expect(info.cwd).toBe('/tenants/acme/users/alice');
    }));

  it('returns PathInfo on globex tenant mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob' });
      const info = resolve('/tenants/globex', '~/notes.txt');
      expect(info.path).toBe('/tenants/globex/users/bob/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/globex/users/bob');
      expect(info.cwd).toBe('/tenants/globex/users/bob');
    }));
});

describe('resolveCwd fallback', () => {
  it('resolveCwd prefers explicit cwd over home', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      expect(resolveCwd('/projects/app')).toBe('/projects/app');
      expect(resolve.cwd('/projects/app')).toBe('/projects/app');
    }));

  it('resolveCwd uses home absent explicit cwd', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob' });
      expect(resolveCwd()).toBe('/users/bob');
      expect(resolve.cwd()).toBe('/users/bob');
    }));

  it('resolveCwd uses default home absent cwd and homeDir', () =>
    run(() => {
      fsContext.set({});
      expect(resolveCwd()).toBe('/home');
      expect(resolve.cwd()).toBe('/home');
    }));
});

describe('home expansion', () => {
  it('expands bare tilde to alice home on acme mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', '~');
      expect(info.path).toBe('/tenants/acme/users/alice');
      expect(info.name).toBe('alice');
      expect(info.directory).toBe('/tenants/acme/users');
      expect(info.cwd).toBe('/tenants/acme/users/alice');
    }));

  it('expands tilde notes path to bob home on globex mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob' });
      const info = resolve('/tenants/globex', '~/notes.txt');
      expect(info.path).toBe('/tenants/globex/users/bob/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/globex/users/bob');
      expect(info.cwd).toBe('/tenants/globex/users/bob');
    }));

  it('expands tilde notes path to default home absent homeDir', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '~/notes.txt');
      expect(info.path).toBe('/tenants/acme/home/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/acme/home');
      expect(info.cwd).toBe('/tenants/acme/home');
    }));

  it('ignores cwd during tilde expansion', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', '~/notes.txt', '/projects/app');
      expect(info.path).toBe('/tenants/acme/users/alice/notes.txt');
      expect(info.cwd).toBe('/tenants/acme/projects/app');
    }));
});

describe('canonical absolutes', () => {
  it('keeps canonical absolute stable across distinct cwd values', () =>
    run(() => {
      fsContext.set({});
      const first = resolve('/tenants/acme', '/shared/spec.md', '/projects/app');
      expect(first.path).toBe('/tenants/acme/shared/spec.md');
      expect(first.name).toBe('spec.md');
      expect(first.directory).toBe('/tenants/acme/shared');
      const second = resolve('/tenants/acme', '/shared/spec.md', '/other/cwd');
      expect(second.path).toBe('/tenants/acme/shared/spec.md');
    }));

  it('admits absolute inside home despite narrow outside rule', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/shared/config.json'],
      });
      const info = resolve('/tenants/globex', '/users/bob/notes.txt');
      expect(info.path).toBe('/tenants/globex/users/bob/notes.txt');
    }));

  it('denies absolute outside home lacking matching rule', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      expectDenied(() => resolve('/tenants/acme', '/etc/shadow'), { path: '/etc/shadow' });
    }));

  it('admits absolute outside home under matching rule', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      const info = resolve('/tenants/acme', '/shared/config.json');
      expect(info.path).toBe('/tenants/acme/shared/config.json');
      expect(info.name).toBe('config.json');
      expect(info.directory).toBe('/tenants/acme/shared');
    }));
});

describe('relative resolution', () => {
  it('resolves relative name against explicit cwd', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', 'config.json', '/projects/app');
      expect(info.path).toBe('/tenants/acme/projects/app/config.json');
      expect(info.name).toBe('config.json');
      expect(info.directory).toBe('/tenants/acme/projects/app');
      expect(info.cwd).toBe('/tenants/acme/projects/app');
    }));

  it('resolves dot and dot-dot segments against cwd', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const nested = resolve('/tenants/acme', './src/button.tsx', '/projects/app');
      expect(nested.path).toBe('/tenants/acme/projects/app/src/button.tsx');
      const parent = resolve('/tenants/acme', '../index.ts', '/projects/app/src');
      expect(parent.path).toBe('/tenants/acme/projects/app/index.ts');
    }));

  it('resolves relative name against home absent explicit cwd', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob' });
      const info = resolve('/tenants/globex', 'notes.txt');
      expect(info.path).toBe('/tenants/globex/users/bob/notes.txt');
      expect(info.cwd).toBe('/tenants/globex/users/bob');
    }));

  it('resolves relative name against default home absent cwd and homeDir', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', 'notes.txt');
      expect(info.path).toBe('/tenants/acme/home/notes.txt');
      expect(info.cwd).toBe('/tenants/acme/home');
    }));

  it('empty relative resolves to effective cwd itself on acme tenant', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const explicit = resolve('/tenants/acme', '', '/projects/app');
      expect(explicit.path).toBe('/tenants/acme/projects/app');
      expect(explicit.name).toBe('app');
      expect(explicit.directory).toBe('/tenants/acme/projects');
      expect(explicit.cwd).toBe('/tenants/acme/projects/app');
      const homed = resolve('/tenants/acme', '');
      expect(homed.path).toBe('/tenants/acme/users/alice');
      expect(homed.name).toBe('alice');
      expect(homed.directory).toBe('/tenants/acme/users');
      expect(homed.cwd).toBe('/tenants/acme/users/alice');
    }));
});

describe('single root clamping', () => {
  it('clamps slash-dot-dot to mount root', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/..');
      expect(info.path).toBe('/tenants/acme');
    }));

  it('clamps deep parent traversal at mount root', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', '/a/../../..');
      expect(info.path).toBe('/tenants/acme');
    }));

  it('preserves tilde parent traversal absent rules', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', '~/..');
      expect(info.path).toBe('/tenants/acme/users');
    }));

  it('preserves relative escape past cwd absent rules', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/acme', '../../etc/passwd', '/projects/app');
      expect(info.path).toBe('/tenants/acme/etc/passwd');
    }));

  it('denies preserved traversal via access control instead of redirecting', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      expectDenied(() => resolve('/tenants/acme', '~/..'), { path: '/users' });
      expectDenied(() => resolve('/tenants/acme', '../../etc/passwd', '/projects/app'), {
        path: '/etc/passwd',
      });
    }));
});

describe('access rule patterns', () => {
  it('exact rule admits only its own path', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      const hit = resolve('/tenants/acme', '/shared/config.json');
      expect(hit.path).toBe('/tenants/acme/shared/config.json');
      expectDenied(() => resolve('/tenants/acme', '/shared/other.json'), {
        path: '/shared/other.json',
      });
      expectDenied(() => resolve('/tenants/acme', '/shared/config.json/bak'), {
        path: '/shared/config.json/bak',
      });
    }));

  it('star rule admits immediate children and denies nested paths', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/*'],
      });
      const hit = resolve('/tenants/acme', '/teams/backend/server.ts');
      expect(hit.path).toBe('/tenants/acme/teams/backend/server.ts');
      expectDenied(() => resolve('/tenants/acme', '/teams/backend/src/server.ts'), {
        path: '/teams/backend/src/server.ts',
      });
      expectDenied(() => resolve('/tenants/acme', '/teams/backend'), {
        path: '/teams/backend',
      });
    }));

  it('recursive wildcard covers directory itself and deep descendants', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      expect(resolve('/tenants/acme', '/teams/backend').path).toBe('/tenants/acme/teams/backend');
      expect(resolve('/tenants/acme', '/teams/backend/readme.md').path).toBe(
        '/tenants/acme/teams/backend/readme.md',
      );
      expect(resolve('/tenants/acme', '/teams/backend/src/api/main.go').path).toBe(
        '/tenants/acme/teams/backend/src/api/main.go',
      );
      expectDenied(() => resolve('/tenants/acme', '/teams/frontend/secret.env'), {
        path: '/teams/frontend/secret.env',
      });
    }));

  it('slash rule grants universal access', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/'],
      });
      expect(resolve('/tenants/acme', '/etc/shadow').path).toBe('/tenants/acme/etc/shadow');
      expect(resolve('/tenants/acme', '/users/bob/id_rsa').path).toBe(
        '/tenants/acme/users/bob/id_rsa',
      );
    }));

  it('recursive universal rule grants universal access', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/**'],
      });
      expect(resolve('/tenants/globex', '/etc/shadow').path).toBe('/tenants/globex/etc/shadow');
      expect(resolve('/tenants/globex', '/users/alice/notes.txt').path).toBe(
        '/tenants/globex/users/alice/notes.txt',
      );
    }));

  it('patterns apply to canonical path after normalization', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      const hit = resolve('/tenants/acme', '../common.ts', '/teams/backend/services');
      expect(hit.path).toBe('/tenants/acme/teams/backend/common.ts');
      expectDenied(
        () => resolve('/tenants/acme', '../../teams/frontend/secret.env', '/teams/backend'),
        { path: '/teams/frontend/secret.env' },
      );
    }));

  it('object rule gates operations via allow list', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'read').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'list').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
      expectDenied(() => resolve('/tenants/acme', 'readme.md', '/shared/docs', 'write'), {
        path: '/shared/docs/readme.md',
        op: 'write',
        gated: true,
      });
      expectDenied(() => resolve('/tenants/acme', 'readme.md', '/shared/docs', 'remove'), {
        path: '/shared/docs/readme.md',
        op: 'remove',
        gated: true,
      });
    }));

  it('string rule admits all operations', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/docs/**'],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'write').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'remove').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('home admits all operations despite narrow outside allow list', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read'] }],
      });
      expect(resolve('/tenants/acme', '~/diary.txt', undefined, 'write').path).toBe(
        '/tenants/acme/users/alice/diary.txt',
      );
      expect(resolve('/tenants/acme', '~/temp.txt', undefined, 'remove').path).toBe(
        '/tenants/acme/users/alice/temp.txt',
      );
    }));
});

describe('deployment scopes', () => {
  it('open scope resolves directly on tenant storage absent identity', () =>
    run(() => {
      fsContext.set({});
      expect(resolve('/tenants/acme', '~/notes.txt').path).toBe('/tenants/acme/home/notes.txt');
      expect(resolve('/tenants/acme', 'notes.txt').path).toBe('/tenants/acme/home/notes.txt');
      expect(resolve('/tenants/acme', '/etc/hosts', '/projects/app').path).toBe(
        '/tenants/acme/etc/hosts',
      );
      expect(resolve('/tenants/acme', '../../etc/passwd', '/projects/app').path).toBe(
        '/tenants/acme/etc/passwd',
      );
    }));

  it('user-scoped scope isolates alice home and shares team path by rule', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      expect(resolve('/tenants/acme', '~/notes.txt').path).toBe(
        '/tenants/acme/users/alice/notes.txt',
      );
      expect(resolve('/tenants/acme', 'deploy.yaml', '/teams/backend', 'write').path).toBe(
        '/tenants/acme/teams/backend/deploy.yaml',
      );
      expectDenied(() => resolve('/tenants/acme', '/teams/frontend/secret.env'), {
        path: '/teams/frontend/secret.env',
      });
    }));

  it('multi-tenant scope partitions physical paths under shared enforcement', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/projects/core-api/**'],
      });
      expect(resolve('/tenants/acme', 'main.go', '/projects/core-api/src', 'write').path).toBe(
        '/tenants/acme/projects/core-api/src/main.go',
      );
      expect(resolve('/tenants/globex', 'main.go', '/projects/core-api/src', 'write').path).toBe(
        '/tenants/globex/projects/core-api/src/main.go',
      );
      expectDenied(() => resolve('/tenants/globex', '/projects/finance-api/keys.json'), {
        path: '/projects/finance-api/keys.json',
      });
    }));
});

describe('denial contract', () => {
  it('denial cause carries canonical path and operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expectDenied(() => resolve('/tenants/acme', 'readme.md', '/shared/docs', 'write'), {
        path: '/shared/docs/readme.md',
        op: 'write',
        gated: true,
      });
      expectDenied(() => resolve('/tenants/acme', '/etc/shadow', '/projects/app', 'read'), {
        path: '/etc/shadow',
        op: 'read',
      });
    }));

  it('denial attributes relative escape to resolved target', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      expectDenied(() => resolve('/tenants/acme', 'notes.txt', '/users/bob'), {
        path: '/users/bob/notes.txt',
      });
    }));
});

describe('path forms across scopes', () => {
  it('bare tilde resolves to default home in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '~');
      expect(info.path).toBe('/tenants/acme/home');
      expect(info.name).toBe('home');
      expect(info.directory).toBe('/tenants/acme');
      expect(info.cwd).toBe('/tenants/acme/home');
    }));

  it('bare tilde resolves to alice home in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', '~');
      expect(info.path).toBe('/tenants/acme/users/alice');
      expect(info.name).toBe('alice');
      expect(info.directory).toBe('/tenants/acme/users');
      expect(info.cwd).toBe('/tenants/acme/users/alice');
    }));

  it('bare tilde resolves to bob home in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', '~');
      expect(info.path).toBe('/tenants/globex/users/bob');
      expect(info.name).toBe('bob');
      expect(info.directory).toBe('/tenants/globex/users');
      expect(info.cwd).toBe('/tenants/globex/users/bob');
    }));

  it('tilde subpath resolves against default home in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '~/notes.txt');
      expect(info.path).toBe('/tenants/acme/home/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/acme/home');
      expect(info.cwd).toBe('/tenants/acme/home');
    }));

  it('tilde subpath resolves against alice home in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', '~/notes.txt');
      expect(info.path).toBe('/tenants/acme/users/alice/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/acme/users/alice');
      expect(info.cwd).toBe('/tenants/acme/users/alice');
    }));

  it('tilde subpath resolves against bob home in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', '~/notes.txt');
      expect(info.path).toBe('/tenants/globex/users/bob/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/globex/users/bob');
      expect(info.cwd).toBe('/tenants/globex/users/bob');
    }));

  it('absolute resolves stable against explicit cwd in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/shared/spec.md', '/projects/app');
      expect(info.path).toBe('/tenants/acme/shared/spec.md');
      expect(info.name).toBe('spec.md');
      expect(info.directory).toBe('/tenants/acme/shared');
      expect(info.cwd).toBe('/tenants/acme/projects/app');
    }));

  it('absolute resolves stable against explicit cwd in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', '/shared/spec.md', '/projects/app');
      expect(info.path).toBe('/tenants/acme/shared/spec.md');
      expect(info.name).toBe('spec.md');
      expect(info.directory).toBe('/tenants/acme/shared');
      expect(info.cwd).toBe('/tenants/acme/projects/app');
    }));

  it('absolute resolves stable against explicit cwd in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', '/shared/spec.md', '/projects/app');
      expect(info.path).toBe('/tenants/globex/shared/spec.md');
      expect(info.name).toBe('spec.md');
      expect(info.directory).toBe('/tenants/globex/shared');
      expect(info.cwd).toBe('/tenants/globex/projects/app');
    }));

  it('bare relative resolves against default home in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', 'notes.txt');
      expect(info.path).toBe('/tenants/acme/home/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/acme/home');
      expect(info.cwd).toBe('/tenants/acme/home');
    }));

  it('bare relative resolves against alice home in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', 'notes.txt');
      expect(info.path).toBe('/tenants/acme/users/alice/notes.txt');
      expect(info.cwd).toBe('/tenants/acme/users/alice');
    }));

  it('bare relative resolves against bob home in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', 'notes.txt');
      expect(info.path).toBe('/tenants/globex/users/bob/notes.txt');
      expect(info.cwd).toBe('/tenants/globex/users/bob');
    }));

  it('dot relative resolves against explicit cwd in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', './src/button.tsx', '/projects/app');
      expect(info.path).toBe('/tenants/acme/projects/app/src/button.tsx');
      expect(info.name).toBe('button.tsx');
      expect(info.cwd).toBe('/tenants/acme/projects/app');
    }));

  it('dot relative resolves against explicit cwd in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', './src/button.tsx', '/projects/app');
      expect(info.path).toBe('/tenants/acme/projects/app/src/button.tsx');
      expect(info.cwd).toBe('/tenants/acme/projects/app');
    }));

  it('dot relative resolves against explicit cwd in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', './src/button.tsx', '/projects/app');
      expect(info.path).toBe('/tenants/globex/projects/app/src/button.tsx');
      expect(info.cwd).toBe('/tenants/globex/projects/app');
    }));

  it('dotdot relative resolves against explicit cwd in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '../index.ts', '/projects/app/src');
      expect(info.path).toBe('/tenants/acme/projects/app/index.ts');
      expect(info.name).toBe('index.ts');
    }));

  it('dotdot relative resolves against explicit cwd in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', '../index.ts', '/projects/app/src');
      expect(info.path).toBe('/tenants/acme/projects/app/index.ts');
    }));

  it('dotdot relative resolves against explicit cwd in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', '../index.ts', '/projects/app/src');
      expect(info.path).toBe('/tenants/globex/projects/app/index.ts');
    }));

  it('root clamp holds at mount root in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/..');
      expect(info.path).toBe('/tenants/acme');
    }));

  it('root clamp holds at mount root in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', '/a/../../..');
      expect(info.path).toBe('/tenants/acme');
    }));

  it('root clamp holds at mount root in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', '/a/../../..');
      expect(info.path).toBe('/tenants/globex');
    }));
});

describe('pattern kinds across scopes', () => {
  it('exact path admits without rules in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/shared/config.json');
      expect(info.path).toBe('/tenants/acme/shared/config.json');
    }));

  it('exact rule admits its own path in user scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      const info = resolve('/tenants/acme', '/shared/config.json');
      expect(info.path).toBe('/tenants/acme/shared/config.json');
    }));

  it('exact rule admits its own path in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/shared/config.json'],
      });
      const info = resolve('/tenants/globex', '/shared/config.json');
      expect(info.path).toBe('/tenants/globex/shared/config.json');
    }));

  it('star path admits without rules in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/teams/backend/server.ts');
      expect(info.path).toBe('/tenants/acme/teams/backend/server.ts');
    }));

  it('star rule admits immediate child in user scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/*'],
      });
      const info = resolve('/tenants/acme', '/teams/backend/server.ts');
      expect(info.path).toBe('/tenants/acme/teams/backend/server.ts');
    }));

  it('star rule admits immediate child in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/teams/backend/*'],
      });
      const info = resolve('/tenants/globex', '/teams/backend/server.ts');
      expect(info.path).toBe('/tenants/globex/teams/backend/server.ts');
    }));

  it('recursive path admits without rules in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/teams/backend/src/api/main.go');
      expect(info.path).toBe('/tenants/acme/teams/backend/src/api/main.go');
    }));

  it('recursive rule admits deep descendant in user scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      const info = resolve('/tenants/acme', '/teams/backend/src/api/main.go');
      expect(info.path).toBe('/tenants/acme/teams/backend/src/api/main.go');
    }));

  it('recursive rule admits deep descendant in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/teams/backend/**'],
      });
      const info = resolve('/tenants/globex', '/teams/backend/src/api/main.go');
      expect(info.path).toBe('/tenants/globex/teams/backend/src/api/main.go');
    }));

  it('outside path admits without rules in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/etc/shadow');
      expect(info.path).toBe('/tenants/acme/etc/shadow');
    }));

  it('slash rule admits outside path in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/tenants/acme', '/etc/shadow');
      expect(info.path).toBe('/tenants/acme/etc/shadow');
    }));

  it('slash rule admits outside path in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/'] });
      const info = resolve('/tenants/globex', '/etc/shadow');
      expect(info.path).toBe('/tenants/globex/etc/shadow');
    }));

  it('foreign home admits without rules in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', '/users/bob/id_rsa');
      expect(info.path).toBe('/tenants/acme/users/bob/id_rsa');
    }));

  it('recursive universal rule admits foreign home in user scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/**'] });
      const info = resolve('/tenants/acme', '/users/bob/id_rsa');
      expect(info.path).toBe('/tenants/acme/users/bob/id_rsa');
    }));

  it('recursive universal rule admits foreign home in multi-tenant scope', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob', accessRules: ['/**'] });
      const info = resolve('/tenants/globex', '/users/alice/notes.txt');
      expect(info.path).toBe('/tenants/globex/users/alice/notes.txt');
    }));

  it('gated read admits without rules in open scope', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/acme', 'readme.md', '/shared/docs', 'read');
      expect(info.path).toBe('/tenants/acme/shared/docs/readme.md');
    }));

  it('object rule admits gated read in user scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      const info = resolve('/tenants/acme', 'readme.md', '/shared/docs', 'read');
      expect(info.path).toBe('/tenants/acme/shared/docs/readme.md');
    }));

  it('object rule admits gated read in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      const info = resolve('/tenants/globex', 'readme.md', '/shared/docs', 'read');
      expect(info.path).toBe('/tenants/globex/shared/docs/readme.md');
    }));
});

describe('operation gating across operation set', () => {
  it('object rule admits read operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'read').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('object rule admits list operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'list').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('object rule denies write operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expectDenied(() => resolve('/tenants/acme', 'readme.md', '/shared/docs', 'write'), {
        path: '/shared/docs/readme.md',
        op: 'write',
        gated: true,
      });
    }));

  it('object rule denies remove operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expectDenied(() => resolve('/tenants/acme', 'readme.md', '/shared/docs', 'remove'), {
        path: '/shared/docs/readme.md',
        op: 'remove',
        gated: true,
      });
    }));

  it('string rule admits read operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/docs/**'],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'read').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('string rule admits list operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/docs/**'],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'list').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('string rule admits write operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/docs/**'],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'write').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('string rule admits remove operation', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/docs/**'],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs', 'remove').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));

  it('default operation admits under matching string rule', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/docs/**'],
      });
      expect(resolve('/tenants/acme', 'readme.md', '/shared/docs').path).toBe(
        '/tenants/acme/shared/docs/readme.md',
      );
    }));
});

describe('mountPoint variance', () => {
  it('absolute resolves under root mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/', '/shared/spec.md', '/projects/app');
      expect(info.path).toBe('/shared/spec.md');
      expect(info.name).toBe('spec.md');
    }));

  it('root mount top-level file reports root directory', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/', '/notes.txt', '/projects/app');
      expect(info.path).toBe('/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/');
      expect(info.cwd).toBe('/projects/app');
    }));

  it('absolute resolves under Volumes mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/Volumes/SSD1', '/shared/spec.md', '/projects/app');
      expect(info.path).toBe('/Volumes/SSD1/shared/spec.md');
      expect(info.name).toBe('spec.md');
      expect(info.directory).toBe('/Volumes/SSD1/shared');
    }));

  it('absolute resolves under mnt storage mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice', accessRules: ['/'] });
      const info = resolve('/mnt/storage', '/shared/spec.md', '/projects/app');
      expect(info.path).toBe('/mnt/storage/shared/spec.md');
      expect(info.name).toBe('spec.md');
      expect(info.directory).toBe('/mnt/storage/shared');
    }));

  it('tilde subpath resolves under root mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/', '~/notes.txt');
      expect(info.path).toBe('/users/alice/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.cwd).toBe('/users/alice');
    }));

  it('tilde subpath resolves under Volumes mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/Volumes/SSD1', '~/notes.txt');
      expect(info.path).toBe('/Volumes/SSD1/users/alice/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.cwd).toBe('/Volumes/SSD1/users/alice');
    }));

  it('tilde subpath resolves under mnt storage mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/mnt/storage', '~/notes.txt');
      expect(info.path).toBe('/mnt/storage/users/alice/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.cwd).toBe('/mnt/storage/users/alice');
    }));

  it('same team input partitions across tenant mounts', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      expect(resolve('/tenants/acme', 'deploy.yaml', '/teams/backend', 'read').path).toBe(
        '/tenants/acme/teams/backend/deploy.yaml',
      );
      expect(resolve('/tenants/globex', 'deploy.yaml', '/teams/backend', 'read').path).toBe(
        '/tenants/globex/teams/backend/deploy.yaml',
      );
    }));
});

describe('multi-user tenant variance', () => {
  it('bob tilde binds to bob home on acme mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob' });
      const info = resolve('/tenants/acme', '~/notes.txt');
      expect(info.path).toBe('/tenants/acme/users/bob/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.directory).toBe('/tenants/acme/users/bob');
      expect(info.cwd).toBe('/tenants/acme/users/bob');
    }));

  it('alice tilde binds to alice home on globex mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/globex', '~/notes.txt');
      expect(info.path).toBe('/tenants/globex/users/alice/notes.txt');
      expect(info.cwd).toBe('/tenants/globex/users/alice');
    }));

  it('default identity falls back to default home on globex mount', () =>
    run(() => {
      fsContext.set({});
      const info = resolve('/tenants/globex', 'notes.txt');
      expect(info.path).toBe('/tenants/globex/home/notes.txt');
      expect(info.cwd).toBe('/tenants/globex/home');
    }));

  it('bob relative binds to bob home on acme mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'bob', homeDir: '/users/bob' });
      const info = resolve('/tenants/acme', 'notes.txt');
      expect(info.path).toBe('/tenants/acme/users/bob/notes.txt');
      expect(info.cwd).toBe('/tenants/acme/users/bob');
    }));

  it('alice relative binds to alice home on globex mount', () =>
    run(() => {
      fsContext.set({ ownerId: 'alice', homeDir: '/users/alice' });
      const info = resolve('/tenants/globex', 'notes.txt');
      expect(info.path).toBe('/tenants/globex/users/alice/notes.txt');
      expect(info.cwd).toBe('/tenants/globex/users/alice');
    }));
});

describe('denial contract facets', () => {
  it('denial for absolute outside home carries path and read op', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      expectDenied(() => resolve('/tenants/acme', '/etc/shadow', '/projects/app', 'read'), {
        path: '/etc/shadow',
        op: 'read',
      });
    }));

  it('denial for exact mismatch carries target path', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/shared/config.json'],
      });
      expectDenied(() => resolve('/tenants/acme', '/shared/other.json'), {
        path: '/shared/other.json',
      });
    }));

  it('denial for star nested path carries target path', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/*'],
      });
      expectDenied(() => resolve('/tenants/acme', '/teams/backend/src/server.ts'), {
        path: '/teams/backend/src/server.ts',
      });
    }));

  it('denial for star bare directory carries target path', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/teams/backend/*'],
      });
      expectDenied(() => resolve('/tenants/globex', '/teams/backend'), {
        path: '/teams/backend',
      });
    }));

  it('denial for recursive mismatch carries target path', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/teams/backend/**'],
      });
      expectDenied(() => resolve('/tenants/globex', '/teams/frontend/secret.env'), {
        path: '/teams/frontend/secret.env',
      });
    }));

  it('denial for tilde parent traversal carries canonical path in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/shared/config.json'],
      });
      expectDenied(() => resolve('/tenants/globex', '~/..'), { path: '/users' });
    }));

  it('denial for relative escape carries canonical path in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/teams/backend/**'],
      });
      expectDenied(() => resolve('/tenants/globex', '../../etc/passwd', '/projects/app'), {
        path: '/etc/passwd',
      });
    }));

  it('denial for cross-mount absolute carries target path', () =>
    run(() => {
      fsContext.set({
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: ['/projects/core-api/**'],
      });
      expectDenied(() => resolve('/tenants/acme', '/projects/finance-api/keys.json'), {
        path: '/projects/finance-api/keys.json',
      });
    }));

  it('denial for relative outside cwd carries resolved target and write op', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: ['/teams/backend/**'],
      });
      expectDenied(() => resolve('/tenants/acme', 'notes.txt', '/users/bob', 'write'), {
        path: '/users/bob/notes.txt',
        op: 'write',
      });
    }));

  it('denial for gated write carries path and op in multi-tenant scope', () =>
    run(() => {
      fsContext.set({
        ownerId: 'alice',
        homeDir: '/users/alice',
        accessRules: [{ path: '/shared/docs/**', allow: ['read', 'list'] }],
      });
      expectDenied(() => resolve('/tenants/globex', 'readme.md', '/shared/docs', 'write'), {
        path: '/shared/docs/readme.md',
        op: 'write',
        gated: true,
      });
    }));
});

describe('mount mapping', () => {
  it('prepends a tenant mount to the canonical path', () =>
    run(() => {
      expect(mountAt('/tenants/acme', '/shared/hero.png')).toBe('/tenants/acme/shared/hero.png');
    }));

  it('passes the canonical path through on the root mount', () =>
    run(() => {
      expect(mountAt('/', '/shared/hero.png')).toBe('/shared/hero.png');
    }));

  it('joins a relative path under the mount', () =>
    run(() => {
      expect(mountAt('/mnt/storage', 'docs/spec.md')).toBe('/mnt/storage/docs/spec.md');
    }));

  it('collapses a trailing-slash mount', () =>
    run(() => {
      expect(mountAt('/tenants/acme/', '/hero.png')).toBe('/tenants/acme/hero.png');
    }));
});

describe('mount stripping', () => {
  it('hides the tenant prefix recovering the canonical path', () =>
    run(() => {
      expect(stripMount('/tenants/acme', '/tenants/acme/shared/hero.png')).toBe('/shared/hero.png');
    }));

  it('leaves the path unchanged on the root mount', () =>
    run(() => {
      expect(stripMount('/', '/shared/hero.png')).toBe('/shared/hero.png');
    }));

  it('leaves foreign mounts untouched', () =>
    run(() => {
      expect(stripMount('/tenants/acme', '/tenants/globex/hero.png')).toBe('/tenants/globex/hero.png');
    }));

  it('leaves the bare mount path itself untouched', () =>
    run(() => {
      expect(stripMount('/tenants/acme', '/tenants/acme')).toBe('/tenants/acme');
    }));

  it('round-trips mapping and stripping', () =>
    run(() => {
      expect(stripMount('/tenants/acme', mountAt('/tenants/acme', '/shared/hero.png'))).toBe(
        '/shared/hero.png'
      );
    }));
});
