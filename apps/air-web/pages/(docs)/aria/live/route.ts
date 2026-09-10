import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/live');
const indexRoute = route.route('/');
const alertRoute = route.route('/alert');
const statusRoute = route.route('/status');
const logRoute = route.route('/log');
const timerRoute = route.route('/timer');
const marqueeRoute = route.route('/marquee');
/** AirLib managed */

export const liveRoute = route;
export const liveIndexRoute = indexRoute;
export const liveAlertRoute = alertRoute;
export const liveStatusRoute = statusRoute;
export const liveLogRoute = logRoute;
export const liveTimerRoute = timerRoute;
export const liveMarqueeRoute = marqueeRoute;

export default liveRoute;
