import type { AsyncKey, AsyncStore, AsyncValue } from '@airlib/core';
import type { Router, SitemapConfig } from '@airlib/router';
import type { HTTPRouter } from '@irpclib/http/router';
import type { StaticAdapter } from './static.js';

export type RouterOptions = {
  router: Router;
  sitemap?: boolean | Omit<SitemapConfig, 'url'>;
};

export type SSROutput = {
  html: string;
  head: string;
  status: number;
  cookies: string[];
  redirect?: string;
  contentType?: string;
};

export type SSRContextSeed = Array<[AsyncKey, AsyncValue]>;
export type SSRContext = SSRContextSeed | AsyncStore;

export type SSRRenderOptions = {
  url: string;
  cookie?: string;
  context?: SSRContext;
  controller?: AbortController;
  isolated?: boolean;
  hydrated?: boolean;
  options?: SSROptions & Omit<RouterOptions, 'router'>;
};

export type SSRRenderStringOptions = {
  router: Router;
  renderView: SSRRenderView;
  url: string;
  controller?: AbortController;
  hydrated?: boolean;
  options?: SSROptions & Omit<RouterOptions, 'router'>;
};

export type SSRRenderView = (options: {
  url: string;
}) => { html: string; head: string } | Promise<{ html: string; head: string }>;

export type SSRRenderer = ((options: SSRRenderOptions) => Promise<SSROutput>) & {
  router: Router;
  options: SSRRenderOptions;
};

export type AssetResolver<E> = (request: Request, url: URL, env?: E) => Promise<Response | undefined>;

export type CacheControlInit = {
  public?: boolean;
  private?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  immutable?: boolean;
};

export type CacheControlResolver = (url: URL) => CacheControlInit | string | undefined | null;
export type CacheControl = string | CacheControlInit | CacheControlResolver | false;

export type WsSender = { send: (message: string) => void };

export interface WsRouter {
  resolve(
    message: string | ArrayBuffer,
    ws: WsSender,
    initContext?: SSRContextSeed,
    initScope?: SSRContextSeed
  ): Promise<void>;
  disconnect?(ws?: WsSender): void;
}

export type IRPCOptions = {
  httpRouter?: HTTPRouter;
  wsRouter?: WsRouter;
};

export type SSROptions = {
  template?: string;
  headTag?: string;
  bodyTag?: string;
  scripts?: string[];
  timeout?: number;
  cache?: {
    assets?: CacheControl;
    pages?: CacheControl;
  };
};

export type WorkerOptions<E> = {
  devMode?: boolean;
  cacheDir?: string;
  cacheAdapter?: StaticAdapter<E>;
  resolveAsset?: AssetResolver<E>;
  resolveContext?: (request: Request, url: URL, env?: E) => SSRContextSeed | Promise<SSRContextSeed>;
  createResponse?: (response: Response) => Response;
};

export type AppWorkerOptions<E> = WorkerOptions<E> & SSROptions & IRPCOptions;

export type CoreAppOptions<E> = RouterOptions & AppWorkerOptions<E>;
