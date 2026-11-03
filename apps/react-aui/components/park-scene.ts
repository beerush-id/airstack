import type { ImageSegment } from '@airlib/react-aui';

/** The scene's size in pixels; its segments are placed in these. */
export const SCENE_WIDTH = 1200;
export const SCENE_HEIGHT = 900;

/**
 * An illustrated park — a parent and kid chasing bubbles, a tree, the sun, and someone in the
 * background — standing in for a photo whose segments a model like SAM found. The masks below use
 * the drawing's own geometry, so they line up exactly.
 *
 * @param withStranger - Whether the person in the background is in it; without, it's the edit.
 * @returns The scene as a data URL, for an `<img>` or an SVG `<image>`.
 */
export function parkScene(withStranger = true): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fcaf5"/><stop offset="1" stop-color="#fde7c8"/></linearGradient></defs>
<rect width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}" fill="url(#sky)"/>
<circle cx="1000" cy="150" r="70" fill="#ffd37a"/>
<path d="M0 610Q300 520 620 590T1200 570V900H0Z" fill="#86c98a"/>
<path d="M0 700Q600 650 1200 700V900H0Z" fill="#6fb373"/>
<rect x="150" y="360" width="40" height="260" fill="#7a5232"/>
<circle cx="170" cy="330" r="120" fill="#3f8f4a"/>
${withStranger ? '<circle cx="930" cy="520" r="14" fill="#6b4a3a"/><rect x="919" y="536" width="22" height="58" rx="10" fill="#4a5d8a"/>' : ''}
<rect x="494" y="610" width="22" height="80" fill="#2f3b5c"/><rect x="524" y="610" width="22" height="80" fill="#2f3b5c"/>
<rect x="488" y="468" width="64" height="150" rx="26" fill="#c0504d"/>
<circle cx="520" cy="430" r="34" fill="#e0ac85"/>
<rect x="634" y="630" width="14" height="50" fill="#2f3b5c"/><rect x="652" y="630" width="14" height="50" fill="#2f3b5c"/>
<rect x="628" y="546" width="44" height="90" rx="18" fill="#f2b134"/>
<circle cx="650" cy="520" r="24" fill="#f0c09a"/>
<g fill="rgba(255,255,255,0.35)" stroke="#fff" stroke-width="3"><circle cx="720" cy="430" r="26"/><circle cx="760" cy="380" r="18"/><circle cx="700" cy="360" r="14"/><circle cx="790" cy="440" r="22"/></g>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The scene's segments, as a model would return them for it. */
export const SCENE_SEGMENTS: ImageSegment[] = [
  {
    id: 'parent',
    label: 'You',
    path: 'M520 396a34 34 0 1 1 0 68a34 34 0 1 1 0-68ZM488 494a26 26 0 0 1 26-26h12a26 26 0 0 1 26 26v116h-64ZM494 610h52v80h-52Z',
    anchor: [486, 392],
  },
  {
    id: 'kid',
    label: 'Kid',
    path: 'M650 496a24 24 0 1 1 0 48a24 24 0 1 1 0-48ZM628 564a18 18 0 0 1 18-18h8a18 18 0 0 1 18 18v66h-44ZM634 630h32v50h-32Z',
    anchor: [626, 492],
  },
  {
    id: 'bubbles',
    label: 'Bubbles',
    path: 'M694 430a26 26 0 1 0 52 0a26 26 0 1 0-52 0ZM742 380a18 18 0 1 0 36 0a18 18 0 1 0-36 0ZM686 360a14 14 0 1 0 28 0a14 14 0 1 0-28 0ZM768 440a22 22 0 1 0 44 0a22 22 0 1 0-44 0Z',
    anchor: [684, 342],
  },
  {
    id: 'stranger',
    label: 'Person in the background',
    path: 'M930 506a14 14 0 1 1 0 28a14 14 0 1 1 0-28ZM919 546a10 10 0 0 1 10-10h2a10 10 0 0 1 10 10v48h-22Z',
    anchor: [944, 500],
  },
  {
    id: 'tree',
    label: 'Tree',
    path: 'M170 210a120 120 0 1 1 0 240a120 120 0 1 1 0-240ZM150 440h40v180h-40Z',
    anchor: [52, 206],
  },
  {
    id: 'sun',
    label: 'Sun',
    path: 'M930 150a70 70 0 1 0 140 0a70 70 0 1 0-140 0Z',
    anchor: [1070, 76],
  },
];
