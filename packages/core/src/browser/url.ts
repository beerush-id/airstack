import { $symbol, isBrowser } from '../module.js';
import { mutable } from '../reactive/index.js';
import { createContext } from '../scope/context.js';
import { onCleanup } from '../scope/lifecycle.js';

export class LiveURL implements URL {
  public host = '';
  public port = '';
  public hash = '';
  public href = '';
  public origin = '';
  public search = '';
  public pathname = '';
  public hostname = '';
  public username = '';
  public password = '';
  public protocol = '';
  public searchParams: URLSearchParams = new URLSearchParams();

  constructor(init?: string | URL) {
    const browserMode = isBrowser();

    if (typeof init === 'string') {
      this.sync(new URL(init, browserMode ? location.href : 'http://localhost'));
    } else if (init instanceof URL) {
      this.sync(init);
    } else if (browserMode) {
      this.sync(new URL(location.href));
    }

    if (browserMode) {
      const update = () => {
        this.sync(new URL(location.href));
      };

      window.addEventListener('popstate', update);
      window.addEventListener('hashchange', update);

      onCleanup(() => {
        window.removeEventListener('popstate', update);
        window.removeEventListener('hashchange', update);
      });
    }
  }

  private sync(url: URL) {
    this.host = url.host;
    this.port = url.port;
    this.hash = url.hash;
    this.href = url.href;
    this.origin = url.origin;
    this.search = url.search;
    this.pathname = url.pathname;
    this.hostname = url.hostname;
    this.username = url.username;
    this.password = url.password;
    this.protocol = url.protocol;
    this.searchParams = new URLSearchParams(url.search);
  }

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.href;
  }
}

export function liveUrl(url?: string | URL) {
  return mutable(new LiveURL(url), { recursive: false });
}

export const urlCtx = createContext<LiveURL>($symbol('live-url'));
