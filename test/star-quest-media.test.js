import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { createTestUser, authedRequest } from './helpers.js';

async function createFamily(token) {
  const res = await SELF.fetch(authedRequest('/api/sq/family/create', {
    method: 'POST', token, body: { name: 'Test Family', displayName: 'Mummy' }
  }));
  return (await res.json()).family;
}

async function addKid(token, name = 'Kiddo') {
  const res = await SELF.fetch(authedRequest('/api/sq/kid/create', {
    method: 'POST', token, body: { name, avatar: 'fox', color: '#f59e0b' }
  }));
  return (await res.json()).kid;
}

async function createGoal(token, kidId, targetStars) {
  const res = await SELF.fetch(authedRequest('/api/sq/goal/create', {
    method: 'POST', token, body: { kidId, period: 'month', targetStars, rewardSecret: 'Trip to the zoo!' }
  }));
  return (await res.json()).goal;
}

describe('Star Quest: upload/status reports R2 availability', () => {
  it('reports available:true since the test Miniflare env declares SQ_MEDIA', async () => {
    const user = await createTestUser('user');
    const res = await SELF.fetch(authedRequest('/api/sq/upload/status', { token: user.token }));
    expect((await res.json()).available).toBe(true);
  });
});

describe('Star Quest: reward photo upload + serve', () => {
  it('uploads a photo, and it is served only once the goal is past ACTIVE', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    const goal = await createGoal(owner.token, kid.id, 2);

    const imgBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]); // fake PNG-ish bytes
    const uploadRes = await SELF.fetch(new Request(`https://example.com/api/sq/upload/reward-photo?goalId=${goal.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/png' },
      body: imgBytes
    }));
    const uploadData = await uploadRes.json();
    expect(uploadData.uploaded).toBe(true);
    expect(uploadData.key).toContain(goal.id);

    // Goal is still ACTIVE -> media route must refuse to serve it
    const mediaWhileActive = await SELF.fetch(authedRequest(`/api/sq/media?key=${encodeURIComponent(uploadData.key)}`, { token: owner.token }));
    expect(mediaWhileActive.status).toBe(403);

    // Push stars to unlock
    await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: owner.token, body: { kidId: kid.id, stars: 2, reason: 'x', reasonIcon: 'star' }
    }));

    const mediaAfterUnlock = await SELF.fetch(authedRequest(`/api/sq/media?key=${encodeURIComponent(uploadData.key)}`, { token: owner.token }));
    expect(mediaAfterUnlock.status).toBe(200);
    const bytes = new Uint8Array(await mediaAfterUnlock.arrayBuffer());
    expect(bytes.length).toBe(imgBytes.length);
  });

  it('a non-family member cannot fetch the photo even after unlock', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    const goal = await createGoal(owner.token, kid.id, 1);

    const uploadRes = await SELF.fetch(new Request(`https://example.com/api/sq/upload/reward-photo?goalId=${goal.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/png' },
      body: new Uint8Array([1, 2, 3])
    }));
    const { key } = await uploadRes.json();

    await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: owner.token, body: { kidId: kid.id, stars: 1, reason: 'x', reasonIcon: 'star' }
    }));

    const outsider = await createTestUser('outsider');
    const res = await SELF.fetch(authedRequest(`/api/sq/media?key=${encodeURIComponent(key)}`, { token: outsider.token }));
    expect(res.status).toBe(403);
  });

  it('rejects an unsupported image type and an oversized image', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    const goal = await createGoal(owner.token, kid.id, 10);

    const badType = await SELF.fetch(new Request(`https://example.com/api/sq/upload/reward-photo?goalId=${goal.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/gif' },
      body: new Uint8Array([1, 2, 3])
    }));
    expect(badType.status).toBe(400);

    const oversized = new Uint8Array(2 * 1024 * 1024 + 1);
    const tooBig = await SELF.fetch(new Request(`https://example.com/api/sq/upload/reward-photo?goalId=${goal.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/png' },
      body: oversized
    }));
    expect(tooBig.status).toBe(400);
  });
});

// Note: a test simulating env.SQ_MEDIA being entirely absent (the real
// production state until R2 is enabled on the account) was tried here, but
// Miniflare's per-request env bindings can't be mutated/deleted from test
// code — each request gets its own snapshot from the declared pool config.
// The guard itself (`if (!env.SQ_MEDIA) return jsonResponse({ uploaded:
// false, ... }, 200)`) is a trivial, low-risk one-liner at the top of every
// upload/media route; it's exercised for real whenever this deploys without
// the SQ_MEDIA binding declared in wrangler.toml (the actual current state).
