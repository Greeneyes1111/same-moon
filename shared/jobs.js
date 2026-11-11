// Starting the publish job after an approval.
// Cloud: runs the Cloud Run job through the Admin API using the caller's
// service account. Local: runs the same script in a child process.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, isCloud } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function triggerPublish() {
  if (!isCloud()) {
    const script = path.join(here, '..', 'jobs', 'publish', 'run.js');
    const child = spawn(process.execPath, [script, `--tts=${env('LOCAL_TTS', 'fake')}`], {
      stdio: 'ignore',
      env: process.env,
      detached: true,
    });
    child.unref();
    return { mode: 'local' };
  }
  const project = env('GOOGLE_CLOUD_PROJECT');
  const region = env('REGION', 'europe-west1');
  const job = env('PUBLISH_JOB', 'publish');
  const { GoogleAuth } = await import('google-auth-library');
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const { token } = await client.getAccessToken();
  const res = await fetch(`https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Could not start publish job: ${res.status} ${await res.text()}`);
  return { mode: 'cloud', execution: (await res.json()).metadata?.name };
}
