import { isAuthed, json } from './_utils.js';

export async function onRequestGet({ request, env }) {
  return json({ authed: await isAuthed(request, env.SESSION_SECRET) });
}
