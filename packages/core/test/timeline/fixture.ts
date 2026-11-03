/**
 * The frame an editor shows for a frame number: editors number frames from 0 at 0s, the same as
 * the timeline's 0-indexed frames, so frame 30 starts at 1.0s at 30fps.
 *
 * @param visual - The frame number as an editor shows it.
 * @returns The timeline frame.
 */
export const uiFrame = (visual: number) => visual;
