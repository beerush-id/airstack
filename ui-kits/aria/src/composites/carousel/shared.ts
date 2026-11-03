import { createContext } from '@airlib/core';
import { ENABLED_QUERY } from '../../utils/attributes.js';
import type { CarouselAria } from './carousel.js';

export const carouselCtx = createContext<CarouselAria>();

export const CAROUSEL_NAME = 'carousel';
export const CAROUSEL_SLIDE = 'slide';
export const CAROUSEL_PICKER = 'picker';
export const CAROUSEL_VIEWPORT = 'viewport';

export const CAROUSEL_INTERVAL = 5000;
export const CAROUSEL_INDICATOR = `[aria-roledescription="carousel-indicator"]${ENABLED_QUERY}`;
