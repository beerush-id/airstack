import type { Timeline, TimelineSegment } from '@airlib/core/timeline';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';

/** How far, in pixels, a pressed clip must travel before the press is a drag rather than a pick. */
const DRAG_THRESHOLD = 4;

/** How near, in pixels, a dragged clip's edge or the playhead must come to a point to snap to it. */
const SNAP_DISTANCE = 8;

/** How far the arrows move the playhead or a clip, in seconds: plain, and with Shift. Alt moves a single frame. */
const ARROW_STEP = 1;
const ARROW_LEAP = 5;

/**
 * Reactive input properties for VideoTimelineAria.
 */
export interface VideoTimelineProps extends AriaProps {
  /**
   * How wide one second is, in pixels: what turns a drag's distance into time. Clips can't be
   * dragged without it.
   */
  zoom?: number;

  /**
   * Whether drags snap: a clip's start or end to the other clips' edges, the playhead, and the
   * start; the playhead to the timeline's landmarks. Either falls back to a whole second when
   * nothing else is near. Keys still move exactly as far as they say.
   */
  snap?: boolean;

  /**
   * Whether several clips can be picked at once: Cmd or Ctrl adds or drops one, Shift picks a run
   * along one track. Without it, every pick is of one clip.
   */
  multiple?: boolean;
}

/**
 * Static configuration for VideoTimelineAria.
 */
export interface VideoTimelineOptions extends AriaOptions {
  /**
   * The timeline whose time the element carries.
   */
  timeline: Timeline;

  /**
   * The picked clips, by segment id, read and written as clicks and keys pick them. Without it,
   * picking is left to whatever else the clips are.
   */
  selection?: {
    get: () => string[];
    set: (ids: string[]) => void;
  };

  /**
   * Whether a clip's content is tied to its source's time — footage, sound — so trimming its head
   * cuts into the content rather than sliding it. Clips are free unless it says so.
   */
  sourced?: (segment: TimelineSegment) => boolean;
}

/** A clip being moved: its segment, its element, and where it started before the move. */
type Moving = { segment: TimelineSegment; clip?: HTMLElement | null; from: number };

/**
 * A view of a timeline laid out in time — an editor, a scrubber — that styles its parts by where
 * the timeline is, without the view framework re-rendering anything. Its element carries the
 * timeline's time and length, in seconds, as `--aria-timeline-time` and `--aria-timeline-length`,
 * rewritten on every frame the timeline moves to: playing, seeking, or dragged. Everything inside
 * reads the same two numbers, so a playhead, its handle, and whatever follows it can't part.
 *
 * Its clips are elements naming their segment in `data-segment`; its tracks, elements naming
 * theirs in `data-track`. A click picks one clip; with `multiple`, Cmd or Ctrl adds or drops one
 * and Shift picks the run from the last one picked, along its track.
 *
 * Clips can be dragged along the time, a whole frame at a time and never before the start,
 * snapping when `snap` is on; dragging a picked clip moves every picked one with it, the same
 * distance. Pressing a clip's edge — an element inside it naming the edge in `data-edge`, `start`
 * or `end` — resizes that clip alone: its end changes how long it runs; its start moves it and
 * keeps its end, cutting into its content when `sourced` says it's tied to its source's time. A
 * clip runs at least a frame, and no longer than its content does when its segment knows that
 * (`contentFrames`). While moving or resizing, clips are marked `data-dragging` and carry
 * their new start and length in seconds as `--aria-timeline-start` and `--aria-timeline-span`,
 * ahead of any re-render; the segments and what's shown at the current time move with them.
 * Escape puts them back.
 *
 * The keys act on what has focus, and come to it before anything inside handles them. Space plays
 * or pauses. Left and Right move the playhead by a second — or move a focused clip, with every
 * picked one when it is picked — Shift by five seconds, Alt by a frame. Home and End go to the
 * start and the last frame of the timeline, or of a focused clip. Page Up and Page Down go to the
 * previous and next landmark, a clip's edge among them. On a track, Up and Down focus and pick its
 * clip nearest the playhead, and from a clip, the one before or after it on the same track; Shift
 * picks the run there, Cmd or Ctrl only moves focus, and Enter adds or drops the focused clip.
 *
 * @template E - Target Element type
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class VideoTimelineAria<
  E extends BaseElement = HTMLElement,
  T extends VideoTimelineProps = VideoTimelineProps,
  A extends AriaAttributes<E> = AriaAttributes<E>,
  O extends VideoTimelineOptions = VideoTimelineOptions,
> extends Aria<E, T, A, O> {
  /** The clip a run is picked from: the last one picked other than by Shift, by segment id. */
  protected anchor?: string;
  /** Set when a drag ends, so the click that follows it doesn't pick again. */
  protected dragged = false;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.update();
  }

  /**
   * The timeline this element follows.
   */
  public get timeline(): Timeline {
    return this.options.timeline;
  }

  /**
   * How wide one second is, in pixels.
   */
  public get zoom(): number | undefined {
    return this.properties.zoom;
  }

  /**
   * The picked clips, by segment id.
   */
  public get picked(): string[] {
    return this.options.selection?.get() ?? [];
  }

  /**
   * Where a playhead dragged to a time lands: on the nearest of the timeline's landmarks — a
   * clip's edge, a keyframe, a marker, either end — when snapping is on and one is near enough,
   * or else on a whole second near enough.
   *
   * @param time - Where the drag is, in seconds.
   * @returns Where the playhead goes, in seconds.
   */
  public snapTime(time: number): number {
    const reach = this.reach();
    if (!reach) return time;
    const rate = this.timeline.frameRate;
    const frame = time * rate;
    let landed: number | undefined;
    let gap = reach;
    for (const landmark of this.timeline.getLandmarks()) {
      const distance = Math.abs(landmark - frame);
      if (distance <= gap) [landed, gap] = [landmark, distance];
    }
    const second = this.nearestSecond(frame);
    landed ??= Math.abs(second - frame) <= reach ? second : frame;
    return landed / rate;
  }

  /**
   * Writes the timeline's time and length onto the element now, and again on every frame it
   * moves to, lets its clips be picked and dragged, and takes its keys.
   *
   * @returns Detachment callback
   */
  protected override attach() {
    const element = this.element as HTMLElement | null;
    if (!element) return;

    const write = (time: number) => {
      element.style.setProperty('--aria-timeline-time', String(time));
      element.style.setProperty('--aria-timeline-length', String(this.timeline.state.totalTime));
    };
    write(this.timeline.state.time);
    const unsubscribe = this.timeline.subscribe((state) => write(state.time));

    const press = (event: PointerEvent) => {
      this.dragged = false;
      if (event.button !== 0 || !this.zoom) return;
      const clip = (event.target as Element).closest<HTMLElement>('[data-segment]');
      const segment = clip && element.contains(clip) ? this.segmentOf(clip.dataset.segment) : undefined;
      if (!clip || !segment) return;
      const edge = (event.target as Element).closest<HTMLElement>('[data-edge]')?.dataset.edge;
      if (edge === 'start' || edge === 'end') this.resize(event, segment, clip, edge);
      else this.drag(event, segment);
    };
    element.addEventListener('pointerdown', press);
    element.addEventListener('click', this.handleClick, true);
    element.addEventListener('keydown', this.handleKey, true);

    return () => {
      unsubscribe();
      element.removeEventListener('pointerdown', press);
      element.removeEventListener('click', this.handleClick, true);
      element.removeEventListener('keydown', this.handleKey, true);
    };
  }

  /**
   * Picks by a click on a clip, before anything inside reads the click: the clip alone, or with
   * `multiple`, added or dropped with Cmd or Ctrl, or the run to it with Shift. The click that ends
   * a drag keeps the pick, unless the dragged clip wasn't picked, which it then picks alone.
   */
  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.options.selection) return;
    const segment = this.segmentOf((event.target as Element).closest<HTMLElement>('[data-segment]')?.dataset.segment);
    if (!segment) return;
    event.preventDefault();
    event.stopPropagation();

    if (this.dragged) {
      this.dragged = false;
      if (!this.picked.includes(segment.id)) this.pickOnly(segment);
    } else if (this.properties.multiple && (event.metaKey || event.ctrlKey)) {
      this.toggle(segment);
    } else if (this.properties.multiple && event.shiftKey) {
      this.pickRun(segment);
    } else {
      this.pickOnly(segment);
    }
  };

  /**
   * Acts on a key by what has focus: a clip, or anywhere else in the element, which is the timeline.
   */
  private readonly handleKey = (event: KeyboardEvent): void => {
    const command = event.ctrlKey || event.metaKey;
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    if (event.defaultPrevented || (command && !vertical) || isTyping(event.target)) return;
    const timeline = this.timeline;
    const clip = (event.target as Element).closest<HTMLElement>('[data-segment]');
    const segment = clip ? this.segmentOf(clip.dataset.segment) : undefined;
    // The timeline's and a segment's end frames are their last frames, not the ones after.
    const last = timeline.state.totalFrames;

    switch (event.key) {
      case ' ':
        if (!event.repeat) timeline.state.status === 'playing' ? timeline.pause() : timeline.play();
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const frames = this.stepOf(event) * (event.key === 'ArrowLeft' ? -1 : 1);
        if (segment) this.nudge(segment, frames);
        else void timeline.scrub(Math.min(Math.max(timeline.state.frame + frames, 0), last));
        break;
      }
      case 'Home':
        void timeline.scrub(segment ? segment.startFrame : 0);
        break;
      case 'End':
        void timeline.scrub(segment ? segment.endFrame : last);
        break;
      case 'PageUp':
        void timeline.prev();
        break;
      case 'PageDown':
        void timeline.next();
        break;
      case 'ArrowUp':
      case 'ArrowDown': {
        const multiple = this.properties.multiple;
        const how = multiple && command ? 'focus' : multiple && event.shiftKey ? 'run' : 'pick';
        this.pickAlong(event.target as Element, segment, event.key === 'ArrowUp' ? -1 : 1, how);
        break;
      }
      case 'Enter':
        if (!segment || !this.options.selection) return;
        if (this.properties.multiple) this.toggle(segment);
        else this.pickOnly(segment);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /**
   * How many frames an arrow moves: a second, five with Shift, one frame with Alt.
   *
   * @param event - The arrow's key event.
   * @returns The step, in frames.
   */
  protected stepOf(event: KeyboardEvent): number {
    if (event.altKey) return 1;
    return Math.round((event.shiftKey ? ARROW_LEAP : ARROW_STEP) * this.timeline.frameRate);
  }

  /**
   * Picks one clip alone, and makes it where a run starts.
   *
   * @param segment - The clip's segment.
   */
  protected pickOnly(segment: TimelineSegment): void {
    this.anchor = segment.id;
    this.options.selection?.set([segment.id]);
  }

  /**
   * Adds a clip to the pick, or drops it when it's already picked, and makes it where a run starts.
   *
   * @param segment - The clip's segment.
   */
  protected toggle(segment: TimelineSegment): void {
    const picked = this.picked;
    this.anchor = segment.id;
    this.options.selection?.set(
      picked.includes(segment.id) ? picked.filter((id) => id !== segment.id) : [...picked, segment.id]
    );
  }

  /**
   * Picks the run of clips from where a run starts to this one, along their track, in time order;
   * a clip on another track, or with nothing to run from, is picked alone.
   *
   * @param segment - The clip the run goes to.
   */
  protected pickRun(segment: TimelineSegment): void {
    const anchor = this.segmentOf(this.anchor);
    const track = this.trackOf(segment);
    if (!anchor || !track?.segments.has(anchor)) return this.pickOnly(segment);

    const along = [...track.segments].sort((a, b) => a.startFrame - b.startFrame);
    const [from, to] = [along.indexOf(anchor), along.indexOf(segment)].sort((a, b) => a - b);
    this.options.selection?.set(along.slice(from, to + 1).map((each) => each.id));
  }

  /**
   * Moves a clip by some frames — with every picked clip when it is picked — none before the
   * start, and lets the view's own starts take over once they have caught up.
   *
   * @param segment - The clip's segment.
   * @param frames - How far, in frames: negative is earlier.
   */
  protected nudge(segment: TimelineSegment, frames: number): void {
    const group = this.moving(segment);
    this.shift(group, frames);
    for (const each of group) this.settle(each.clip);
  }

  /**
   * Focuses a clip along one track, in time order — from a focused clip, the one before or after
   * it, staying put at either end; from the track itself, the one nearest the playhead — and picks
   * it alone, picks the run to it, or only focuses it.
   *
   * @param target - What has focus: a clip, or a track.
   * @param from - The focused clip's segment, if a clip has focus.
   * @param direction - -1 for the clip before, 1 for the one after.
   * @param how - Whether to pick it alone, pick the run to it, or only focus it.
   */
  protected pickAlong(
    target: Element,
    from: TimelineSegment | undefined,
    direction: -1 | 1,
    how: 'pick' | 'run' | 'focus'
  ): void {
    const lane = target.closest<HTMLElement>('[data-track]');
    const track = from ? this.trackOf(from) : [...this.timeline.tracks].find((each) => each.id === lane?.dataset.track);
    if (!track) return;

    const along = [...track.segments].sort((a, b) => a.startFrame - b.startFrame);
    const frame = this.timeline.state.frame;
    const distance = (segment: TimelineSegment) => Math.max(segment.startFrame - frame, frame - segment.endFrame, 0);
    const next = from ? along[along.indexOf(from) + direction] : [...along].sort((a, b) => distance(a) - distance(b))[0];
    const clip = next && this.clipOf(next);
    if (!next || !clip) return;

    clip.focus();
    if (how === 'focus') return;
    if (how === 'pick' || !this.options.selection) {
      clip.click();
      return;
    }
    if (!this.segmentOf(this.anchor) && from) this.anchor = from.id;
    this.pickRun(next);
  }

  /**
   * Follows a press on a clip: once it travels far enough it drags the clip — with every picked
   * clip when it is picked — along the time, until the pointer lets go, or is cancelled, or Escape
   * is pressed, which put them back.
   *
   * @param press - The press that began it.
   * @param segment - The pressed clip's segment.
   */
  protected drag(press: PointerEvent, segment: TimelineSegment): void {
    const group = this.moving(segment);
    const others = new Set(group.map((each) => each.segment));
    const from = segment.startFrame;
    let dragging = false;

    const move = (event: PointerEvent) => {
      const distance = event.clientX - press.clientX;
      if (!dragging && Math.abs(distance) < DRAG_THRESHOLD) return;
      if (!dragging) for (const each of group) each.clip?.setAttribute('data-dragging', '');
      dragging = true;
      const frames = Math.round((distance / (this.zoom ?? 1)) * this.timeline.frameRate);
      this.shift(group, this.snapClip(segment, Math.max(0, from + frames), others) - from);
    };
    const end = (back: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape, true);
      if (!dragging) return;
      this.dragged = true;
      if (back) this.shift(group, 0);
      for (const each of group) {
        each.clip?.removeAttribute('data-dragging');
        this.settle(each.clip);
      }
    };
    const drop = () => end(false);
    const cancel = () => end(true);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragging) return;
      event.preventDefault();
      event.stopPropagation();
      end(true);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape, true);
  }

  /**
   * Follows a press on a clip's edge: once it travels far enough it resizes the clip from that
   * edge, a whole frame at a time, until the pointer lets go — or is cancelled, or Escape is
   * pressed, which put it back. Its end changes how long it runs. Its start moves it and keeps its
   * end; a sourced clip's content stays put, so the start can't go before the content does.
   *
   * @param press - The press that began it.
   * @param segment - The clip's segment.
   * @param clip - The clip.
   * @param edge - Which edge was pressed.
   */
  protected resize(press: PointerEvent, segment: TimelineSegment, clip: HTMLElement, edge: 'start' | 'end'): void {
    const start = segment.startFrame;
    const length = segment.totalFrames;
    const offset = segment.offsetFrame;
    const sourced = !!this.options.sourced?.(segment);
    const alone = new Set([segment]);
    let resizing = false;

    const move = (event: PointerEvent) => {
      const distance = event.clientX - press.clientX;
      if (!resizing && Math.abs(distance) < DRAG_THRESHOLD) return;
      if (!resizing) clip.setAttribute('data-dragging', '');
      resizing = true;
      const frames = Math.round((distance / (this.zoom ?? 1)) * this.timeline.frameRate);

      // A clip runs no longer than its content has left from its offset, when that's known.
      const content = segment.contentFrames ?? Infinity;
      if (edge === 'end') {
        const end = this.snapEdge(start + length + frames, alone);
        this.trim(segment, clip, start, Math.min(Math.max(1, end - start), content - offset), offset);
      } else {
        // The start goes no later than a frame before the end, no earlier than the timeline, and
        // no earlier than its content: a sourced clip's content begins at its offset, and a free
        // clip's runs no longer than it has.
        const earliest = Math.max(0, sourced ? start - offset : start + length - (content - offset));
        const to = Math.min(Math.max(this.snapEdge(start + frames, alone), earliest), start + length - 1);
        this.trim(segment, clip, to, start + length - to, sourced ? offset + to - start : offset);
      }
    };
    const end = (back: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape, true);
      if (!resizing) return;
      this.dragged = true;
      if (back) this.trim(segment, clip, start, length, offset);
      clip.removeAttribute('data-dragging');
      this.settle(clip);
    };
    const drop = () => end(false);
    const cancel = () => end(true);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !resizing) return;
      event.preventDefault();
      event.stopPropagation();
      end(true);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape, true);
  }

  /**
   * Sets where a clip starts, how many frames it runs, and how far into its content it begins,
   * its element with it at once, and shows the current time again with it as it is now.
   *
   * @param segment - The clip's segment.
   * @param clip - The clip.
   * @param start - Its first frame.
   * @param length - How many frames it runs.
   * @param offset - How far into its content it begins, in frames.
   */
  protected trim(segment: TimelineSegment, clip: HTMLElement, start: number, length: number, offset: number): void {
    const rate = this.timeline.frameRate;
    // The content's offset first, so keyframes past a shorter length aren't clamped on the way.
    if (segment.offsetFrame !== offset) segment.offsetFrame = offset;
    if (segment.startFrame !== start) segment.startFrame = start;
    if (segment.totalFrames !== length) segment.duration = (length * (segment.speed || 1)) / rate;
    clip.style.setProperty('--aria-timeline-start', String(segment.startTime));
    clip.style.setProperty('--aria-timeline-span', String(segment.totalFrames / rate));
    this.timeline.refresh();
    void this.timeline.seek(this.timeline.state.time);
  }

  /**
   * What moves when a clip moves: every picked clip when it is picked, otherwise the clip alone,
   * each with where it starts now.
   *
   * @param segment - The clip being moved.
   * @returns The clips that move with it, itself among them.
   */
  protected moving(segment: TimelineSegment): Moving[] {
    const ids = this.picked.includes(segment.id) ? this.picked : [segment.id];
    return ids
      .map((id) => this.segmentOf(id))
      .filter((each): each is TimelineSegment => !!each)
      .map((each) => ({ segment: each, clip: this.clipOf(each), from: each.startFrame }));
  }

  /**
   * Moves clips together by some frames from where they started, none before the start — the
   * earliest holds the rest back — their elements with them at once, and shows the current time
   * again with them in their new places.
   *
   * @param group - The clips moving, with where each started.
   * @param frames - How far from where they started, in frames: negative is earlier.
   */
  protected shift(group: Moving[], frames: number): void {
    const by = Math.max(frames, -Math.min(...group.map((each) => each.from)));
    let moved = false;
    for (const each of group) {
      const frame = each.from + by;
      if (each.segment.startFrame !== frame) {
        each.segment.startFrame = frame;
        moved = true;
      }
      each.clip?.style.setProperty('--aria-timeline-start', String(each.segment.startTime));
    }
    if (!moved) return;
    this.timeline.refresh();
    void this.timeline.seek(this.timeline.state.time);
  }

  /**
   * Where a clip dragged to start at a frame lands: with its start or its end on the nearest point
   * near enough — another clip's edge, the playhead, or the start — when snapping is on, or else
   * on a whole second near enough.
   *
   * @param segment - The dragged clip's segment.
   * @param frame - Where the drag would start it.
   * @param moving - The clips moving with it, whose edges it doesn't snap to.
   * @returns Where it starts.
   */
  protected snapClip(segment: TimelineSegment, frame: number, moving: Set<TimelineSegment>): number {
    const reach = this.reach();
    if (!reach) return frame;
    // Edges are the first frame of a clip and the first after it, so clips snap end to start.
    const length = segment.endFrame + 1 - segment.startFrame;
    const points = [0, this.timeline.state.frame];
    for (const track of this.timeline.tracks) {
      for (const other of track.segments) if (!moving.has(other)) points.push(other.startFrame, other.endFrame + 1);
    }

    const nearest = (starts: number[]): number | undefined => {
      let landed: number | undefined;
      let gap = reach;
      for (const start of starts) {
        const distance = Math.abs(start - frame);
        if (start >= 0 && distance <= gap) [landed, gap] = [start, distance];
      }
      return landed;
    };
    const edges = points.flatMap((point) => [point, point - length]);
    const seconds = [this.nearestSecond(frame), this.nearestSecond(frame + length) - length];
    return nearest(edges) ?? nearest(seconds) ?? frame;
  }

  /**
   * Where a resized clip's edge lands: on the nearest point near enough — another clip's edge, the
   * playhead, or the start — when snapping is on, or else on a whole second near enough.
   *
   * @param edge - The edge's frame: a clip's first frame, or the first after it.
   * @param moving - The clips being resized, whose edges it doesn't snap to.
   * @returns Where the edge goes.
   */
  protected snapEdge(edge: number, moving: Set<TimelineSegment>): number {
    const reach = this.reach();
    if (!reach) return edge;
    const points = [0, this.timeline.state.frame];
    for (const track of this.timeline.tracks) {
      for (const other of track.segments) if (!moving.has(other)) points.push(other.startFrame, other.endFrame + 1);
    }
    let landed: number | undefined;
    let gap = reach;
    for (const point of points) {
      const distance = Math.abs(point - edge);
      if (distance <= gap) [landed, gap] = [point, distance];
    }
    const second = this.nearestSecond(edge);
    return landed ?? (Math.abs(second - edge) <= reach ? second : edge);
  }

  /**
   * The whole second nearest a frame.
   *
   * @param frame - The frame.
   * @returns The frame a whole second starts on.
   */
  protected nearestSecond(frame: number): number {
    const rate = this.timeline.frameRate;
    return Math.round(frame / rate) * rate;
  }

  /**
   * How near, in frames, a point must be to snap to it at this zoom; none while snapping is off.
   *
   * @returns The reach, or 0 when nothing snaps.
   */
  protected reach(): number {
    return this.properties.snap && this.zoom ? (SNAP_DISTANCE / this.zoom) * this.timeline.frameRate : 0;
  }

  /**
   * Hands a moved clip's start back to the view: its own start has caught up by the next frame,
   * and until then the one written here holds the clip in place.
   *
   * @param clip - The moved clip.
   */
  protected settle(clip?: HTMLElement | null): void {
    requestAnimationFrame(() => {
      clip?.style.removeProperty('--aria-timeline-start');
      clip?.style.removeProperty('--aria-timeline-span');
    });
  }

  /**
   * Finds a segment of the timeline by its id.
   *
   * @param id - The segment's id.
   * @returns The segment, if the timeline has one by that id.
   */
  protected segmentOf(id?: string): TimelineSegment | undefined {
    if (!id) return;
    for (const track of this.timeline.tracks) {
      for (const segment of track.segments) if (segment.id === id) return segment;
    }
  }

  /**
   * The track a segment is on.
   *
   * @param segment - The segment.
   * @returns Its track, if it's on the timeline.
   */
  protected trackOf(segment: TimelineSegment) {
    return [...this.timeline.tracks].find((track) => track.segments.has(segment));
  }

  /**
   * A segment's clip in the element.
   *
   * @param segment - The segment.
   * @returns Its clip, if one is drawn.
   */
  protected clipOf(segment: TimelineSegment): HTMLElement | null | undefined {
    return this.element?.querySelector<HTMLElement>(`[data-segment="${CSS.escape(segment.id)}"]`);
  }
}

/**
 * Whether a key on an element is its own: typing into a field, or pressing a button a clip's
 * content put there — not the timeline's to take.
 *
 * @param target - Where the key landed.
 * @returns Whether it keeps the key for itself.
 */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, button'));
}
