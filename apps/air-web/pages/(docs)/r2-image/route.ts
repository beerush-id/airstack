import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/r2-image');
const indexRoute = route.route('/');
const deliveryRoute = route.route('/delivery');
const deploymentRoute = route.route('/deployment');
const gettingStartedRoute = route.route('/getting-started');
const storageRoute = route.route('/storage');
/** AirLib managed */

export const r2ImageRoute = route;
export const r2ImageIndexRoute = indexRoute;
export const r2ImageDeliveryRoute = deliveryRoute;
export const r2ImageDeploymentRoute = deploymentRoute;
export const r2ImageGettingStartedRoute = gettingStartedRoute;
export const r2ImageStorageRoute = storageRoute;

export default r2ImageRoute;
