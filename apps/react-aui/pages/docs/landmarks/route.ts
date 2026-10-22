import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/landmarks');
const headerRoute = route.route('/header');
const mainRoute = route.route('/main');
const footerRoute = route.route('/footer');
const sectionRoute = route.route('/section');
const sidebarRoute = route.route('/sidebar');
/** AirLib managed */

export const landmarksRoute = route;
export const landmarksHeaderRoute = headerRoute;
export const landmarksMainRoute = mainRoute;
export const landmarksFooterRoute = footerRoute;
export const landmarksSectionRoute = sectionRoute;
export const landmarksSidebarRoute = sidebarRoute;

export default landmarksRoute;
