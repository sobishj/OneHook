import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('test harness smoke check', () => {
  it('GET /api/leaderboard/global works against the migrated D1 schema', async () => {
    const res = await SELF.fetch('https://example.com/api/leaderboard/global');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.leaderboard)).toBe(true);
  });
});
