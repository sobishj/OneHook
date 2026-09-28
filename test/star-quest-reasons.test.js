import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { createTestUser, authedRequest } from './helpers.js';

async function createFamily(token) {
  const res = await SELF.fetch(authedRequest('/api/sq/family/create', {
    method: 'POST', token, body: { name: 'Test Family', displayName: 'Mummy' }
  }));
  return (await res.json()).family;
}

describe('Star Quest: reason presets', () => {
  it('seeds the 8 default reasons on first read', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);

    const res = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    const { reasons } = await res.json();
    expect(reasons.length).toBe(8);
    expect(reasons.map((r) => r.label)).toContain('Brushed teeth');

    // Second read returns the same seeded rows, not double-seeded
    const res2 = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    expect((await res2.json()).reasons.length).toBe(8);
  });

  it('creates a custom reason and it appears in the list', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));

    const createRes = await SELF.fetch(authedRequest('/api/sq/reasons/create', {
      method: 'POST', token: owner.token, body: { icon: '🎨', label: 'Drew a picture' }
    }));
    expect(createRes.status).toBe(200);
    const { reason } = await createRes.json();
    expect(reason.label).toBe('Drew a picture');

    const listRes = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    const { reasons } = await listRes.json();
    expect(reasons.length).toBe(9);
    expect(reasons.some((r) => r.id === reason.id)).toBe(true);
  });

  it('deletes a preset — a default and a custom one delete the same way', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const seedRes = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    const { reasons } = await seedRes.json();
    const toDelete = reasons[0];

    const delRes = await SELF.fetch(authedRequest('/api/sq/reasons/delete', {
      method: 'POST', token: owner.token, body: { reasonId: toDelete.id }
    }));
    expect(delRes.status).toBe(200);

    const listRes = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    const { reasons: after } = await listRes.json();
    expect(after.length).toBe(7);
    expect(after.some((r) => r.id === toDelete.id)).toBe(false);
  });

  it('rejects a reason with no label', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const res = await SELF.fetch(authedRequest('/api/sq/reasons/create', {
      method: 'POST', token: owner.token, body: { icon: '⭐', label: '  ' }
    }));
    expect(res.status).toBe(400);
  });

  it('a user outside the family cannot list, create, or delete reasons', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const seedRes = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    const { reasons } = await seedRes.json();

    const outsider = await createTestUser('outsider');
    const listRes = await SELF.fetch(authedRequest('/api/sq/reasons', { token: outsider.token }));
    expect(listRes.status).toBe(404);

    const createRes = await SELF.fetch(authedRequest('/api/sq/reasons/create', {
      method: 'POST', token: outsider.token, body: { icon: '⭐', label: 'Hijacked' }
    }));
    expect(createRes.status).toBe(404);

    const deleteRes = await SELF.fetch(authedRequest('/api/sq/reasons/delete', {
      method: 'POST', token: outsider.token, body: { reasonId: reasons[0].id }
    }));
    expect(deleteRes.status).toBe(404);

    // Confirm nothing changed for the real family
    const finalRes = await SELF.fetch(authedRequest('/api/sq/reasons', { token: owner.token }));
    expect((await finalRes.json()).reasons.length).toBe(8);
  });
});
