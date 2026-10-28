import {
  type AnyType,
  COOKIE_JAR_KEY,
  COOKIE_JAR_WRITABLE,
  decodeCookies,
  isBrowser,
  setCookieContext,
  setScope,
} from '@airlib/core';
import type { HTTPTransport } from '@irpclib/http';
import type { HTTPRouter } from '@irpclib/http/router';
import { createAssetResolver, resolveCacheControl } from './assets.js';
import { SSR_ENV_KEY } from './context.js';
import { createStatic } from './static.js';
import type { AppWorkerOptions, SSRContextSeed, SSRRenderer, WsSender } from './types.js';

export function createWorker<E = AnyType>(renderer: SSRRenderer, options: AppWorkerOptions<E> = {}) {
  const staticRes = createStatic(renderer.router, options);
  const defaultAssetResolver = createAssetResolver(options);

  return {
    router: renderer.router,
    options,
    async fetch(request: Request, env?: E, _signal?: AbortSignal, ssg?: boolean) {
      const {
        template = '',
        headTag = '<!--ssr-head-->',
        bodyTag = '<!--ssr-outlet-->',
        timeout,
        resolveAsset = defaultAssetResolver,
        resolveContext,
        createResponse = createDefaultResponse,
      } = options;

      const controller = new AbortController();

      const abort = (reason: unknown) => controller.abort(reason);
      request.signal.addEventListener('abort', abort, { once: true });

      const timerId: AnyType = timeout ? setTimeout(() => abort('timeout'), timeout) : null;

      try {
        const cookie = request.headers.get('cookie') ?? '';
        const url = new URL(request.url);

        const contextSeed: SSRContextSeed = (await resolveContext?.(request, url, env)) ?? [];
        if (env) contextSeed.push([SSR_ENV_KEY, env as E]);

        if (!ssg && url.pathname !== '/' && typeof resolveAsset === 'function') {
          const asset = await resolveAsset(request, url, env);
          if (asset) return asset;
        }

        const match = renderer.router?.find(url, true);
        const { deferred, noscript, static: isStatic } = match?.route.options ?? {};

        const cached = !ssg && isStatic ? await staticRes.get(url, env, match!.route) : undefined;
        if (cached) {
          return createResponse(new Response(cached.html, { status: 200, headers: cached.headers }));
        }

        const { html, head, status, cookies, redirect, contentType } = await renderer({
          url: url.href,
          cookie,
          context: contextSeed,
          controller,
          hydrated: !template.includes('<html dehydrated'),
        });

        let body = contentType
          ? html
          : template.replace('<html dehydrated', '<html').replace(headTag, head).replace(bodyTag, html);

        if (deferred !== false || noscript) {
          body = deferScript(body, typeof deferred === 'number' ? deferred : undefined, !options.devMode && noscript);
        }

        const headers = new Headers({
          'Content-Type': contentType ?? 'text/html',
        });
        cookies.forEach((cookie) => {
          headers.append('Set-Cookie', cookie);
        });

        if (redirect) {
          headers.append('Location', redirect);
        }

        const pageCache = resolveCacheControl(options.cache?.pages, url);
        if (pageCache && !redirect && status === 200) {
          headers.set('Cache-Control', pageCache);
        }

        if (isStatic && !redirect && status === 200 && (!contentType || contentType === 'text/html')) {
          await staticRes.set(url, body, env, match!.route);
        }

        return createResponse(new Response(redirect ? null : body, { status, headers }));
      } catch (error) {
        if (!isBrowser()) {
          console.error('Worker Error:', error);
        }

        return createResponse(new Response('Internal Server Error', { status: 500 }));
        /* istanbul ignore next - false report */
      } finally {
        request.signal.removeEventListener('abort', abort);
        clearTimeout(timerId);
      }
    },
  };
}

export function createFullWorker<E = AnyType>(
  router: HTTPRouter,
  renderer: SSRRenderer,
  options: AppWorkerOptions<E> = {}
) {
  const staticRes = createStatic(renderer.router, options);
  const defaultAssetResolver = createAssetResolver(options);

  return {
    router: renderer.router,
    options,
    async fetch(request: Request, env?: E, signal?: AbortSignal, ssg?: boolean) {
      const {
        template = '',
        headTag = '<!--ssr-head-->',
        bodyTag = '<!--ssr-outlet-->',
        timeout,
        resolveAsset = defaultAssetResolver,
        resolveContext,
        createResponse = createDefaultResponse,
      } = options;

      const controller = new AbortController();

      const abort = (reason: unknown) => controller.abort(reason);
      request.signal.addEventListener('abort', abort, { once: true });

      let timerId: AnyType;

      try {
        const cookie = request.headers.get('cookie') ?? '';
        const url = new URL(request.url);

        const contextSeed: SSRContextSeed = (await resolveContext?.(request, url, env)) ?? [];
        if (env) contextSeed.push([SSR_ENV_KEY, env as E]);

        if (
          !ssg &&
          request.method === 'POST' &&
          url.pathname.startsWith((router.transport as HTTPTransport).endpoint!)
        ) {
          const response = await router.resolve(request, contextSeed, undefined, signal);
          return createResponse(response);
        }

        if (!ssg && url.pathname !== '/' && typeof resolveAsset === 'function') {
          const asset = await resolveAsset(request, url, env);
          if (asset) return asset;
        }

        const match = renderer.router?.find(url, true);
        const { deferred, noscript, static: isStatic } = match?.route.options ?? {};

        const cached = !ssg && isStatic ? await staticRes.get(url, env, match!.route) : undefined;
        if (cached) {
          return createResponse(new Response(cached.html, { status: 200, headers: cached.headers }));
        }

        timerId = timeout ? setTimeout(() => abort('timeout'), timeout) : null;

        let cookies: string[] = [];
        const cookieJar = decodeCookies(cookie);

        const response = await router.isolate(
          async () => {
            const { html, head, status, redirect, contentType } = await renderer({
              url: url.href,
              cookie,
              controller,
              isolated: true,
              hydrated: !template.includes('<html dehydrated'),
            });

            let body = contentType
              ? html
              : template.replace('<html dehydrated', '<html').replace(headTag, head).replace(bodyTag, html);
            const headers = new Headers({
              'Content-Type': contentType ?? 'text/html',
            });

            if (deferred !== false || noscript) {
              body = deferScript(
                body,
                typeof deferred === 'number' ? deferred : undefined,
                !options.devMode && noscript
              );
            }

            cookies = cookieJar.encode();
            cookies.forEach((cookie) => {
              headers.append('Set-Cookie', cookie);
            });

            if (redirect) {
              headers.append('Location', redirect);
            }

            const pageCache = resolveCacheControl(options.cache?.pages, url);
            if (pageCache && !redirect && status === 200) {
              headers.set('Cache-Control', pageCache);
            }

            if (isStatic && !redirect && status === 200 && (!contentType || contentType === 'text/html')) {
              await staticRes.set(url, body, env, match!.route);
            }

            return new Response(redirect ? null : body, { status, headers });
          },
          controller,
          contextSeed,
          () => {
            setScope(COOKIE_JAR_WRITABLE, true);
            setCookieContext(cookieJar);
          }
        );

        return createResponse(response);
      } catch (error) {
        if (!isBrowser()) {
          console.error('Worker Error:', error);
        }

        return createResponse(new Response('Internal Server Error', { status: 500 }));
        /* istanbul ignore next - false report */
      } finally {
        request.signal.removeEventListener('abort', abort);
        clearTimeout(timerId);
      }
    },
    async upgrade(request: Request, env?: E) {
      if (!options.wsRouter) {
        throw new Error(
          "[AirLib] WebSocket upgrade failed: 'wsRouter' is not defined. Please pass an instance of WebSocketRouter in the worker options to enable real-time features."
        );
      }

      const cookie = request.headers.get('cookie') ?? '';
      const cookieJar = decodeCookies(cookie);

      const url = new URL(request.url);
      const contextSeed: SSRContextSeed = (await options.resolveContext?.(request, url, env)) ?? [];
      if (env) contextSeed.push([SSR_ENV_KEY, env as E]);
      contextSeed.push(['cookie', cookie]);

      // Return the generic message resolver function
      const resolve = (message: string | ArrayBuffer, sender: WsSender) => {
        return options.wsRouter!.resolve(message, sender, contextSeed, [[COOKIE_JAR_KEY, cookieJar]]);
      };
      const close = (sender: WsSender) => {
        return options.wsRouter!.disconnect!(sender);
      };
      Object.assign(resolve, { close });
      return resolve;
    },
  };
}

function createDefaultResponse(response: Response) {
  return response;
}

export function deferScript(html: string, delay: number = 50, strip = false) {
  const scripts: {
    type: string;
    src?: string;
    href?: string;
    rel?: string;
    scriptType?: string;
    crossOrigin?: string;
  }[] = [];

  let newHtml = html.replace(/<script[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/script>\n?/gi, (_match, src) => {
    const typeMatch = _match.match(/type="([^"]+)"/i);
    const crossMatch = _match.match(/crossorigin(?:="([^"]+)")?/i);
    scripts.push({
      type: 'script',
      src,
      scriptType: typeMatch ? typeMatch[1] : 'text/javascript',
      ...(crossMatch ? { crossOrigin: crossMatch[1] || 'anonymous' } : {}),
    });
    return '';
  });

  newHtml = newHtml.replace(/<link[^>]*href="([^"]+\.js)"[^>]*>\n?/gi, (_match, href) => {
    const relMatch = _match.match(/rel="([^"]+)"/i);
    const crossMatch = _match.match(/crossorigin(?:="([^"]+)")?/i);
    scripts.push({
      type: 'link',
      href,
      rel: relMatch ? relMatch[1] : 'modulepreload',
      ...(crossMatch ? { crossOrigin: crossMatch[1] || 'anonymous' } : {}),
    });
    return '';
  });

  if (!strip && scripts.length > 0) {
    const deferSnippet = `<script type="module">
      window.addEventListener('load', () => {
        setTimeout(() => {
          const scripts = ${JSON.stringify(scripts)};
          scripts.forEach(item => {
            const el = document.createElement(item.type);
            if (item.type === 'script') {
              el.type = item.scriptType;
              el.src = item.src;
            } else {
              el.rel = item.rel;
              el.href = item.href;
            }
            if (item.crossOrigin) el.crossOrigin = item.crossOrigin;
            document.body.appendChild(el);
          });
        }, ${delay});
      });
    </script>`;

    const bodyEnd = newHtml.lastIndexOf('</body>');
    if (bodyEnd > -1) {
      newHtml = newHtml.slice(0, bodyEnd) + deferSnippet + newHtml.slice(bodyEnd);
    } else {
      newHtml += deferSnippet;
    }
  }

  return newHtml;
}
