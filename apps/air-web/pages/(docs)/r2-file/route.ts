import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/r2-file');
const gettingStartedRoute = route.route('/getting-started');
const indexRoute = route.route('/');
const filesystemRoute = route.route('/filesystem');
const securityRoute = route.route('/security');
const deploymentRoute = route.route('/deployment');
/** AirLib managed */

export const r2FileRoute = route;
export const r2FileIndexRoute = indexRoute;
export const r2FileGettingStartedRoute = gettingStartedRoute;
export const r2FileFilesystemRoute = filesystemRoute;
export const r2FileSecurityRoute = securityRoute;
export const r2FileDeploymentRoute = deploymentRoute;

export default r2FileRoute;
