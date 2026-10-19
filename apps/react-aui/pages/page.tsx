import { Head, page } from '@airlib/react';
import { rootIndexRoute } from './route.js';

export default page(rootIndexRoute).render(() => {
  return (
    <>
      <Head meta={{ title: 'AirLib', description: 'AirLib starter template.' }} />
    </>
  );
});
