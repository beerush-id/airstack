import { branded, register } from '@airlib/aui/utils';
import { For, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';
import { createStyleScope } from '../utils/common.js';
import { Image, ImageContent, ImageFallback } from './Image.js';

/** One person or entity in an `items` group: `alt` names them and seeds the initials. */
export type AvatarEntry = { alt: string; src?: string };

export type AvatarProps = Omit<ComponentProps<'div'>, 'color' | 'className' | 'children'> &
  Omit<ComponentStyles, 'variant'> & {
    /** Picture to show, painting as it arrives; if it fails, the initials of `alt` show instead. */
    src?: string;
    /** Who or what this is. Names the avatar for screen readers and seeds the initials. */
    alt: string;
    /** What sits on the avatar, such as a `<Badge dot />` for presence. */
    children?: ReactNode;
  };

export type AvatarGroupProps = Omit<ComponentProps<'div'>, 'color' | 'className'> &
  Omit<ComponentStyles, 'variant'> & {
    /** What the group is, e.g. "Project members". */
    label?: string;
    /** People to show; with `max`, the rest collapse into a "+N" avatar. */
    items?: AvatarEntry[];
    /** How many avatars to show before collapsing the rest. */
    max?: number;
    /** What the "+N" count means for screen readers, e.g. `(n) => \`${n} more members\``. */
    moreLabel?: (count: number) => string;
    children?: ReactNode;
  };

const AVATAR = branded('avatar');
const AVATAR_GROUP = branded('avatar-group');
const AVATAR_MORE = branded('avatar-more');
const AVATAR_LABEL = branded('avatar-label');
const SCALE = branded('scale');

const GROUP_OMIT: Array<keyof AvatarGroupProps> = ['label', 'items', 'max', 'moreLabel', 'size', 'color', 'className', 'children'];

register('avatar', { size: 'md', color: 'primary' });
register('avatarGroup', {});

const avatarScope = createStyleScope();

/**
 * A person or entity as a round picture, with their initials when the
 * picture fails or there is none. Inside an `AvatarGroup` it follows
 * the group's size and color. Children sit on the avatar — a status dot, a
 * count — and never replace the picture.
 */
export const Avatar = setup<AvatarProps>((props) => {
  const styles = avatarScope.inherit(props);
  const className = () => $families([SCALE, AVATAR], styles, auiConfig.avatar);

  return () => (
    <Image
      {...props.$omit(['size', 'color', 'className', 'children'])}
      size={styles.size}
      color={styles.color}
      className={className()}
    >
      <ImageFallback />
      <ImageContent />
      {props.children}
    </Image>
  );
}, 'Avatar');

/**
 * A row of overlapping avatars for the people on something — a project, a
 * thread, a meeting. Its size and color reach every avatar inside it. With
 * `items` and `max` it renders the avatars itself and collapses the rest
 * into a "+N" count.
 */
export const AvatarGroup = setup<AvatarGroupProps>((props) => {
  const className = () => $families(AVATAR_GROUP, { className: props.className }, auiConfig.avatarGroup);
  const moreClass = () => $families([SCALE, AVATAR, AVATAR_MORE], props, auiConfig.avatar);
  const shown = () => (props.max === undefined ? (props.items ?? []) : (props.items ?? []).slice(0, props.max));
  const hiddenCount = () => (props.items?.length ?? 0) - shown().length;

  avatarScope.provide(props);

  // The group is a named cluster of pictures; there is no kit part for it, so the shell names it.
  return () => (
    <div role="group" aria-label={props.label} {...props.$omit(GROUP_OMIT)} className={className()}>
      {props.items ? (
        <>
          <For each={shown}>{(entry) => <Avatar src={entry.src} alt={entry.alt} />}</For>
          {hiddenCount() > 0 && (
            // The visible "+N" is the name unless the caller supplies a sentence for it; no built-in wording.
            <span className={moreClass()}>
              <span aria-hidden={props.moreLabel ? 'true' : undefined}>+{hiddenCount()}</span>
              {props.moreLabel && <span className={AVATAR_LABEL}>{props.moreLabel(hiddenCount())}</span>}
            </span>
          )}
        </>
      ) : (
        props.children
      )}
    </div>
  );
}, 'AvatarGroup');
