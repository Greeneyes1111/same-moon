// Storage with two back ends: local folders for development and tests,
// Cloud Storage buckets in production. Three "kinds" of storage:
//   public  - only approved, published material (catalogue, covers, audio)
//   state   - private: review status, draft audio, volunteer recordings under review
//   uploads - private: raw volunteer uploads, deleted once processed
import fs from 'node:fs/promises';
import path from 'node:path';
import { env, isCloud } from './config.js';

const KINDS = ['public', 'state', 'uploads'];

function checkKey(key) {
  if (typeof key !== 'string' || !key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

export class LocalStore {
  constructor(base) {
    this.base = path.resolve(base);
  }

  file(kind, key) {
    if (!KINDS.includes(kind)) throw new Error(`Unknown storage kind: ${kind}`);
    checkKey(key);
    return path.join(this.base, kind, key);
  }

  async get(kind, key) {
    try {
      return await fs.readFile(this.file(kind, key));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async put(kind, key, data) {
    const file = this.file(kind, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async del(kind, key) {
    await fs.rm(this.file(kind, key), { force: true });
  }

  async exists(kind, key) {
    try {
      await fs.access(this.file(kind, key));
      return true;
    } catch {
      return false;
    }
  }

  async copy(fromKind, fromKey, toKind, toKey) {
    const data = await this.get(fromKind, fromKey);
    if (data === null) throw new Error(`Missing ${fromKind}/${fromKey}`);
    await this.put(toKind, toKey, data);
  }

  async list(kind, prefix = '') {
    const root = path.join(this.base, kind);
    const out = [];
    async function walk(dir) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err) {
        if (err.code === 'ENOENT') return;
        throw err;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
    await walk(root);
    return out.filter((k) => k.startsWith(prefix)).sort();
  }

  // Where the browser should send a volunteer recording.
  async uploadTarget(key, contentType) {
    checkKey(key);
    return {
      url: `/api/voices/local-upload/${encodeURIComponent(key)}`,
      method: 'PUT',
      headers: { 'content-type': contentType },
    };
  }
}

export class GcsStore {
  constructor(buckets) {
    for (const k of KINDS) if (!buckets[k]) throw new Error(`Bucket for "${k}" is not set`);
    this.buckets = buckets;
    this.storagePromise = import('@google-cloud/storage').then(({ Storage }) => new Storage());
  }

  async file(kind, key) {
    checkKey(key);
    const storage = await this.storagePromise;
    return storage.bucket(this.buckets[kind]).file(key);
  }

  async get(kind, key) {
    try {
      const [buf] = await (await this.file(kind, key)).download();
      return buf;
    } catch (err) {
      if (err.code === 404) return null;
      throw err;
    }
  }

  async put(kind, key, data, { contentType, cacheControl } = {}) {
    const f = await this.file(kind, key);
    await f.save(data, { resumable: false, contentType, metadata: cacheControl ? { cacheControl } : undefined });
  }

  async del(kind, key) {
    await (await this.file(kind, key)).delete({ ignoreNotFound: true });
  }

  async exists(kind, key) {
    const [ok] = await (await this.file(kind, key)).exists();
    return ok;
  }

  async copy(fromKind, fromKey, toKind, toKey, { contentType, cacheControl } = {}) {
    const src = await this.file(fromKind, fromKey);
    const dest = await this.file(toKind, toKey);
    await src.copy(dest);
    if (contentType || cacheControl) await dest.setMetadata({ contentType, cacheControl });
  }

  async list(kind, prefix = '') {
    const storage = await this.storagePromise;
    const [files] = await storage.bucket(this.buckets[kind]).getFiles({ prefix });
    return files.map((f) => f.name).sort();
  }

  async uploadTarget(key, contentType) {
    const f = await this.file('uploads', key);
    const [url] = await f.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });
    return { url, method: 'PUT', headers: { 'content-type': contentType } };
  }
}

export function makeStore() {
  if (isCloud()) {
    return new GcsStore({
      public: env('BUCKET_PUBLIC'),
      state: env('BUCKET_STATE'),
      uploads: env('BUCKET_UPLOADS'),
    });
  }
  return new LocalStore(env('DATA_DIR', path.resolve('data')));
}

export const CONTENT_TYPES = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.json': 'application/json',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

export const contentTypeFor = (key) => CONTENT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';
