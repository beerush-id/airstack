import type { ImageOptions } from '../../image/index.js';
import { OpenAIDriver, type OpenAIOptions } from '../openai/index.js';

/** Where the Meta Model API serves Muse. */
export const MUSE_API = 'https://api.meta.ai/v1';

/** Muse's chat models on the Meta Model API. */
export const MUSE_CHAT_MODELS = ['muse-spark-1.3', 'muse-spark-1.2', 'muse-spark-1.1', 'muse-wonder-1.0'];

/** Muse Image: draws from a prompt, and edits by a prompt with reference images. */
export const MUSE_IMAGE_MODEL = 'muse-image-1.0';

/** Configuration for the Muse driver: the key, and anything to set apart from Meta's defaults. */
export type MuseOptions = Partial<OpenAIOptions> & { apiKey: string };

/**
 * Driver for Meta's Muse models on the Meta Model API: the OpenAI-compatible driver with Meta's
 * endpoint, models and Responses API by default, and what only Muse does. Muse Image edits take
 * the images to edit as URLs (public or data URLs) in a JSON request, with no mask: the prompt says
 * what to change. Attachments still to upload are left to a driver that uploads.
 */
export class MuseDriver extends OpenAIDriver {
  constructor(options: MuseOptions) {
    super({
      name: 'meta',
      baseUrl: MUSE_API,
      models: [...MUSE_CHAT_MODELS, MUSE_IMAGE_MODEL],
      defaultImageModel: MUSE_IMAGE_MODEL,
      api: 'responses',
      ...options,
    });
  }

  /**
   * Edits the attached images by the prompt with `/images/edits`.
   *
   * @param model - The image model.
   * @param payload - The draw, with its attachments.
   * @param signal - Aborts the request.
   * @returns The response, or `undefined` while an attachment is a file still to upload.
   */
  protected override async edit(
    model: string,
    payload: ImageOptions,
    signal?: AbortSignal
  ): Promise<Response | undefined> {
    const attachments = payload.attachments ?? [];
    const urls = attachments.filter((item): item is string => typeof item === 'string');
    if (urls.length !== attachments.length) return undefined;
    return this.post(
      '/images/edits',
      { ...this.imageRequest(model, payload), images: urls.map((url) => ({ image_url: url })) },
      signal
    );
  }
}
