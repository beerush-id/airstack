import type { AnchorSettings } from '../types.js';
import { ArrayMutations, BatchMutations, Linkables, MapMutations, ObjectMutations, SetMutations } from './enum.js';

export const SET_MUTATIONS = [SetMutations.ADD, SetMutations.DELETE, SetMutations.CLEAR] as const;
export const MAP_MUTATIONS = [MapMutations.SET, MapMutations.DELETE, MapMutations.CLEAR] as const;
export const BATCH_MUTATIONS = [
  BatchMutations.ASSIGN,
  BatchMutations.REMOVE,
  BatchMutations.CLEAR,
  BatchMutations.REPLACE,
] as const;
export const OBJECT_MUTATIONS = [ObjectMutations.SET, ObjectMutations.DELETE] as const;

export const ARRAY_MUTATIONS = [
  ArrayMutations.PUSH,
  ArrayMutations.COPY_WITHIN,
  ArrayMutations.FILL,
  ArrayMutations.POP,
  ArrayMutations.SHIFT,
  ArrayMutations.UNSHIFT,
  ArrayMutations.SPLICE,
  ArrayMutations.SORT,
  ArrayMutations.REVERSE,
] as const;

export const LINKABLE = new Set([Linkables.OBJECT, Linkables.ARRAY, Linkables.SET, Linkables.MAP]);
export const ANCHOR_SETTINGS = {
  strict: false,
  deferred: true,
  recursive: true,
  immutable: false,
  observable: true,
  production: true,
  secureWrite: true,
  safeObservation: true,
  safeObservationThreshold: 100,
  globalScopeWarning: true,
  safeParse: false,
  reactive: typeof document !== 'undefined',
  trapOwnKeys: true,
} as AnchorSettings;

export const POISONED_KEYS = new Set([
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

export const BATCH_MUTATION_KEYS = new Set(BATCH_MUTATIONS);
export const ARRAY_MUTATION_KEYS = new Set(ARRAY_MUTATIONS);
export const COLLECTION_MUTATION_KEYS = new Set([...MAP_MUTATIONS, ...SET_MUTATIONS]);
export const COLLECTION_MUTATION_PROPS = new Set(['set', 'add', 'delete', 'clear']);

// Define the max number of items additions to switch between using sort vs splice
// when adding an item into an ordered list.
export const HEURISTIC_THRESHOLD = 5;

// Dev tool keys
export const DEV_TOOL_KEYS = new Set([
  'onGet',
  'onSet',
  'onDelete',
  'onCall',
  'onInit',
  'onAssign',
  'onRemove',
  'onClear',
  'onDestroy',
  'onSubscribe',
  'onUnsubscribe',
  'onLink',
  'onUnlink',
  'onTrack',
  'onUntrack',
]);

export const ASYNC_STATUS = {
  Idle: 'idle',
  Error: 'error',
  Aborted: 'aborted',
  Success: 'success',
  Pending: 'pending',
} as const;
