import { template } from '@airlib/react';
import type { StyleInput } from '@airlib/react/core';
import { Card } from '@airlib/react-aui';
import type { ReactNode } from 'react';

export type GlassStageProps = {
  /** The glass card's own style: a form narrows it to a reading width with `maxInlineSize`. */
  style?: StyleInput;
  children?: ReactNode;
};

/**
 * Presents a demo on glass: a glass card over a surface it can frost, so the
 * demoed parts are seen on the material windows and panels are made of.
 *
 * @param props.style - The card's own style, such as a reading width for a form.
 * @param props.children - The demoed parts, laid out by the card.
 */
export const GlassStage = template<GlassStageProps>(
  (props) => (
    <div className="demo-stage">
      <Card variant="glass" as="div" style={props.style}>
        {props.children}
      </Card>
    </div>
  ),
  'GlassStage'
);
