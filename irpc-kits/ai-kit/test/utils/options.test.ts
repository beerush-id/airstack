import { describe, expect, it } from 'vitest';
import { mergeOptions } from '../../src/utils/options.js';

type SampleOptions = {
  model?: string;
  temperature?: number;
  aspectRatio?: string;
  seed?: number;
};

describe('mergeOptions', () => {
  it('resolves options with Call overrides winning over Instance defaults', () => {
    const merged = mergeOptions<SampleOptions>({ model: 'gpt-x', temperature: 0.7 }, { temperature: 0.2 });

    expect(merged).toEqual({ model: 'gpt-x', temperature: 0.2 });
  });

  it('unions keys across tiers without dropping lower-tier defaults', () => {
    const merged = mergeOptions<SampleOptions>({ model: 'gpt-x' }, { aspectRatio: '16:9', seed: 42 });

    expect(merged).toEqual({ model: 'gpt-x', aspectRatio: '16:9', seed: 42 });
  });

  it('treats missing tiers as empty and resolves to an empty object when no options are supplied', () => {
    expect(mergeOptions<SampleOptions>(undefined, { model: 'gpt-x' })).toEqual({ model: 'gpt-x' });
    expect(mergeOptions<SampleOptions>({ model: 'gpt-x' })).toEqual({ model: 'gpt-x' });
    expect(mergeOptions<SampleOptions>()).toEqual({});
  });
});
