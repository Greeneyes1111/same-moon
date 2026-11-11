import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalStore } from '../shared/store.js';
import { run } from '../shared/audio.js';

export async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'samemoon-test-'));
  return { store: new LocalStore(dir), dir, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

export async function listen(server) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

// A pretend volunteer recording: a quiet tone of the given length.
export async function toneWav(seconds) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=330:duration=${seconds}`,
    '-af', 'volume=0.3', '-ar', '44100', '-ac', '1', '-f', 'wav', 'pipe:1']);
  return stdout;
}
