import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { createTestUser, authedRequest } from './helpers.js';

async function createFamily(token) {
  const res = await SELF.fetch(authedRequest('/api/sq/family/create', {
    method: 'POST', token, body: { name: 'Test Family', displayName: 'Mummy' }
  }));
  return (await res.json()).family;
}

describe('Star Quest: invite by email', () => {
  it('creates an invite without an email (existing link-only flow still works)', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const res = await SELF.fetch(authedRequest('/api/sq/family/invite/create', { method: 'POST', token: owner.token, body: {} }));
    const data = await res.json();
    expect(data.code).toBeTruthy();
    expect(data.email).toBeNull();
  });

  it('creates an invite with an email; without BREVO_API_KEY configured in the test env, emailResult is "failed" but the link is still returned', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const res = await SELF.fetch(authedRequest('/api/sq/family/invite/create', {
      method: 'POST', token: owner.token, body: { email: 'partner@example.com' }
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe('partner@example.com');
    expect(data.url).toContain(data.code);
    // The test Miniflare env has no BREVO_API_KEY bound, so sending always
    // fails gracefully — this asserts the degrade-gracefully contract, not
    // real delivery (that's inherently untestable without a live Brevo key).
    expect(data.emailResult).toBe('failed');
  });

  it('rejects a malformed email', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const res = await SELF.fetch(authedRequest('/api/sq/family/invite/create', {
      method: 'POST', token: owner.token, body: { email: 'not-an-email' }
    }));
    expect(res.status).toBe(400);
  });

  it('the invited email does not gate acceptance — anyone with the code can still join (matches existing invite-link semantics)', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const inviteRes = await SELF.fetch(authedRequest('/api/sq/family/invite/create', {
      method: 'POST', token: owner.token, body: { email: 'partner@example.com' }
    }));
    const { code } = await inviteRes.json();

    const partner = await createTestUser('partner');
    const joinRes = await SELF.fetch(authedRequest('/api/sq/family/invite/accept', {
      method: 'POST', token: partner.token, body: { code }
    }));
    expect(joinRes.status).toBe(200);

    const meRes = await SELF.fetch(authedRequest('/api/sq/family/me', { token: partner.token }));
    expect((await meRes.json()).myRole).toBe('PARTNER');
  });
});
