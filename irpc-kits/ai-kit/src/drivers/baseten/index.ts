import { OpenAIDriver, type OpenAIOptions } from '../openai/index.js';

/** Where Baseten serves its Model APIs. */
export const BASETEN_API = 'https://inference.baseten.co/v1';

/**
 * Configuration for the Baseten driver: the key, and the models to serve by their Baseten slugs,
 * since which models an account runs is its own; anything else to set apart from the defaults.
 */
export type BasetenOptions = Partial<OpenAIOptions> & Pick<OpenAIOptions, 'apiKey' | 'models'>;

/**
 * Driver for models served by Baseten's Model APIs, such as Meta's open-weight Muse Spark Open
 * (`meta-models/muse-spark-open-1026`): the OpenAI-compatible driver with Baseten's endpoint and the
 * Responses API by default. Models are named by their Baseten slugs.
 */
export class BasetenDriver extends OpenAIDriver {
  constructor(options: BasetenOptions) {
    super({ name: 'baseten', baseUrl: BASETEN_API, api: 'responses', ...options });
  }
}
