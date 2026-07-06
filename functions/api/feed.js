import { json, kvWorld, withAuth } from './_utils.js';

// GET /api/feed?no=latest|N → { index, edition, agencies }
export const onRequestGet = withAuth(async ({ request, env }) => {
  const world = kvWorld(env);
  const url = new URL(request.url);
  const index = await world.get('editions/index.json', []);
  const agencies = await world.get('state/agencies.json', []);
  const noParam = url.searchParams.get('no') || 'latest';
  const no = noParam === 'latest' ? index.at(-1)?.no : Number(noParam);
  const edition = no ? await world.get(`editions/${no}.json`) : null;
  return json({ index, edition, agencies });
});
