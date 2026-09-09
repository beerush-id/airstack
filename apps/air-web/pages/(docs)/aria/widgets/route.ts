import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/widgets');
const indexRoute = route.route('/');
const buttonRoute = route.route('/button');
const checkboxRoute = route.route('/checkbox');
const optionRoute = route.route('/option');
const radioRoute = route.route('/radio');
const switchRoute = route.route('/switch');
const textboxRoute = route.route('/textbox');
/** AirLib managed */

export const widgetsRoute = route;
export const widgetsIndexRoute = indexRoute;
export const widgetsButtonRoute = buttonRoute;
export const widgetsCheckboxRoute = checkboxRoute;
export const widgetsOptionRoute = optionRoute;
export const widgetsRadioRoute = radioRoute;
export const widgetsSwitchRoute = switchRoute;
export const widgetsTextboxRoute = textboxRoute;

export default widgetsRoute;
