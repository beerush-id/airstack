import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/aria');
const indexRoute = route.route('/');
const selectionRoute = route.route('/selection');
/** AirLib managed */

export const ariaRoute = route;
export const ariaIndexRoute = indexRoute;
export const ariaSelectionRoute = selectionRoute;

export default ariaRoute;
