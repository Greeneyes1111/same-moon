// Review status for each story in each language, kept in private storage.
// A story is public only when a person approved this exact text (hash match).
const key = (id, lang) => `status/${id}/${lang}.json`;

export async function getStatus(store, id, lang) {
  const buf = await store.get('state', key(id, lang));
  return buf ? JSON.parse(buf.toString('utf8')) : { state: 'draft' };
}

export async function setStatus(store, id, lang, status) {
  const body = { ...status, at: new Date().toISOString() };
  await store.put('state', key(id, lang), Buffer.from(JSON.stringify(body, null, 2)), {
    contentType: 'application/json',
  });
  return body;
}

export const isApproved = (status, hash) => status?.state === 'approved' && status.hash === hash;
