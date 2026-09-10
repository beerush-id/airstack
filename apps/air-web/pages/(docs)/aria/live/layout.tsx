import { page } from '@airlib/react';
import liveRoute from './route.js';

export default page(liveRoute).render(({ children }) => children);
