import { aria } from '@airlib/aria';
import { Link, setup, template } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { ariaTabsRoute } from '../../pages/(docs)/aria/route.js';

export const AriaKeyboard = template(() => {
  return (
    <section className="air-feature-section">
      <div className="air-feature-inner">
        <div className="air-feature-grid">
          <DemoTabs value="keyboard">
            <DemoTabList label="Tabs behavior">
              <DemoTabButton name="behavior">Behavior</DemoTabButton>
              <DemoTabButton name="keyboard">Keyboard</DemoTabButton>
              <DemoTabButton name="panels">Panels</DemoTabButton>
            </DemoTabList>
            <DemoTabPanel name="behavior">
              <strong>Behavior is the unit of reuse.</strong> Wrap the pattern once and the same controller drives
              React, SolidJS, or plain DOM — because it only ever touches the element you hand it.
            </DemoTabPanel>
            <DemoTabPanel name="keyboard">
              <strong>The arrows move focus, not the selection.</strong> Tab leaves the strip, Left and Right walk the
              triggers, Home and End jump to the ends, and Enter or Space commits the panel.
            </DemoTabPanel>
            <DemoTabPanel name="panels">
              <strong>Only the open panel is reachable.</strong> Every trigger points at its panel, hidden panels leave
              the tab order, and both ends of the pair stay linked by generated ids.
            </DemoTabPanel>
          </DemoTabs>

          <div className="air-feature-copy">
            <span className="air-feature-eyebrow">Composites</span>
            <h2 className="air-feature-title">Focus you never have to police</h2>
            <p className="air-feature-body">
              A tab strip is not one control, it is a conversation between triggers and panels. The controller keeps the
              strip at a single tab stop, roves focus across it, and owns which panel is open — that is the whole
              difference between &ldquo;looks accessible&rdquo; and actually is.
            </p>
            <div className="alp-keys">
              <span className="alp-key">
                <kbd>Tab</kbd> leaves the strip
              </span>
              <span className="alp-key">
                <kbd>&larr;</kbd>
                <kbd>&rarr;</kbd> move focus
              </span>
              <span className="alp-key">
                <kbd>Home</kbd>
                <kbd>End</kbd> jump to ends
              </span>
              <span className="alp-key">
                <kbd>Enter</kbd>
                <kbd>Space</kbd> open panel
              </span>
            </div>
            <Link to={ariaTabsRoute} className="air-feature-more">
              Read the tabs guide &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}, 'AriaKeyboard');

type DemoTabsProps = ComponentProps<'div'> & {
  value?: string;
  orientation?: 'horizontal' | 'vertical';
};

const DemoTabs = setup<DemoTabsProps>((props) => {
  const tabs = aria('tab', props);

  return () => (
    <div className="alp-frame">
      <div className="alp-frame-head">
        <span className="alp-frame-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="alp-frame-title">Tab strip</span>
      </div>
      <div className="alp-frame-body">
        <div ref={tabs.ref} {...tabs.restProps(['children'])} className="alp-tabs">
          {props.children}
        </div>
      </div>
    </div>
  );
}, 'DemoTabs');

type DemoTabListProps = ComponentProps<'div'> & {
  label?: string;
  children?: ReactNode;
};

const DemoTabList = setup<DemoTabListProps>((props) => {
  const list = aria('tab-list', props);

  return () => (
    <div ref={list.ref} {...list.restProps(['children'])} className="alp-tab-list">
      {props.children}
    </div>
  );
}, 'DemoTabList');

type DemoTabButtonProps = ComponentProps<'button'> & {
  name: string;
  children?: ReactNode;
};

const DemoTabButton = setup<DemoTabButtonProps>((props) => {
  const button = aria('tab-button', props);

  return () => (
    <button ref={button.ref} {...button.restProps(['children'])} className="alp-tab">
      {props.children}
    </button>
  );
}, 'DemoTabButton');

type DemoTabPanelProps = ComponentProps<'div'> & {
  name: string;
  children?: ReactNode;
};

const DemoTabPanel = setup<DemoTabPanelProps>((props) => {
  const panel = aria('tab-panel', props);

  return () => (
    <div ref={panel.ref} {...panel.restProps(['children'])} className="alp-tab-panel">
      {props.children}
    </div>
  );
}, 'DemoTabPanel');
