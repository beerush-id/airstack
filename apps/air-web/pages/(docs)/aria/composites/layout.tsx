import { page } from '@airlib/react';
import compositesRoute from './route.js';

export default page(compositesRoute).render(({ children }) => children);
