'use client';

/* istanbul ignore file */
import { captureStack } from '@airlib/core';
import { type Context, type FunctionComponent, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * ⚠️⚠️⚠️ LOW-LEVEL APIS - AVOID DIRECT USAGE ⚠️⚠️⚠️
 *
 * THIS FILE CONTAINS LOW-LEVEL ANCHOR APIS THAT SHOULD NOT BE USED
 * IN STANDARD APPLICATION DEVELOPMENT.
 *
 * THESE APIS ARE PROVIDED FOR INTERNAL USE AND ADVANCED CUSTOM INTEGRATIONS ONLY.
 * ANCHOR IS DESIGNED TO WORK WITHOUT DIRECT HOOK MANIPULATION WHERE POSSIBLE.
 * USING THESE APIS MAY RESULT IN UNEXPECTED BEHAVIOR OR BREAKAGES.
 *
 * REFER TO OFFICIAL DOCUMENTATION FOR RECOMMENDED USAGE PATTERNS.
 */

const IDENTITY = Symbol.for('anchor-for-reacct');
if (IDENTITY in globalThis) {
  const error = new Error('Multiple instance detected.');
  captureStack.violation.general('Multiple instances detected.', 'Anchor for React registered more than once.', error);
}
globalThis[IDENTITY as never] = true as never;

/**
 * ⚠️ LOW-LEVEL API - NOT RECOMMENDED FOR STANDARD USAGE ⚠️
 *
 * Creates a side effect that runs after render, similar to React's useEffect.
 * This hook can be used in both server and client components, enabling component reusability.
 * On the server, this safely no-ops since effects don't run during SSR.
 * On the client, the effect runs after render and is cleaned up on unmount or before re-running.
 *
 * WARNING: Using this API directly may cause unexpected behavior, particularly with
 * Anchor's reactive system. For example, using state-mutating functions will trigger re-renders
 * of setup components, breaking the purpose of setup components which should be
 * pure and not reactive.
 *
 * Standard applications should avoid using this hook directly.
 *
 * @param cb - The effect callback function, optionally returning a cleanup function
 * @param deps - Optional array of dependencies that trigger the effect when changed
 * @returns void
 */
export const createEffect = ((cb, deps) => {
  return useEffect(cb, deps);
}) as typeof useEffect;

/**
 * ⚠️ LOW-LEVEL API - NOT RECOMMENDED FOR STANDARD USAGE ⚠️
 *
 * Creates a stateful value that persists across renders, similar to React's useState.
 * This hook can be used in both server and client components, enabling component reusability.
 * On the server, this returns the initial value without state management.
 * On the client, this provides full stateful behavior with re-rendering on updates.
 *
 * WARNING: Using this API directly may cause unexpected behavior, particularly with
 * Anchor's reactive system. For example, using state-mutating functions will trigger re-renders
 * of setup components, breaking the purpose of setup components which should be
 * pure and not reactive.
 *
 * Standard applications should avoid using this hook directly.
 *
 * @template T - The type of the state value
 * @param init - The initial state value or a function that returns the initial state
 * @returns A tuple of [state, setState]
 */
export const createState = <T>(init: T | (() => T)) => {
  return useState(init);
};

/**
 * ⚠️ LOW-LEVEL API - NOT RECOMMENDED FOR STANDARD USAGE ⚠️
 *
 * Creates a mutable ref object that persists across renders, similar to React's useRef.
 * This hook can be used in both server and client components, enabling component reusability.
 * On the server, this returns a simple object with the initial value.
 * On the client, this provides a persistent ref object that survives re-renders.
 *
 * WARNING: Using this API directly may cause unexpected behavior, particularly with
 * Anchor's reactive system. For example, using state-mutating functions will trigger re-renders
 * of setup components, breaking the purpose of setup components which should be
 * pure and not reactive.
 *
 * Standard applications should avoid using this hook directly.
 *
 * @template T - The type of the ref value
 * @param init - The initial value for the ref
 * @returns A ref object with a current property
 */
export const createRef = <T>(init: T) => {
  return useRef(init);
};

/**
 * ⚠️ LOW-LEVEL API - NOT RECOMMENDED FOR STANDARD USAGE ⚠️
 *
 * Reads the nearest value a React context provides above the component, like React's useContext,
 * however the component came to render: inside its parent's render, re-mounted alone, or swapped
 * by Fast Refresh.
 *
 * WARNING: A provider whose value changes re-renders every component that reads it, setup
 * components included, breaking the purpose of setup components which should be pure and not
 * reactive. Read only contexts whose value stays the same.
 *
 * Standard applications should avoid using this hook directly; use Anchor's own context instead.
 *
 * @template T - The type of the context value
 * @param context - The React context to read
 * @returns The value of the nearest provider, or the context's default without one
 */
export const readContext = <T>(context: Context<T>): T => {
  return useContext(context);
};

/**
 * ⚠️ LOW-LEVEL API - NOT RECOMMENDED FOR STANDARD USAGE ⚠️
 *
 * Creates a memoized value that only recomputes when dependencies change, similar to React's useMemo.
 * This hook can be used in both server and client components, enabling component reusability.
 * On the server, this simply executes the function and returns the value without memoization.
 * On the client, this caches the computed value and only recomputes when dependencies change.
 *
 * WARNING: Using this API directly may cause unexpected behavior, particularly with
 * Anchor's reactive system. For example, using state-mutating functions will trigger re-renders
 * of setup components, breaking the purpose of setup components which should be
 * pure and not reactive.
 *
 * Standard applications should avoid using this hook directly.
 *
 * @param fn - A function that computes and returns the memoized value
 * @param deps - Optional array of dependencies that trigger recomputation when changed
 * @returns The memoized value
 */
export const createMemo = ((fn, deps) => {
  return useMemo(fn, deps);
}) as typeof useMemo;

/**
 * ⚠️ LOW-LEVEL API - NOT RECOMMENDED FOR STANDARD USAGE ⚠️
 *
 * Memoizes a functional component to prevent unnecessary re-renders.
 * This HOC can be used in both server and client components, enabling component reusability.
 * On the server, this simply returns the component without memoization.
 * On the client, this uses React's memo functionality to optimize performance.
 *
 * WARNING: Using this API directly may cause unexpected behavior, particularly with
 * Anchor's reactive system. For example, using state-mutating functions will trigger re-renders
 * of setup components, breaking the purpose of setup components which should be
 * pure and not reactive.
 *
 * Standard applications should avoid using this HOC directly.
 *
 * @param Component - The functional component to memoize
 * @param propsAreEqual - Optional function to customize props comparison logic
 * @returns A memoized version of the component
 */
export const memoize = ((Component: FunctionComponent, propsAreEqual: () => boolean) => {
  return memo(Component, propsAreEqual);
}) as typeof memo;
