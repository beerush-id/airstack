import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/widgets');
const buttonRoute = route.route('/button');
const toggleRoute = route.route('/toggle');
const selectRoute = route.route('/select');
/** AirLib managed */

export const widgetsRoute = route;
export const widgetsButtonRoute = buttonRoute;
export const widgetsToggleRoute = toggleRoute;
export const widgetsSelectRoute = selectRoute;

export default widgetsRoute;
