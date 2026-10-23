import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowLeft, ArrowRight, ZoomInIcon, ZoomOutIcon } from '../icons/index.js';
import { Button } from '../widgets/Button.js';
import { FullscreenButton } from '../widgets/FullscreenButton.js';

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
  /** Whether stepping past the last image goes back to the first. */
  loop?: boolean;
  labels?: ImageViewerLabels;
  /** What else the toolbar holds, after the built-in controls: an edit button, a share button. */
  actions?: ReactNode;
  onchange?: (event: CustomEvent<number>) => void;
};

const VIEWER_ROLE = 'image-viewer';

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
  const viewer = aria(VIEWER_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.IMAGE_VIEWER, { className: props.className }, auiConfig.imageViewer);
  const labels = () => ({ ...LABELS, ...props.labels });

  return () => {
    const entry = props.items[viewer.index];
    const count = props.items.length;

    return (
      <div ref={viewer.ref} {...viewer.restProps([...OMIT_KEYS, 'labels', 'actions'] as never)} className={className()}>
        <div className={CLASS.STAGE}>
          {entry && <img className={CLASS.IMAGE} src={entry.src} alt={entry.alt} draggable={false} />}
        </div>
        <div className={`${CLASS.TOOLBAR} ${AUI_CLASS.GLASS_FRAME}`}>
          <Button
            variant="text"
            size="sm"
            aria-label={labels().previous}
            disabled={!props.loop && viewer.index === 0}
            onClick={() => viewer.previous()}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <span className={CLASS.COUNT}>
            {count ? viewer.index + 1 : 0} / {count}
          </span>
          <Button
            variant="text"
            size="sm"
            aria-label={labels().next}
            disabled={!props.loop && viewer.index >= count - 1}
            onClick={() => viewer.next()}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
          <span className={CLASS.SEP} aria-hidden="true" />
          <Button variant="text" size="sm" aria-label={labels().zoomOut} disabled={viewer.zoom <= 1} onClick={() => viewer.zoomOut()}>
            <ZoomOutIcon aria-hidden="true" />
          </Button>
          <span className={CLASS.ZOOM} aria-hidden="true">
            {Math.round(viewer.zoom * 100)}%
          </span>
          <Button
            variant="text"
            size="sm"
            aria-label={labels().zoomIn}
            disabled={viewer.zoom >= viewer.maxZoom}
            onClick={() => viewer.zoomIn()}
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
