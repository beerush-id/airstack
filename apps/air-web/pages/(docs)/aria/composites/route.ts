import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/composites');
const indexRoute = route.route('/');
const accordionRoute = route.route('/accordion');
const listboxRoute = route.route('/listbox');
const radiogroupRoute = route.route('/radiogroup');
const tabsRoute = route.route('/tabs');
const toolbarRoute = route.route('/toolbar');
const togglegroupRoute = route.route('/togglegroup');
const menuRoute = route.route('/menu');
/** AirLib managed */

export const compositesRoute = route;
export const compositesIndexRoute = indexRoute;
export const compositesAccordionRoute = accordionRoute;
export const compositesListboxRoute = listboxRoute;
export const compositesRadiogroupRoute = radiogroupRoute;
export const compositesTabsRoute = tabsRoute;
export const compositesToolbarRoute = toolbarRoute;
export const compositesTogglegroupRoute = togglegroupRoute;
export const compositesMenuRoute = menuRoute;

export default compositesRoute;
