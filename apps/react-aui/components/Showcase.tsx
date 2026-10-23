import { $bind, mutable, setup, Snippet } from '@airlib/react';
import {
  Card,
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
 * component calls, every component exactly as it ships.
 */
export const Showcase = setup(() => {
  const state = mutable({
    from: 'ams',
    to: 'rom',
    dates: ['2026-11-12', '2026-11-14'] as [string, string],
    travelers: 6,
    budget: 1800,
    flexible: true,
    section: 'agenda',
  });

  return () => (
    <div className="showcase demo-stage">
      <div className="showcase-grid">
        <Card variant="glass" as="div" className="showcase-card">
          <div className="text-title-sm">Plan the offsite</div>
          <div className="showcase-fields">
            <Select label="From" options={DEPARTURES} value={$bind(state, 'from')} />
            <Combobox label="Destination" placeholder="Type a city" options={DESTINATIONS} value={$bind(state, 'to')} />
            <DateRangePicker value={$bind(state, 'dates')} placeholder="YYYY-MM-DD" labels={DATE_LABELS} />
            <Stepper
              label="Travelers"
              decrementLabel="Fewer travelers"
              incrementLabel="More travelers"
              value={$bind(state, 'travelers')}
              min={1}
              max={20}
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
              />
            </div>
            <div className="showcase-row">
              <span>Flexible dates</span>
              <Switch checked={$bind(state, 'flexible')} aria-label="Flexible dates" />
            </div>
          </div>
        </Card>

        <Card variant="glass" as="div" className="showcase-card">
          <Tabs label="Plan details" items={SECTIONS} value={$bind(state, 'section')}>
            <Tabs.Snippet for="panel">{(entry) => <p className="showcase-panel">{PANELS[entry.name]}</p>}</Tabs.Snippet>
          </Tabs>
          <div className="showcase-actions">
            <Menu label="More" items={ACTIONS} />
            <Snippet>
              {() => (
                <Confirm
                  label="Book trip"
                  title="Book this offsite?"
                  description={`${state.travelers} travelers, ${DEPARTURES[state.from as keyof typeof DEPARTURES]} to ${DESTINATIONS[state.to as keyof typeof DESTINATIONS] ?? 'anywhere'}.`}
                  actionLabel="Book"
                  cancelLabel="Keep editing"
                />
              )}
            </Snippet>
          </div>
        </Card>
      </div>
    </div>
  );
}, 'Showcase');
