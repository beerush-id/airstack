import { isArray, isObject, uuid } from '@airlib/core';
import { deliverBlob, IRPCBlob, IRPCFile, type IRPCFileMeta, IRPCFileStream } from './file.js';
import type { IRPCData } from './types.js';

export const IRPC_FILE_IDENTIFIER = 'IRPC_PACKET_FILE' as const;
export const IRPC_BLOB_IDENTIFIER = 'IRPC_PACKET_BLOB' as const;

export type IRPCFilePointer = {
  id: string;
  type: typeof IRPC_FILE_IDENTIFIER;
  meta: IRPCFileMeta;
};

export type IRPCBlobPointer = {
  type: typeof IRPC_BLOB_IDENTIFIER;
  url: string;
  meta?: { type?: string; size?: number; name?: string };
};

export type IRPCFileQueue = {
  file: IRPCFilePointer;
  data: Blob;
};

export type IRPCPacketJson = {
  data: IRPCData;
  files: IRPCFilePointer[];
};

export type IRPCPacketQueues = {
  json: IRPCPacketJson;
  queues: IRPCFileQueue[];
};

export type PacketStream = {
  data: IRPCData;
  files: Map<string, IRPCFileStream>;
  resolved: number;
};

export function isFilePointer(data: IRPCData) {
  return isObject(data) && data.type === IRPC_FILE_IDENTIFIER;
}

export function isBlobPointer(data: IRPCData) {
  return isObject(data) && data.type === IRPC_BLOB_IDENTIFIER;
}

export function encode(data: IRPCData) {
  const json = { data, files: [] } as IRPCPacketJson;
  const packet = { json, queues: [] } as IRPCPacketQueues;

  if (data instanceof IRPCBlob) {
    json.data = createBlobPointer(data) as any;
  } else if (data instanceof IRPCFile) {
    const { pointer, queue } = createPointer(data);

    json.data = pointer as any; // Must override the root pointer!
    json.files.push(pointer);
    packet.queues.push(queue);
  } else if (isObject(data) || isArray(data)) {
    encodePointers(data, json.files, packet.queues);
  }

  return packet;
}

export function decode(packet: IRPCPacketJson) {
  const files = packet.files.map((file) => {
    return [file.id, new IRPCFileStream(file.meta)] as [string, IRPCFileStream];
  });

  const stream: PacketStream = {
    data: packet.data,
    files: new Map<string, IRPCFileStream>(files),
    resolved: 0,
  };

  if (isFilePointer(packet.data)) {
    const { id } = packet.data as never as IRPCFilePointer;
    stream.data = stream.files.get(id) as IRPCFileStream;
  } else if (isObject(packet.data) || isArray(packet.data)) {
    decodePointers(packet.data, stream.files);
  }

  return stream;
}

function createPointer(file: IRPCFile) {
  const pointer: IRPCFilePointer = { id: uuid(), meta: file.meta, type: IRPC_FILE_IDENTIFIER };
  const queue: IRPCFileQueue = { file: pointer, data: file.data };
  return { pointer, queue };
}

function createBlobPointer(blob: IRPCBlob): IRPCBlobPointer {
  return { type: IRPC_BLOB_IDENTIFIER, url: blob.url, meta: blob.meta };
}

/**
 * Replace all IRPCFile inside an object with IRPCPacketFile.
 * @param {Record<string, unknown> | unknown[]} data - The object to encode.
 * @param {IRPCFilePointer[]} pointers - The array of IRPCPacketFile to replace.
 * @param {IRPCFileQueue[]} queues - The array of IRPCPacketFileQueue to replace.
 */
/* istanbul ignore else */
function encodePointers(
  data: Record<string, unknown> | unknown[],
  pointers: IRPCFilePointer[],
  queues: IRPCFileQueue[]
) {
  /* istanbul ignore else */
  if (isArray(data)) {
    data.forEach((item, i) => {
      if (item instanceof IRPCBlob) {
        data[i] = createBlobPointer(item);
      } else if (item instanceof IRPCFile) {
        const { pointer, queue } = createPointer(item);

        data[i] = pointer;
        pointers.push(pointer);
        queues.push(queue);
      } else if (isObject(item) || isArray(item)) {
        encodePointers(item, pointers, queues);
      }
    });
  } else if (isObject(data)) {
    Object.entries(data).forEach(([key, value]) => {
      if (value instanceof IRPCBlob) {
        data[key] = createBlobPointer(value);
      } else if (value instanceof IRPCFile) {
        const { pointer, queue } = createPointer(value);

        data[key] = pointer;
        pointers.push(pointer);
        queues.push(queue);
      } else if (isObject(value) || isArray(value)) {
        encodePointers(value, pointers, queues);
      }
    });
  }
}

/**
 * Replace all IRPCPacketFile inside an object with IRPCFileStream.
 * @param data - The object to decode.
 * @param files - The map of IRPCFileStream to replace.
 */
function decodePointers(data: Record<string, unknown> | unknown[], files: Map<string, IRPCFileStream>) {
  /* istanbul ignore else */
  if (isArray(data)) {
    data.forEach((item, i) => {
      if (isFilePointer(item as IRPCData)) {
        const { id } = item as never as IRPCFilePointer;
        data[i] = files.get(id) as IRPCFileStream;
      } else if (isObject(item) || isArray(item)) {
        decodePointers(item, files);
      }
    });
  } else if (isObject(data)) {
    Object.entries(data).forEach(([key, value]) => {
      if (isFilePointer(value as IRPCData)) {
        const { id } = value as never as IRPCFilePointer;
        data[key] = files.get(id) as IRPCFileStream;
      } else if (isObject(value) || isArray(value)) {
        decodePointers(value, files);
      }
    });
  }
}

/**
 * Recursively replaces all IRPCBlobPointer objects in a data tree with IRPCBlob instances.
 * Used by client-side transports to materialize blob references after receiving response data.
 * Eagerly calls .load() to kick off the fetch — the caller awaits the thenable to get the loaded blob.
 *
 * @param data - The data tree potentially containing IRPCBlobPointer objects.
 * @returns The data tree with blob pointers replaced by IRPCBlob instances.
 */
export function decodeBlobs<T>(data: unknown): T {
  if (!data || typeof data !== 'object') return data as T;

  if (isBlobPointer(data as IRPCData)) {
    const pointer = data as never as IRPCBlobPointer;
    const blob = deliverBlob(new IRPCBlob(pointer.url, pointer.meta));
    blob.load();
    return blob as T;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      data[i] = decodeBlobs(data[i]);
    }
  } else {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      (data as Record<string, unknown>)[key] = decodeBlobs(value);
    }
  }

  return data as T;
}

/**
 * Delivers every IRPCBlob in a data tree to its caller, so awaiting one loads it. Used by local calls,
 * where the handler's own blobs reach the caller without a pointer in between. Only reads the tree:
 * plain objects and arrays are walked, nothing is reassigned.
 *
 * @param data - The data tree a handler returned.
 * @returns The same data tree.
 */
export function deliverBlobs<T>(data: T): T {
  if (data instanceof IRPCBlob) {
    deliverBlob(data);
  } else if (Array.isArray(data)) {
    for (const item of data) deliverBlobs(item);
  } else if (data && typeof data === 'object' && Object.getPrototypeOf(data) === Object.prototype) {
    for (const value of Object.values(data)) deliverBlobs(value);
  }

  return data;
}

/**
 * Recursively replaces all IRPCBlob instances in a data tree with IRPCBlobPointer objects.
 * Used by IRPCStream to encode blobs before packets are JSON-serialized for transport.
 *
 * @param data - The data tree potentially containing IRPCBlob instances.
 * @returns A new data tree with IRPCBlob instances replaced by IRPCBlobPointer objects.
 */
export function encodeBlobs(data: unknown): unknown {
  if (data instanceof IRPCBlob) return createBlobPointer(data);
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => encodeBlobs(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    result[key] = encodeBlobs(value);
  }
  return result;
}
