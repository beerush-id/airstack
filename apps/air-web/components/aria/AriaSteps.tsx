import { For, template } from '@airlib/react';

export const AriaSteps = template(() => {
  return (
    <section className="air-feature-section" aria-labelledby="aria-steps-heading">
      <div className="air-section-inner py-12 lg:py-20">
        <div className={classes.copy}>
          <span className="air-feature-eyebrow">The whole wiring</span>
          <h2 id="aria-steps-heading" className="air-feature-title">
            Three lines and the pattern is yours
          </h2>
          <p className="air-feature-body">
            There is no provider, no registry, no context to mount. A controller is a ref, a prop bag, and a
            subscription — so it drops into markup you already have.
          </p>
        </div>

        <div className={classes.grid}>
          <For each={() => STEPS}>
            {(step) => (
              <div className="air-card flex flex-col gap-3">
                <span className="font-mono text-xs font-semibold tracking-wider text-brand">{step.index}</span>
                <h3 className="air-card-title">{step.title}</h3>
                <p className="air-card-body">{step.body}</p>
                <pre className="alp-code mt-auto">
                  <code>{step.code}</code>
                </pre>
              </div>
            )}
          </For>
        </div>

        <p className={classes.note}>
          State stays yours. Hand the controller a binding —{' '}
          <code className={classes.inlineCode}>{`pressed={$bind(state, 'pressed')}`}</code> — and it writes back on
          activation, so nothing in your app has to mirror an attribute.
        </p>
      </div>
    </section>
  );
}, 'AriaSteps');

const STEPS = [
  {
    index: '01',
    title: 'Declare',
    body: 'One factory call per pattern. The controller binds to the same reactive props your component already received.',
    code: `const toggle = aria('toggle', props);`,
  },
  {
    index: '02',
    title: 'Bind',
    body: 'Ref the element. This is the only pipe the controller needs: it attaches listeners here and cleans them up on unmount.',
    code: `<button ref={toggle.ref} ...>`,
  },
  {
    index: '03',
    title: 'Spread',
    body: 'Spread the props back. Compiled attributes land on your element, and the keys you name are dropped instead of forwarded.',
    code: `{...toggle.restProps(['children'])}`,
  },
];

const classes = {
  copy: 'max-w-2xl',
  grid: 'mt-10 grid gap-4 lg:mt-12 lg:grid-cols-3',
  note: 'mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-variant px-4 py-3 text-sm leading-relaxed text-on-surface-variant',
  inlineCode: 'rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-on-surface',
};
