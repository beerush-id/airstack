import { page } from '@airlib/react';
import landmarksRoute from './route.js';

export default page(landmarksRoute).render(({ children }) => children);
