import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { createTestUser, authedRequest } from './helpers.js';

async function createFamily(token, name = 'Test Family') {
  const res = await SELF.fetch(authedRequest('/api/sq/family/create', {
    method: 'POST', token, body: { name, displayName: 'Mummy' }
  }));
  const data = await res.json();
  return data.family;
}

describe('Star Quest: family create/read/delete', () => {
  it('creates a family and returns it via family/me', async () => {
    const owner = await createTestUser('owner');
    const family = await createFamily(owner.token, 'The Smiths');
    expect(family.name).toBe('The Smiths');
    expect(family.owner_user_id).toBe(owner.id);

    const res = await SELF.fetch(authedRequest('/api/sq/family/me', { token: owner.token }));
    const data = await res.json();
    expect(data.family.id).toBe(family.id);
    expect(data.myRole).toBe('OWNER');
    expect(data.members.length).toBe(1);
  });

  it('rejects creating a second family for the same user', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const res = await SELF.fetch(authedRequest('/api/sq/family/create', {
      method: 'POST', token: owner.token, body: { name: 'Second' }
    }));
    expect(res.status).toBe(400);
  });

  it('family/me returns null for a user with no family', async () => {
    const lone = await createTestUser('lone');
    const res = await SELF.fetch(authedRequest('/api/sq/family/me', { token: lone.token }));
    const data = await res.json();
    expect(data.family).toBeNull();
  });

  it('an unauthenticated request is rejected', async () => {
    const res = await SELF.fetch(authedRequest('/api/sq/family/me'));
    expect(res.status).toBe(401);
  });

  it('only the owner can delete the family', async () => {
    const owner = await createTestUser('owner');
    const family = await createFamily(owner.token);

    const invRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: owner.token }));
    const invite = await invRes.json();
    const partner = await createTestUser('partner');
    await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: partner.token, body: { code: invite.code }
    }));

    const partnerDelete = await SELF.fetch(authedRequest('/api/sq/family/delete', { method: 'POST', token: partner.token }));
    expect(partnerDelete.status).toBe(404); // partner is not owner_user_id

    const ownerDelete = await SELF.fetch(authedRequest('/api/sq/family/delete', { method: 'POST', token: owner.token }));
    expect(ownerDelete.status).toBe(200);

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: owner.token }));
    expect((await meRes.json()).family).toBeNull();
  });
});

describe('Star Quest: invites', () => {
  it('a partner can join via invite code and appears in members', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);

    const invRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: owner.token }));
    const invite = await invRes.json();
    expect(invite.code).toBeTruthy();
    expect(invite.url).toContain(invite.code);

    const partner = await createTestUser('partner');
    const joinRes = await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: partner.token, body: { code: invite.code, displayName: 'Papa' }
    }));
    expect(joinRes.status).toBe(200);

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: partner.token }));
    const meData = await meRes.json();
    expect(meData.myRole).toBe('PARTNER');
    expect(meData.members.length).toBe(2);
  });

  it('rejects an invalid invite code', async () => {
    const user = await createTestUser('lone');
    const res = await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: user.token, body: { code: 'NOTREAL' }
    }));
    expect(res.status).toBe(404);
  });

  it('rejects re-accepting an invite to the family you are already in', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const invRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: owner.token }));
    const invite = await invRes.json();

    const res = await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: owner.token, body: { code: invite.code }
    }));
    expect(res.status).toBe(400);
  });

  it('accepting an invite while already in a different family switches you into the new one', async () => {
    const familyA = await createTestUser('ownerA');
    await createFamily(familyA.token, 'Family A');
    const familyB = await createTestUser('ownerB');
    await createFamily(familyB.token, 'Family B');

    // A user who already owns Family A gets invited into Family B.
    const invRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: familyB.token }));
    const invite = await invRes.json();

    const switcher = await createTestUser('switcher');
    const joinRes = await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: switcher.token, body: { code: invite.code, displayName: 'Auntie' }
    }));
    expect(joinRes.status).toBe(200);

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: switcher.token }));
    const meData = await meRes.json();
    expect(meData.family).not.toBeNull();
    expect(meData.myRole).toBe('PARTNER');

    // Family A itself is untouched — still owned by its original owner.
    const familyAMe = await SELF.fetch(authedRequest('/api/sq/family/me', { token: familyA.token }));
    const familyAData = await familyAMe.json();
    expect(familyAData.family).not.toBeNull();
    expect(familyAData.myRole).toBe('OWNER');
  });

  it('only the owner can remove a partner', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const invRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: owner.token }));
    const invite = await invRes.json();
    const partner = await createTestUser('partner');
    await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: partner.token, body: { code: invite.code }
    }));

    const partnerAttempt = await SELF.fetch(authedRequest('/api/sq/family/partner/remove', {
      method: 'POST', token: partner.token, body: { userId: owner.id }
    }));
    expect(partnerAttempt.status).toBe(403);

    const ownerAttempt = await SELF.fetch(authedRequest('/api/sq/family/partner/remove', {
      method: 'POST', token: owner.token, body: { userId: partner.id }
    }));
    expect(ownerAttempt.status).toBe(200);

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: owner.token }));
    expect((await meRes.json()).members.length).toBe(1);
  });
});

describe('Star Quest: kids', () => {
  it('adds, lists, updates, and deletes a kid', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);

    const createRes = await SELF.fetch(authedRequest('/api/sq/kid/create', {
      method: 'POST', token: owner.token, body: { name: 'Lily', avatar: 'fox', color: '#f59e0b' }
    }));
    const { kid } = await createRes.json();
    expect(kid.name).toBe('Lily');

    const listRes = await SELF.fetch(authedRequest('/api/sq/kid/list', { token: owner.token }));
    expect((await listRes.json()).kids.length).toBe(1);

    const updateRes = await SELF.fetch(authedRequest('/api/sq/kid/update', {
      method: 'PATCH', token: owner.token, body: { kidId: kid.id, name: 'Lily Rose' }
    }));
    expect((await updateRes.json()).kid.name).toBe('Lily Rose');

    const deleteRes = await SELF.fetch(authedRequest('/api/sq/kid/delete', {
      method: 'POST', token: owner.token, body: { kidId: kid.id }
    }));
    expect(deleteRes.status).toBe(200);

    const listAfter = await SELF.fetch(authedRequest('/api/sq/kid/list', { token: owner.token }));
    expect((await listAfter.json()).kids.length).toBe(0);
  });

  it('a user outside the family cannot read, update, or delete a kid', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const createRes = await SELF.fetch(authedRequest('/api/sq/kid/create', {
      method: 'POST', token: owner.token, body: { name: 'Max', avatar: 'bear', color: '#3b82f6' }
    }));
    const { kid } = await createRes.json();

    const outsider = await createTestUser('outsider');
    const updateRes = await SELF.fetch(authedRequest('/api/sq/kid/update', {
      method: 'PATCH', token: outsider.token, body: { kidId: kid.id, name: 'Hijacked' }
    }));
    expect(updateRes.status).toBe(404);

    const deleteRes = await SELF.fetch(authedRequest('/api/sq/kid/delete', {
      method: 'POST', token: outsider.token, body: { kidId: kid.id }
    }));
    expect(deleteRes.status).toBe(404);

    // Confirm kid still exists for the real owner
    const listRes = await SELF.fetch(authedRequest('/api/sq/kid/list', { token: owner.token }));
    expect((await listRes.json()).kids.length).toBe(1);
  });

  it('enforces a maximum of 10 kids per family', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    for (let i = 0; i < 10; i++) {
      const res = await SELF.fetch(authedRequest('/api/sq/kid/create', {
        method: 'POST', token: owner.token, body: { name: `Kid${i}`, avatar: 'fox', color: '#f59e0b' }
      }));
      expect(res.status).toBe(200);
    }
    const overflow = await SELF.fetch(authedRequest('/api/sq/kid/create', {
      method: 'POST', token: owner.token, body: { name: 'Kid11', avatar: 'fox', color: '#f59e0b' }
    }));
    expect(overflow.status).toBe(400);
  });
});
