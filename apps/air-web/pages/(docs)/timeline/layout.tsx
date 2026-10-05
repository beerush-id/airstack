import { page } from '@airlib/react';
import timelineRoute from './route.js';

export default page(timelineRoute).render(({ children }) => children);
