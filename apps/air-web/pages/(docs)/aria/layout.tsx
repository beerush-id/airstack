import { page } from '@airlib/react';
import ariaRoute from './route.js';

export default page(ariaRoute).render(({ children }) => children);
