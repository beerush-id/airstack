import { createContext } from '@airlib/core';
import type { CarouselAria } from './carousel.js';

export const carouselCtx = createContext<CarouselAria>();

export const CAROUSEL_NAME = 'carousel';
export const CAROUSEL_SLIDE = 'slide';
export const CAROUSEL_PICKER = 'picker';
export const CAROUSEL_VIEWPORT = 'viewport';
export const CAROUSEL_BTN_SELECTOR = '[aria-roledescription="indicator"]:not(:disabled, [aria-disabled="true"])';
export const CAROUSEL_INTERVAL = 5000;
