import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/aria');
const indexRoute = route.route('/');
const selectionRoute = route.route('/selection');
const textboxRoute = route.route('/textbox');
const switchRoute = route.route('/switch');
const radioRoute = route.route('/radio');
const optionRoute = route.route('/option');
const checkboxRoute = route.route('/checkbox');
const buttonRoute = route.route('/button');
const linkRoute = route.route('/link');
const progressbarRoute = route.route('/progressbar');
const separatorRoute = route.route('/separator');
const spinbuttonRoute = route.route('/spinbutton');
/** AirLib managed */

export const ariaRoute = route;
export const ariaIndexRoute = indexRoute;
export const ariaSelectionRoute = selectionRoute;
export const ariaButtonRoute = buttonRoute;
export const ariaCheckboxRoute = checkboxRoute;
export const ariaOptionRoute = optionRoute;
export const ariaRadioRoute = radioRoute;
export const ariaSwitchRoute = switchRoute;
export const ariaTextboxRoute = textboxRoute;
export const ariaLinkRoute = linkRoute;
export const ariaProgressbarRoute = progressbarRoute;
export const ariaSeparatorRoute = separatorRoute;
export const ariaSpinbuttonRoute = spinbuttonRoute;

export default ariaRoute;
