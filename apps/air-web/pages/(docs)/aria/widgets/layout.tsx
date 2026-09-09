import { page } from '@airlib/react';
import widgetsRoute from './route.js';

export default page(widgetsRoute).render(({ children }) => children);
