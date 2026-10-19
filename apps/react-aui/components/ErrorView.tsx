import { Link, NotFoundError, type RouteError } from '@airlib/react';
import rootRoute from '@/pages/route.js';

export function ErrorView({ error }: { error?: RouteError }) {
  return (
    <section id="center">
      <h1>{error instanceof NotFoundError ? '404' : '500'}</h1>
      <p>{error?.message}</p>
      <div className="ticks error-section">
        <Link to={rootRoute}>Back to Home</Link>
      </div>
    </section>
  );
}
