import { AUI_CLASS, branded, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { setup, shortId, template } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $class, $families, type AuiProps, auiConfig, type ComponentStyles } from '../config.js';

export type CardHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type CardSlots = {
  media: () => ReactNode;
  header: () => ReactNode;
  actions: () => ReactNode;
};

export type CardProps = Omit<AuiProps<'article'>, 'title'> & {
  as?: 'article' | 'section' | 'div';
  title?: string;
  description?: string;
  level?: CardHeadingLevel;
  children?: ReactNode;
};

export type CardPartProps = Omit<ComponentProps<'div'>, 'className'> & Pick<ComponentStyles, 'className'>;

export type CardTitleProps = Omit<ComponentProps<'h3'>, 'className'> &
  Pick<ComponentStyles, 'className'> & {
    level?: CardHeadingLevel;
  };

const CARD_CLASS = {
  ROOT: branded('card'),
  FRAME: branded('card-frame'),
  MEDIA: branded('card-media'),
  HEADER: branded('card-header'),
  TITLE: branded('card-title'),
  DESCRIPTION: branded('card-description'),
  BODY: branded('card-body'),
  ACTIONS: branded('card-actions'),
};

const CARD_OMIT: Array<keyof CardProps> = ['as', 'title', 'description', 'level', 'children', 'className', 'size', 'color', 'variant'];

register('card', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });

/**
 * Grouped content that reads as one unit: optional media, a heading, a
 * description, the body, and actions. With `title` it renders the heading for
 * you and names the card by it, so a list of cards reads as a list of named
 * entries; the `media`, `header`, and `actions` slots fill the rest.
 */
export const Card = setup<CardProps, CardSlots>((props, slots) => {
  const titleId = `aui-card-${shortId()}`;
  const className = () =>
    $families([CARD_CLASS.ROOT, CARD_CLASS.FRAME, AUI_CLASS.SCALE], props, auiConfig.card);

  return () => {
    const Host = props.as ?? 'article';
    const hasHeader = Boolean(props.title || props.description || slots.header);

    return (
      <Host {...props.$omit(CARD_OMIT)} aria-labelledby={props.title ? titleId : undefined} className={className()}>
        {slots.media && <div className={CARD_CLASS.MEDIA}>{slots.media()}</div>}
        {hasHeader && (
          <div className={CARD_CLASS.HEADER}>
            {slots.header ? (
              slots.header()
            ) : (
              <>
                {props.title && (
                  <CardTitle id={titleId} level={props.level}>
                    {props.title}
                  </CardTitle>
                )}
                {props.description && <CardDescription>{props.description}</CardDescription>}
              </>
            )}
          </div>
        )}
        {props.children && <div className={CARD_CLASS.BODY}>{props.children}</div>}
        {slots.actions && <div className={CARD_CLASS.ACTIONS}>{slots.actions()}</div>}
      </Host>
    );
  };
}, 'Card');

/** Full-bleed image, video, or illustration at the top of a card. */
export const CardMedia = template<CardPartProps>(
  (props) => <div {...props.$omit(['className'])} className={$class(props, CARD_CLASS.MEDIA)} />,
  'CardMedia'
);

/** Groups the title and the description. */
export const CardHeader = template<CardPartProps>(
  (props) => <div {...props.$omit(['className'])} className={$class(props, CARD_CLASS.HEADER)} />,
  'CardHeader'
);

/** The card's heading; `level` picks `h2`–`h6` to fit the page outline (default `h3`). */
export const CardTitle = template<CardTitleProps>((props) => {
  const Heading = `h${props.level ?? 3}` as 'h3';
  return <Heading {...props.$omit(['className', 'level'])} className={$class(props, CARD_CLASS.TITLE)} />;
}, 'CardTitle');

/** One or two lines under the title. */
export const CardDescription = template<CardPartProps>(
  (props) => (
    <p
      {...(props.$omit(['className']) as ComponentProps<'p'>)}
      className={$class(props, CARD_CLASS.DESCRIPTION)}
    />
  ),
  'CardDescription'
);

/** The card's main content. */
export const CardBody = template<CardPartProps>(
  (props) => <div {...props.$omit(['className'])} className={$class(props, CARD_CLASS.BODY)} />,
  'CardBody'
);

/** A row of buttons or links at the bottom of the card. */
export const CardActions = template<CardPartProps>(
  (props) => <div {...props.$omit(['className'])} className={$class(props, CARD_CLASS.ACTIONS)} />,
  'CardActions'
);
