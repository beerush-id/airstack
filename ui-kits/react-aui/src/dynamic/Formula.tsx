import { $static, setup } from '@airlib/react';
import temml from 'temml';

export type FormulaProps = {
  /** The formula, written in LaTeX, e.g. `E = mc^2`. */
  tex: string;
  /** Sets it on a line of its own, centered, rather than within the text. */
  display?: boolean;
};

/**
 * A math formula, drawn by the browser itself as MathML — no fonts or
 * stylesheet to ship, and it takes the text color around it. A formula that
 * doesn't parse shows its LaTeX, marked as an error, instead of breaking the
 * page.
 */
export const Formula = setup<FormulaProps>((props) => {
  // A formula is complete when drawn; its MathML is built once. Temml escapes the source, so the markup is its own.
  const markup = $static(() => temml.renderToString(props.tex, { displayMode: !!props.display, throwOnError: false }));
  const Tag = $static(() => (props.display ? 'div' : 'span'));

  // biome-ignore lint/security/noDangerouslySetInnerHtml: Temml's MathML, built from escaped source.
  return () => <Tag className="aui-formula" dangerouslySetInnerHTML={{ __html: markup }} />;
}, 'Formula');
