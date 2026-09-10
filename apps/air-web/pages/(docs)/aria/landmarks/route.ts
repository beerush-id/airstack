import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/landmarks');
const indexRoute = route.route('/');
const bannerRoute = route.route('/banner');
const mainRoute = route.route('/main');
const navigationRoute = route.route('/navigation');
const complementaryRoute = route.route('/complementary');
const contentinfoRoute = route.route('/contentinfo');
const searchRoute = route.route('/search');
const formRoute = route.route('/form');
const regionRoute = route.route('/region');
/** AirLib managed */

export const landmarksRoute = route;
export const landmarksIndexRoute = indexRoute;
export const landmarksBannerRoute = bannerRoute;
export const landmarksMainRoute = mainRoute;
export const landmarksNavigationRoute = navigationRoute;
export const landmarksComplementaryRoute = complementaryRoute;
export const landmarksContentinfoRoute = contentinfoRoute;
export const landmarksSearchRoute = searchRoute;
export const landmarksFormRoute = formRoute;
export const landmarksRegionRoute = regionRoute;

export default landmarksRoute;
