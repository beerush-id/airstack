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
const radioRoute = route.route('/radio');
const radioGroupRoute = route.route('/radio-group');
const sliderRoute = route.route('/slider');
const navigationRoute = route.route('/navigation');
const breadcrumbRoute = route.route('/breadcrumb');
const toolbarRoute = route.route('/toolbar');
const paginationRoute = route.route('/pagination');
const fieldRoute = route.route('/field');
const textInputRoute = route.route('/text-input');
const numberStepperRoute = route.route('/number-stepper');
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
export const widgetsRadioGroupRoute = radioGroupRoute;
export const widgetsRadioRoute = radioRoute;
export const widgetsSliderRoute = sliderRoute;
export const widgetsNavigationRoute = navigationRoute;
export const widgetsBreadcrumbRoute = breadcrumbRoute;
export const widgetsToolbarRoute = toolbarRoute;
export const widgetsPaginationRoute = paginationRoute;
export const widgetsFieldRoute = fieldRoute;
export const widgetsTextInputRoute = textInputRoute;
export const widgetsNumberStepperRoute = numberStepperRoute;

export default widgetsRoute;
