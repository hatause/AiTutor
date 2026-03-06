import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_PATH = path.resolve(process.cwd(), 'data', 'room-finder-cache.json');

export async function saveRoomFinderCache(payload: unknown): Promise<void> {
  try {
    const dir = path.dirname(CACHE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), payload }, null, 2), {
      encoding: 'utf8'
    });
  } catch (err) {
    // don't fail caller on cache write errors
    // eslint-disable-next-line no-console
    console.error('[room-finder-cache] failed to write cache', err);
  }
}

export async function loadRoomFinderCache(): Promise<{ updatedAt: string; payload: unknown } | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, { encoding: 'utf8' });
    return JSON.parse(raw) as { updatedAt: string; payload: unknown };
  } catch (err) {
    return null;
  }
}

export async function clearRoomFinderCache(): Promise<void> {
  try {
    await fs.unlink(CACHE_PATH);
  } catch (err) {
    // ignore
  }
}
