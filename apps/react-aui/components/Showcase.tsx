import { $bind, mutable, setup, Snippet } from '@airlib/react';
import {
  Combobox,
  Confirm,
  DateRangePicker,
  Menu,
  Select,
  Slider,
  Stepper,
  Switch,
  Tabs,
} from '@airlib/react-aui';
import { DemoControl } from './DemoControl.js';

const DEPARTURES = { ams: 'Amsterdam', ber: 'Berlin', cop: 'Copenhagen', lis: 'Lisbon' };
const DESTINATIONS = { dub: 'Dublin', mad: 'Madrid', osl: 'Oslo', rom: 'Rome', vil: 'Vilnius' };
const SECTIONS = { agenda: 'Agenda', stay: 'Stay', notes: 'Notes' };
const ACTIONS = { duplicate: 'Duplicate plan', share: 'Share link', archive: 'Archive' };
const DATE_LABELS = {
  open: 'Choose dates',
  previous: 'Previous month',
  next: 'Next month',
  year: 'Year',
  start: 'Arrival',
  end: 'Departure',
};

const PANELS: Record<string, string> = {
  agenda: 'Day one is workshops, day two is the city. Evenings stay free.',
  stay: 'One shared house near the old town, walking distance to the venue.',
  notes: 'Book trains before flights; half the team prefers the overnight route.',
};

/**
 * A living tour of the library: one trip-planning screen built from simple
 * component calls, all styled from the same size and color controls.
 */
export const Showcase = setup(() => {
  const state = mutable({
    size: 'md',
    color: 'primary',
    disabled: false,
    from: 'ams',
    to: 'rom',
    dates: ['2026-11-12', '2026-11-14'] as [string, string],
    travelers: 6,
    budget: 1800,
    flexible: true,
    section: 'agenda',
  });

  return () => (
    <div className="showcase">
      <DemoControl size={$bind(state, 'size')} color={$bind(state, 'color')} disabled={$bind(state, 'disabled')} />
      <Snippet>
        {() => (
          <div className="showcase-grid">
            <section className="aui-card showcase-card" aria-label="Trip">
              <h3 className="text-title-sm">Plan the offsite</h3>
              <div className="showcase-fields">
                <Select
                  label="From"
                  options={DEPARTURES}
                  value={$bind(state, 'from')}
                  size={state.size}
                  color={state.color}
                  disabled={state.disabled}
                />
                <Combobox
                  label="Destination"
                  placeholder="Type a city"
                  options={DESTINATIONS}
                  value={$bind(state, 'to')}
                  size={state.size}
                  color={state.color}
                  disabled={state.disabled}
                />
                <DateRangePicker
                  value={$bind(state, 'dates')}
                  placeholder="YYYY-MM-DD"
                  labels={DATE_LABELS}
                  size={state.size}
                  color={state.color}
                  disabled={state.disabled}
                />
                <Stepper
                  label="Travelers"
                  decrementLabel="Fewer travelers"
                  incrementLabel="More travelers"
                  value={$bind(state, 'travelers')}
                  min={1}
                  max={20}
                  size={state.size}
                  color={state.color}
                  disabled={state.disabled}
                />
                <div className="showcase-row">
                  <Snippet>{() => <span>Budget €{state.budget}</span>}</Snippet>
                  <Slider
                    value={$bind(state, 'budget')}
                    min={500}
                    max={5000}
                    step={100}
                    valuetext={(val: number) => `${val} euro`}
                    aria-label="Budget"
                    size={state.size}
                    color={state.color}
                    disabled={state.disabled}
                  />
                </div>
                <div className="showcase-row">
                  <span>Flexible dates</span>
                  <Switch
                    checked={$bind(state, 'flexible')}
                    aria-label="Flexible dates"
                    size={state.size}
                    color={state.color}
                    disabled={state.disabled}
                  />
                </div>
              </div>
            </section>

            <section className="aui-card showcase-card" aria-label="Plan details">
              <Tabs
                label="Plan details"
                items={SECTIONS}
                value={$bind(state, 'section')}
                size={state.size}
                color={state.color}
                disabled={state.disabled}
              >
                <Tabs.Snippet for="panel">{(entry) => <p className="showcase-panel">{PANELS[entry.name]}</p>}</Tabs.Snippet>
              </Tabs>
              <div className="showcase-actions">
                <Menu label="More" items={ACTIONS} size={state.size} color={state.color} variant="tonal" />
                <Snippet>
                  {() => (
                    <Confirm
                      label="Book trip"
                      title="Book this offsite?"
                      description={`${state.travelers} travelers, ${DEPARTURES[state.from as keyof typeof DEPARTURES]} to ${DESTINATIONS[state.to as keyof typeof DESTINATIONS] ?? 'anywhere'}.`}
                      actionLabel="Book"
                      cancelLabel="Keep editing"
                      size={state.size}
                      color={state.color}
                    />
                  )}
                </Snippet>
              </div>
            </section>
          </div>
        )}
      </Snippet>
    </div>
  );
}, 'Showcase');
