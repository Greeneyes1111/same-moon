// Audio processing with ffmpeg: joining narrated pages into one small file,
// and cleaning up volunteer recordings.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`));
    });
    if (input) p.stdin.end(input);
    else p.stdin.end();
  });
}

export async function durationOf(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = parseFloat(stdout.toString().trim());
  if (!Number.isFinite(d)) throw new Error(`Could not read duration of ${file}`);
  return d;
}

async function withTmp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'samemoon-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// Speech-tuned encodes. Opus at 18 kbps keeps a 3-minute story near 400 KB;
// AAC is the fallback for older iPhones.
async function encodeBoth(dir, wavFile) {
  const webm = path.join(dir, 'out.webm');
  const m4a = path.join(dir, 'out.m4a');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', wavFile, '-ac', '1', '-c:a', 'libopus', '-b:a', '18k',
    '-application', 'voip', webm]);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', wavFile, '-ac', '1', '-ar', '22050', '-c:a', 'aac', '-b:a', '40k',
    '-movflags', '+faststart', m4a]);
  return { webm: await fs.readFile(webm), m4a: await fs.readFile(m4a), duration: await durationOf(webm) };
}

// segments: array of WAV buffers (title first, then one per page).
// Returns the joined audio plus the second at which each page starts,
// so the app can highlight the page being read.
export async function renderStory(segments, { pause = 0.9, lead = 0.4 } = {}) {
  return withTmp(async (dir) => {
    const files = [];
    const durations = [];
    for (let i = 0; i < segments.length; i++) {
      const f = path.join(dir, `seg${i}.wav`);
      await fs.writeFile(f, segments[i]);
      files.push(f);
      durations.push(await durationOf(f));
    }
    const inputs = files.flatMap((f) => ['-i', f]);
    const chains = files.map((_, i) =>
      `[${i}:a]aresample=24000,aformat=channel_layouts=mono${i === 0 ? `,adelay=${Math.round(lead * 1000)}` : ''},apad=pad_dur=${pause}[a${i}]`);
    const filter = `${chains.join(';')};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[c];[c]loudnorm=I=-19:TP=-2:LRA=7[o]`;
    const joined = path.join(dir, 'joined.wav');
    await run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[o]', '-ar', '24000', joined]);

    const starts = [];
    let t = lead;
    for (let i = 0; i < durations.length; i++) {
      starts.push(Math.round(t * 100) / 100);
      t += durations[i] + pause;
    }
    const encoded = await encodeBoth(dir, joined);
    return { ...encoded, pageStarts: starts.slice(1) };
  });
}

// Volunteer recordings: trim silence at both ends, remove rumble, even out the
// volume, cap at 10 minutes, and encode small.
export async function transcodeVoice(input) {
  return withTmp(async (dir) => {
    const src = path.join(dir, 'in');
    await fs.writeFile(src, input);
    const trimmed = path.join(dir, 'trimmed.wav');
    const clean = path.join(dir, 'clean.wav');
    const trim = [
      'highpass=f=80',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3',
      'areverse',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.6',
      'areverse',
    ].join(',');
    // Two passes: ffmpeg 6 can stall when trimming and loudness run in one chain.
    await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-t', '600', '-af', trim, '-ac', '1', '-ar', '24000', trimmed]);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', trimmed, '-af', 'loudnorm=I=-19:TP=-2:LRA=9', '-ar', '24000', clean]);
    return encodeBoth(dir, clean);
  });
}

// A quiet hum, used instead of a real voice in tests and local development.
export async function fakeSpeech(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(1.5, Math.min(30, words / 2.4));
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=196:duration=${seconds}`,
    '-af', 'volume=0.05', '-ar', '24000', '-ac', '1', '-f', 'wav', 'pipe:1']);
  return stdout;
}
