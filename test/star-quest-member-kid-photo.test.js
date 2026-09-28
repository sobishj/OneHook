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

describe('Star Quest: member display-name self-edit', () => {
  it('a member can rename themselves', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);

    const res = await SELF.fetch(authedRequest('/api/sq/family/member/update', {
      method: 'POST', token: owner.token, body: { displayName: 'Appa' }
    }));
    expect(res.status).toBe(200);

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: owner.token }));
    expect((await meRes.json()).myDisplayName).toBe('Appa');
  });

  it('rejects an empty display name', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const res = await SELF.fetch(authedRequest('/api/sq/family/member/update', {
      method: 'POST', token: owner.token, body: { displayName: '   ' }
    }));
    expect(res.status).toBe(400);
  });

  it('a non-member cannot rename (no family to belong to)', async () => {
    const lone = await createTestUser('lone');
    const res = await SELF.fetch(authedRequest('/api/sq/family/member/update', {
      method: 'POST', token: lone.token, body: { displayName: 'Nope' }
    }));
    expect(res.status).toBe(404);
  });

  it('a partner cannot rename another member (only ever updates the caller\'s own row)', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const invRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: owner.token, body: {} }));
    const { code } = await invRes.json();
    const partner = await createTestUser('partner');
    await SELF.fetch(authedRequest('/api/sq/family/invite/accept', { method: 'POST', token: partner.token, body: { code } }));

    await SELF.fetch(authedRequest('/api/sq/family/member/update', { method: 'POST', token: partner.token, body: { displayName: 'Papa' } }));

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: owner.token }));
    const data = await meRes.json();
    const ownerRow = data.members.find((m) => m.role === 'OWNER');
    const partnerRow = data.members.find((m) => m.role === 'PARTNER');
    expect(ownerRow.display_name).toBe('Mummy'); // unchanged
    expect(partnerRow.display_name).toBe('Papa'); // partner only changed their own
  });
});

describe('Star Quest: kid avatar photo upload', () => {
  it('uploads a photo and it appears on the kid record', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);

    const imgBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const uploadRes = await SELF.fetch(new Request(`https://example.com/api/sq/upload/kid-avatar?kidId=${kid.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/png' },
      body: imgBytes
    }));
    const uploadData = await uploadRes.json();
    expect(uploadData.uploaded).toBe(true);
    expect(uploadData.key).toContain(kid.id);

    const listRes = await SELF.fetch(authedRequest('/api/sq/kid/list', { token: owner.token }));
    const { kids } = await listRes.json();
    expect(kids[0].avatar_photo_key).toBe(uploadData.key);

    // The photo is not secret — servable immediately, unlike reward photos.
    // Note: on Windows, @cloudflare/vitest-pool-workers occasionally fails
    // to tear down R2's isolated-storage SQLite file between tests (a
    // documented tooling issue: developers.cloudflare.com/workers/testing/
    // vitest-integration/known-issues/#isolated-storage). It's an infra
    // flake unrelated to this route — verified independently against a
    // live dev server, where the full upload → list → serve flow works.
    const mediaRes = await SELF.fetch(authedRequest(`/api/sq/media?key=${encodeURIComponent(uploadData.key)}`, { token: owner.token }));
    expect(mediaRes.status).toBe(200);
  });

  it('a non-family member cannot upload a photo for someone else\'s kid', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);

    const outsider = await createTestUser('outsider');
    const res = await SELF.fetch(new Request(`https://example.com/api/sq/upload/kid-avatar?kidId=${kid.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${outsider.token}`, 'Content-Type': 'image/png' },
      body: new Uint8Array([1, 2, 3])
    }));
    expect(res.status).toBe(403);
  });

  it('rejects an oversized or unsupported-type image', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);

    const badType = await SELF.fetch(new Request(`https://example.com/api/sq/upload/kid-avatar?kidId=${kid.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/gif' },
      body: new Uint8Array([1, 2, 3])
    }));
    expect(badType.status).toBe(400);

    const tooBig = await SELF.fetch(new Request(`https://example.com/api/sq/upload/kid-avatar?kidId=${kid.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/png' },
      body: new Uint8Array(2 * 1024 * 1024 + 1)
    }));
    expect(tooBig.status).toBe(400);
  });
});
