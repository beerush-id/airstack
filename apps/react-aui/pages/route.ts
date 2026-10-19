import router from '@/src/router.js';

/** AirLib managed */
const route = router.route();
const indexRoute = route.route('/');
/** AirLib managed */

export const rootRoute = route;
export const rootIndexRoute = indexRoute.meta({ label: 'Home' });

export default rootRoute;
