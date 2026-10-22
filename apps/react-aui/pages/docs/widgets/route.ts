import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/widgets');
const buttonRoute = route.route('/button');
const toggleRoute = route.route('/toggle');
const switchRoute = route.route('/switch');
const selectRoute = route.route('/select');
const linkRoute = route.route('/link');
const dividerRoute = route.route('/divider');
const imageRoute = route.route('/image');
const toggleGroupRoute = route.route('/toggle-group');
const checkboxRoute = route.route('/checkbox');
const checkboxGroupRoute = route.route('/checkbox-group');
/** AirLib managed */

export const widgetsRoute = route;
export const widgetsButtonRoute = buttonRoute;
export const widgetsToggleRoute = toggleRoute;
export const widgetsSwitchRoute = switchRoute;
export const widgetsSelectRoute = selectRoute;
export const widgetsLinkRoute = linkRoute;
export const widgetsDividerRoute = dividerRoute;
export const widgetsImageRoute = imageRoute;
export const widgetsToggleGroupRoute = toggleGroupRoute;
export const widgetsCheckboxRoute = checkboxRoute;
export const widgetsCheckboxGroupRoute = checkboxGroupRoute;

export default widgetsRoute;
