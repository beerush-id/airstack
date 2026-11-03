import parentRoute from '../route.js';

/** AirLib managed */
const route = parentRoute.route('/timeline');
const indexRoute = route.route('/');
const tracksSegmentsRoute = route.route('/tracks-segments');
const scenesRoute = route.route('/scenes');
const playbackRoute = route.route('/playback');
const persistenceRoute = route.route('/persistence');
/** AirLib managed */

export const timelineRoute = route;
export const timelineIndexRoute = indexRoute;
export const timelineTracksSegmentsRoute = tracksSegmentsRoute;
export const timelineScenesRoute = scenesRoute;
export const timelinePlaybackRoute = playbackRoute;
export const timelinePersistenceRoute = persistenceRoute;

export default timelineRoute;
