import { clampRange } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, mutable, onMount, setup, stylex } from '@airlib/react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';
import { ArrowLeft, ArrowRight, ZoomInIcon, ZoomOutIcon } from '../icons/index.js';
import { Button } from '../widgets/Button.js';
import { FullscreenButton } from '../widgets/FullscreenButton.js';
import { fullscreenHostCtx } from '../widgets/index.js';

/** One image of the set. */
export type ImageViewerEntry = {
  src: string;
  /** What the image shows, for screen readers. */
  alt: string;
  /** Words shown under it: where, when, who. */
  caption?: string;
};

/** Names of the viewer's buttons, for screen readers. */
export type ImageViewerLabels = {
  previous?: string;
  next?: string;
  zoomIn?: string;
  zoomOut?: string;
  fullscreen?: string;
};

export type ImageViewerProps = ComponentStyles & {
  id?: string;
  /** Names the viewer for screen readers, e.g. "Photos from the park". */
  label?: string;
  items: ImageViewerEntry[];
  /** Which image is on show, from zero. */
  index?: Bindable<number>;
  /** How far it's magnified; 1 fits it. */
  zoom?: Bindable<number>;
  maxZoom?: number;
  /** How much each zoom step magnifies. Defaults to 0.5. */
  zoomStep?: number;
  /** Whether stepping past the last image goes back to the first. */
  loop?: boolean;
  labels?: ImageViewerLabels;
  /** What else the toolbar holds, after the built-in controls: an edit button, a share button. */
  actions?: ReactNode;
  onchange?: (event: CustomEvent<number>) => void;
};

/** Fit: the image as large as its box allows, whole. */
const FIT = 1;

const CLASS = {
  STAGE: branded('image-viewer-stage'),
  IMAGE: branded('image-viewer-image'),
  TOOLBAR: branded('image-viewer-toolbar'),
  COUNT: branded('image-viewer-count'),
  ZOOM: branded('image-viewer-zoom'),
  SEP: branded('image-viewer-sep'),
  CAPTION: branded('image-viewer-caption'),
};

const LABELS: Required<ImageViewerLabels> = {
  previous: 'Previous image',
  next: 'Next image',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fullscreen: 'Full screen',
};

register('imageViewer', {});

/**
 * One image of a set at a time, fit to its box, with a floating toolbar to step through the set,
 * zoom, and fill the screen. The arrows, `+`, `-`, `0` and the wheel work on the viewer itself;
 * a magnified image is dragged around. `index` and `zoom` are bindable, so an app — or an agent
 * — can show and magnify an image by setting them.
 */
export const ImageViewer = setup<ImageViewerProps>((props) => {
  const className = () => $families(AUI_CLASS.IMAGE_VIEWER, { className: props.className }, auiConfig.imageViewer);
  const labels = () => ({ ...LABELS, ...props.labels });
  const pan = mutable({ x: 0, y: 0 });
  let root: HTMLDivElement | null = null;
  let dragging = false;

  // The viewer is what its fullscreen button fills the screen with.
  fullscreenHostCtx.set(() => root);

  const count = () => props.items.length;
  const maxZoom = () => props.maxZoom ?? 4;
  const index = () => clampRange(props.index ?? 0, 0, Math.max(count() - 1, 0));
  const zoom = () => clampRange(props.zoom ?? FIT, FIT, maxZoom());

  // A magnified image moves only as far as keeps it covering the viewer.
  const clampPan = () => {
    const box = root?.getBoundingClientRect();
    if (!box) return;
    const limitX = (box.width * (zoom() - 1)) / 2;
    const limitY = (box.height * (zoom() - 1)) / 2;
    pan.x = clampRange(pan.x, -limitX, limitX);
    pan.y = clampRange(pan.y, -limitY, limitY);
  };

  const zoomTo = (value: number) => {
    props.zoom = clampRange(value, FIT, maxZoom()) as AnyType;
    if (zoom() === FIT) Object.assign(pan, { x: 0, y: 0 });
    else clampPan();
  };
  const zoomIn = () => zoomTo(zoom() + (props.zoomStep ?? 0.5));
  const zoomOut = () => zoomTo(zoom() - (props.zoomStep ?? 0.5));

  // Showing another image fits it, and tells the app which one is on show.
  const show = (target: number) => {
    const total = count();
    if (total === 0) return;
    const next = props.loop ? ((target % total) + total) % total : clampRange(target, 0, total - 1);
    if (next === index()) return;
    props.index = next as AnyType;
    zoomTo(FIT);
    props.onchange?.(new CustomEvent('change', { detail: next }));
  };

  // The viewer's keys, while it has focus itself: its buttons keep their own.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    const actions: Record<string, () => void> = {
      ArrowRight: () => show(index() + 1),
      ArrowLeft: () => show(index() - 1),
      Home: () => show(0),
      End: () => show(count() - 1),
      '+': zoomIn,
      '=': zoomIn,
      '-': zoomOut,
      '0': () => zoomTo(FIT),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  // A magnified image follows the pointer while it's held down.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || zoom() === FIT || event.defaultPrevented) return;
    dragging = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    pan.x += event.movementX;
    pan.y += event.movementY;
    clampPan();
  };
  const handlePointerUp = () => {
    dragging = false;
  };

  // The wheel zooms instead of scrolling the page, so it has to be able to cancel the scroll.
  onMount(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      if (event.deltaY < 0) zoomIn();
      else zoomOut();
    };
    root?.addEventListener('wheel', handleWheel, { passive: false });
    return () => root?.removeEventListener('wheel', handleWheel);
  });

  return () => {
    const entry = props.items[index()];
    const total = count();

    return (
      <div
        ref={(element) => {
          root = element;
        }}
        id={props.id}
        role="group"
        tabIndex={0}
        aria-roledescription="image viewer"
        aria-label={props.label}
        data-zoomed={zoom() > FIT ? 'true' : undefined}
        style={stylex({
          '--aria-viewer-zoom': String(zoom()),
          '--aria-viewer-x': `${pan.x}px`,
          '--aria-viewer-y': `${pan.y}px`,
        })}
        className={className()}
        onKeyDown={handleKeyDown}
      >
        {/* Only the image pans: a press on the toolbar stays a press on its buttons. */}
        <div
          className={CLASS.STAGE}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {entry && <img className={CLASS.IMAGE} src={entry.src} alt={entry.alt} draggable={false} />}
        </div>
        <div className={`${CLASS.TOOLBAR} ${AUI_CLASS.GLASS_FRAME}`}>
          <Button
            variant="text"
            size="sm"
            aria-label={labels().previous}
            disabled={!props.loop && index() === 0}
            onClick={() => show(index() - 1)}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <span className={CLASS.COUNT}>
            {total ? index() + 1 : 0} / {total}
          </span>
          <Button
            variant="text"
            size="sm"
            aria-label={labels().next}
            disabled={!props.loop && index() >= total - 1}
            onClick={() => show(index() + 1)}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
          <span className={CLASS.SEP} aria-hidden="true" />
          <Button variant="text" size="sm" aria-label={labels().zoomOut} disabled={zoom() <= FIT} onClick={zoomOut}>
            <ZoomOutIcon aria-hidden="true" />
          </Button>
          <span className={CLASS.ZOOM} aria-hidden="true">
            {Math.round(zoom() * 100)}%
          </span>
          <Button
            variant="text"
            size="sm"
            aria-label={labels().zoomIn}
            disabled={zoom() >= maxZoom()}
            onClick={zoomIn}
          >
            <ZoomInIcon aria-hidden="true" />
          </Button>
          {props.actions}
          <FullscreenButton label={labels().fullscreen} />
        </div>
        {entry?.caption && <p className={CLASS.CAPTION}>{entry.caption}</p>}
      </div>
    );
  };
}, 'ImageViewer');
