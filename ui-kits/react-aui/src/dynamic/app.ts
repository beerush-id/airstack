import { type AnyType, createContext } from '@airlib/react';

/**
 * The app a desktop runs for: the state its widgets may read and edit by
 * binding to it. Set it once, in the setup of a component around everything
 * the desktop draws; widgets drawn from data resolve their bindings against it.
 */
export const auiAppCtx = createContext<AnyType>();
