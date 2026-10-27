import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, For, setup, Show } from '@airlib/react';
import type { PointerEvent } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

/**
 * A prompt point on an image, in the image's own pixels: where to look, and whether what's there
 * belongs to the object or not.
 */
export type SegmentPoint = { x: number; y: number; include: boolean };

/** One segment of the image: a mask as a model returns it, named so people and agents can refer to it. */
export type ImageSegment = {
  /** What the selection holds when this segment is picked. */
  id: string;
  /** What the segment is: "Kite", "Person in the background". */
  label: string;
  /** The mask's outline as SVG path data, in the image's pixels. */
  path: string;
  /**
   * Where the label sits, in the image's pixels: the segment's top-left corner, or its top-right on
   * the image's right half, where the label runs back from it.
   */
  anchor?: [number, number];
};

export type ImageSegmentsValue = string | string[] | null;

export type ImageSegmentsProps = ComponentStyles & {
  id?: string;
  /** Names the image's segments for screen readers, e.g. "Objects in the photo". */
  label?: string;
  src: string;
  /** What the image shows, for screen readers. */
  alt: string;
  /** The image's width in pixels; the masks are placed in these. */
  width: number;
  /** The image's height in pixels. */
  height: number;
  segments: ImageSegment[];
  /** The picked segment, or segments with `multiple`. */
  value?: Bindable<ImageSegmentsValue>;
  multiple?: boolean;
  /** `select` picks segments; `point` places prompt points for finding a new one. */
  mode?: 'select' | 'point';
  /** The prompt points placed so far, in the image's pixels. */
  points?: Bindable<SegmentPoint[]>;
  onpoint?: (event: CustomEvent<SegmentPoint>) => void;
  onchange?: (event: CustomEvent<string | string[]>) => void;
};

const LISTBOX_ROLE = 'listbox';
const OPTION_ROLE = 'option';

const CLASS = {
  CANVAS: branded('segments-canvas'),
  IMAGE: branded('segments-image'),
  SPOTLIGHT: branded('segments-spotlight'),
  REGION: branded('segments-region'),
  TAG: branded('segments-tag'),
  POINT: branded('segments-point'),
};

register('imageSegments', { color: COLORS.PRIMARY });

/**
 * An image with its segments over it — the masks a model like SAM returns — each a named object
 * to pick by pointer or with the arrows, one or several. Picked segments get a moving outline and
 * a label while the rest of the image dims. In `point` mode a press places a prompt point instead,
 * green to include, red with Alt to exclude, for asking the model for a segment it hasn't found.
 * The image and the masks share one frame in the image's own pixels, so they line up at any size.
 */
export const ImageSegments = setup<ImageSegmentsProps>((props) => {
  // The segments are a listbox's options; placing points is this composition's own pointer work.
  const segments = aria<SVGSVGElement>(LISTBOX_ROLE, props as AnyType);
  const className = () =>
    $families(
      [AUI_CLASS.SCALE, AUI_CLASS.IMAGE_SEGMENTS],
      { color: props.color, className: props.className },
      auiConfig.imageSegments
    );
  const picked = () => {
    const value = segments.value;
    return new Set(Array.isArray(value) ? value : value ? [value] : []);
  };
  const spotlightId = () => `${segments.id}-spotlight`;
  const unit = () => Math.max(props.width, props.height) / 100;

  // In point mode a press places a point, measured in the image's pixels through the svg's own
  // transform so its size and zoom never skew it; Alt marks the point as excluded.
  const placePoint = (event: PointerEvent<SVGSVGElement>) => {
    if (props.mode !== 'point' || event.button !== 0 || event.defaultPrevented) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;

    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const point: SegmentPoint = { x: Math.round(at.x), y: Math.round(at.y), include: !event.altKey };
    event.preventDefault();
    props.points = [...(props.points ?? []), point] as AnyType;
    props.onpoint?.(new CustomEvent('point', { detail: point }));
  };

  return () => (
    <div className={className()} data-mode={props.mode ?? 'select'}>
      <svg
        ref={segments.ref}
        {...segments.restProps([
          ...OMIT_KEYS,
          'src',
          'alt',
          'width',
          'height',
          'segments',
          'mode',
          'points',
          'onpoint',
        ] as never)}
        viewBox={`0 0 ${props.width} ${props.height}`}
        className={CLASS.CANVAS}
        onPointerDown={placePoint}
      >
        <image
          className={CLASS.IMAGE}
          href={props.src}
          width={props.width}
          height={props.height}
          aria-label={props.alt}
        />
        <Show when={() => picked().size > 0}>
          {() => (
            <>
              <defs>
                <mask id={spotlightId()}>
                  <rect width={props.width} height={props.height} fill="white" />
                  <For each={() => props.segments.filter((segment) => picked().has(segment.id))}>
                    {(segment) => <path d={segment.path} fill="black" />}
                  </For>
                </mask>
              </defs>
              <rect
                className={CLASS.SPOTLIGHT}
                width={props.width}
                height={props.height}
                mask={`url(#${spotlightId()})`}
              />
            </>
          )}
        </Show>
        <For each={() => props.segments}>{(segment) => <ImageSegmentRegion segment={segment} />}</For>
        <For each={() => props.segments.filter((segment) => segment.anchor && picked().has(segment.id))}>
          {(segment) => (
            <text
              className={CLASS.TAG}
              x={segment.anchor![0]}
              y={segment.anchor![1] - unit()}
              fontSize={unit() * 3}
              // On the right half a label runs back from its anchor, so it never leaves the picture.
              textAnchor={segment.anchor![0] > props.width / 2 ? 'end' : 'start'}
            >
              {segment.label}
            </text>
          )}
        </For>
        <For each={() => props.points ?? []}>
          {(point) => (
            <circle
              className={CLASS.POINT}
              cx={point.x}
              cy={point.y}
              r={unit() * 1.2}
              data-include={point.include ? 'true' : 'false'}
            />
          )}
        </For>
      </svg>
    </div>
  );
}, 'ImageSegments');

/**
 * One segment's mask: an option of the surface, named by its label.
 */
const ImageSegmentRegion = setup<{ segment: ImageSegment }>((props) => {
  // A region stands for one segment for its whole life; its id is what the selection holds.
  const option = aria(OPTION_ROLE, { value: $static(() => props.segment.id) } as AnyType);

  return () => (
    <path
      ref={option.ref as AnyType}
      {...option.restProps([...OMIT_KEYS] as never)}
      aria-label={props.segment.label}
      d={props.segment.path}
      className={CLASS.REGION}
    />
  );
}, 'ImageSegmentRegion');
