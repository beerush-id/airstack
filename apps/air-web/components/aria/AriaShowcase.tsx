import { aria } from '@airlib/aria';
import { $bind, type Bindable, For, mutable, setup, Show, Snippet } from '@airlib/react';
import type { ComponentProps } from 'react';

type Host = 'button' | 'div' | 'svg';

const HOSTS: Host[] = ['button', 'div', 'svg'];

const COMPILED: Record<Host, [string, string, boolean][]> = {
  button: [
    ['role', 'not written', false],
    ['tabindex', 'native', false],
    ['aria-pressed', 'controlled', true],
    ['type', 'button', true],
  ],
  div: [
    ['role', 'button', true],
    ['tabindex', '0', true],
    ['aria-pressed', 'controlled', true],
    ['type', 'not written', false],
  ],
  svg: [
    ['role', 'button', true],
    ['tabindex', '0', true],
    ['aria-pressed', 'controlled', true],
    ['type', 'not written', false],
  ],
};

const SNIPPET: Record<Host, string> = {
  button: "aria('toggle', props) // native: true",
  div: "aria('toggle', props, { native: false })",
  svg: "aria('toggle', props, { native: false })",
};

export const AriaShowcase = setup(() => {
  const state = mutable<{ host: Host; pressed: boolean }>({ host: 'div', pressed: false });

  return () => (
    <section id="showcase" className="air-feature-section scroll-mt-20" aria-labelledby="aria-showcase-heading">
      <div className="air-feature-inner">
        <div className={classes.copy}>
          <span className="air-feature-eyebrow">Any element, same behavior</span>
          <h2 id="aria-showcase-heading" className="air-feature-title">
            One controller. Three hosts.
          </h2>
          <p className="air-feature-body">
            The controller never picks the host for you. Point the same toggle at a native button, a plain container, or
            an SVG element, and the compiled contract changes to match — nothing else in your code does.
          </p>
        </div>

        <div className={classes.showcase}>
          <div className="alp-show-panel">
            <span className="alp-show-label">1 &middot; Pick the host</span>
            <Snippet data={() => state.host}>
              {(host) => (
                <>
                  <div className="alp-seg">
                    <For each={() => HOSTS}>
                      {(option) => (
                        <button type="button" aria-pressed={host === option} onClick={() => (state.host = option)}>
                          {`<${option}>`}
                        </button>
                      )}
                    </For>
                  </div>
                  <pre className="alp-code">
                    <b>const</b> toggle = <i>{SNIPPET[host]}</i>
                  </pre>
                </>
              )}
            </Snippet>
            <p className="alp-note">
              Press the control, then switch hosts: the state survives, because the state was never the element&rsquo;s.
            </p>
          </div>

          <div className="alp-show-panel">
            <span className="alp-show-label">2 &middot; The element</span>
            <div className="alp-show-stage">
              <Show when={() => state.host === 'button'}>
                <ButtonHost pressed={$bind(state, 'pressed')} />
              </Show>
              <Show when={() => state.host === 'div'}>
                <DivHost pressed={$bind(state, 'pressed')} />
              </Show>
              <Show when={() => state.host === 'svg'}>
                <SvgHost pressed={$bind(state, 'pressed')} />
              </Show>
            </div>
          </div>

          <div className="alp-show-panel">
            <span className="alp-show-label">3 &middot; Compiled attributes</span>
            <Snippet data={() => state.host}>
              {(host) => (
                <div className="alp-attr-list">
                  <For each={() => COMPILED[host]}>
                    {([key, value, on]) => (
                      <div className="alp-attr-row">
                        <span className="alp-attr-key">{key}</span>
                        <span className={on ? 'alp-attr-value is-on' : 'alp-attr-value is-empty'}>{value}</span>
                      </div>
                    )}
                  </For>
                  <div className="alp-attr-row">
                    <span className="alp-attr-key">pressed</span>
                    <Snippet data={() => state.pressed}>
                      {(pressed) => (
                        <span className={pressed ? 'alp-attr-value is-on' : 'alp-attr-value is-off'}>
                          {pressed ? 'true' : 'false'}
                        </span>
                      )}
                    </Snippet>
                  </div>
                </div>
              )}
            </Snippet>
            <p className="alp-note">
              Reads like the spec: what the browser already owns is left alone, what it cannot do is written for it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}, 'AriaShowcase');

const ButtonHost = setup<{ pressed?: Bindable<boolean> }>((props) => {
  const toggle = aria<HTMLButtonElement>('toggle', props, { native: true });

  return () => (
    <button ref={toggle.ref} {...(toggle.restProps(['children']) as ComponentProps<'button'>)} className="alp-host">
      <svg className="alp-host-star" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
      </svg>
      <span>Favourite</span>
    </button>
  );
}, 'ButtonHost');

const DivHost = setup<{ pressed?: Bindable<boolean> }>((props) => {
  const toggle = aria<HTMLElement>('toggle', props, { native: false });

  return () => (
    <div ref={toggle.ref} {...(toggle.restProps(['children']) as ComponentProps<'div'>)} className="alp-host">
      <svg className="alp-host-star" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
      </svg>
      <span>Favourite</span>
    </div>
  );
}, 'DivHost');

const SvgHost = setup<{ pressed?: Bindable<boolean> }>((props) => {
  const toggle = aria<SVGSVGElement>('toggle', props, { native: false });

  return () => (
    <svg
      ref={toggle.ref}
      {...(toggle.restProps(['children']) as ComponentProps<'svg'>)}
      className="alp-host alp-host-svg"
      viewBox="0 0 24 24"
      aria-label="Favourite"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}, 'SvgHost');

const classes = {
  copy: 'max-w-2xl',
  showcase: 'alp-show mt-10 lg:mt-12',
};
