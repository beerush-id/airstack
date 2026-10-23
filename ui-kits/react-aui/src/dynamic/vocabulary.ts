import { type AnyType, createContext } from '@airlib/react';
import type { ComponentType } from 'react';

/** The components data may name, by role. */
export type WidgetVocabulary = Record<string, ComponentType<AnyType>>;

/**
 * The vocabulary renderers inside draw from, in place of every AUI component:
 * a narrower one for answers, or a wider one — markdown adds `math`. Set it in
 * the setup of a component around the renderers.
 */
export const widgetVocabularyCtx = createContext<WidgetVocabulary>();
