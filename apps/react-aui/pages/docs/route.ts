import router from '../../src/router.js';

/** AirLib managed */
const route = router.add('/docs');
const indexRoute = route.route('/');
const gettingStartedRoute = route.route('/getting-started');
const themingRoute = route.route('/theming');
const dynamicRoute = route.route('/dynamic');
const markdownRoute = route.route('/markdown');
/** AirLib managed */

export const docsRoute = route;
export const docsIndexRoute = indexRoute;
export const docsGettingStartedRoute = gettingStartedRoute;
export const docsThemingRoute = themingRoute;
export const docsDynamicRoute = dynamicRoute;
export const docsMarkdownRoute = markdownRoute;

export default docsRoute;
