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

async function createGoal(token, kidId, targetStars, period = 'month') {
  const res = await SELF.fetch(authedRequest('/api/sq/goal/create', {
    method: 'POST',
    token,
    body: {
      kidId, period, targetStars,
      rewardSecret: 'Trip to the zoo!', rewardSecretEmoji: '🦁',
      rewardHint: 'Something fun outdoors', rewardHintEmoji: '🌳'
    }
  }));
  return (await res.json()).goal;
}

describe('Star Quest: reward secret never leaks before UNLOCKED', () => {
  it('goal/create never returns secret fields for a fresh ACTIVE goal', async () => {
    const parent = await createTestUser('parent');
    await createFamily(parent.token);
    const kid = await addKid(parent.token);
    const goal = await createGoal(parent.token, kid.id, 30);

    expect(goal.status).toBe('ACTIVE');
    expect(goal.reward_secret).toBeUndefined();
    expect(goal.reward_secret_emoji).toBeUndefined();
    expect(goal.reward_hint).toBe('Something fun outdoors');
  });

  it('goal/active never returns secret fields while ACTIVE', async () => {
    const parent = await createTestUser('parent');
    await createFamily(parent.token);
    const kid = await addKid(parent.token);
    await createGoal(parent.token, kid.id, 30);

    const res = await SELF.fetch(authedRequest(`/api/sq/goal/active?kidId=${kid.id}&period=month`, { token: parent.token }));
    const data = await res.json();
    expect(data.goal.status).toBe('ACTIVE');
    expect(data.goal.reward_secret).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('Trip to the zoo');
  });

  it('reveals the secret only after the goal is UNLOCKED, REVEALED, and REDEEMED in order', async () => {
    const parent = await createTestUser('parent');
    await createFamily(parent.token);
    const kid = await addKid(parent.token);
    const goal = await createGoal(parent.token, kid.id, 2);

    // 1 star: not enough, still hidden
    let res = await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: parent.token, body: { kidId: kid.id, stars: 1, reason: 'Brushed teeth', reasonIcon: 'tooth' }
    }));
    expect((await res.json()).goalUnlocked).toBe(false);

    let activeRes = await SELF.fetch(authedRequest(`/api/sq/goal/active?kidId=${kid.id}&period=month`, { token: parent.token }));
    expect((await activeRes.json()).goal.status).toBe('ACTIVE');

    // 2nd star crosses the target
    res = await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: parent.token, body: { kidId: kid.id, stars: 1, reason: 'Read a book', reasonIcon: 'book' }
    }));
    expect((await res.json()).goalUnlocked).toBe(true);

    activeRes = await SELF.fetch(authedRequest(`/api/sq/goal/active?kidId=${kid.id}&period=month`, { token: parent.token }));
    const unlocked = (await activeRes.json()).goal;
    expect(unlocked.status).toBe('UNLOCKED');
    expect(unlocked.reward_secret).toBe('Trip to the zoo!');

    // Can't redeem before reveal
    const redeemTooEarly = await SELF.fetch(authedRequest('/api/sq/goal/redeem', {
      method: 'POST', token: parent.token, body: { goalId: goal.id }
    }));
    expect(redeemTooEarly.status).toBe(400);

    const revealRes = await SELF.fetch(authedRequest('/api/sq/goal/reveal', {
      method: 'POST', token: parent.token, body: { goalId: goal.id }
    }));
    expect((await revealRes.json()).goal.status).toBe('REVEALED');

    const redeemRes = await SELF.fetch(authedRequest('/api/sq/goal/redeem', {
      method: 'POST', token: parent.token, body: { goalId: goal.id }
    }));
    expect((await redeemRes.json()).goal.status).toBe('REDEEMED');

    const historyRes = await SELF.fetch(authedRequest(`/api/sq/goal/history?kidId=${kid.id}`, { token: parent.token }));
    const history = (await historyRes.json()).goals;
    expect(history.length).toBe(1);
    expect(history[0].reward_secret).toBe('Trip to the zoo!');
  });

  it('the unlock flip happens exactly once, on the exact crossing call, never early or twice', async () => {
    const parent = await createTestUser('parent');
    await createFamily(parent.token);
    const kid = await addKid(parent.token);
    await createGoal(parent.token, kid.id, 5);

    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = await SELF.fetch(authedRequest('/api/sq/star/give', {
        method: 'POST', token: parent.token, body: { kidId: kid.id, stars: 2, reason: 'x', reasonIcon: 'star' }
      }));
      results.push((await res.json()).goalUnlocked);
    }
    // stars given: 2, 4, 6 (cumulative) -> target 5 crossed exactly on the 3rd call
    expect(results).toEqual([false, false, true]);
  });
});

describe('Star Quest: family membership enforced on star/goal routes', () => {
  it('an outsider cannot give stars, view goals, or see history for another family\'s kid', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    await createGoal(owner.token, kid.id, 30);

    const outsider = await createTestUser('outsider');

    const giveRes = await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: outsider.token, body: { kidId: kid.id, stars: 3, reason: 'x', reasonIcon: 'star' }
    }));
    expect(giveRes.status).toBe(404);

    const goalRes = await SELF.fetch(authedRequest(`/api/sq/goal/active?kidId=${kid.id}&period=month`, { token: outsider.token }));
    expect(goalRes.status).toBe(403);

    const historyRes = await SELF.fetch(authedRequest(`/api/sq/star/history?kidId=${kid.id}`, { token: outsider.token }));
    expect(historyRes.status).toBe(403);

    // Confirm nothing was actually recorded
    const realHistory = await SELF.fetch(authedRequest(`/api/sq/star/history?kidId=${kid.id}`, { token: owner.token }));
    expect((await realHistory.json()).entries.length).toBe(0);
  });

  it('rejects a second active goal for the same kid and period', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    await createGoal(owner.token, kid.id, 30, 'month');

    const res = await SELF.fetch(authedRequest('/api/sq/goal/create', {
      method: 'POST', token: owner.token, body: { kidId: kid.id, period: 'month', targetStars: 10, rewardSecret: 'Movie night' }
    }));
    expect(res.status).toBe(400);
  });

  it('allows concurrent week/month/year goals for the same kid, tracked independently', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);

    const week = await createGoal(owner.token, kid.id, 5, 'week');
    const month = await createGoal(owner.token, kid.id, 20, 'month');
    const year = await createGoal(owner.token, kid.id, 200, 'year');
    expect([week.status, month.status, year.status]).toEqual(['ACTIVE', 'ACTIVE', 'ACTIVE']);

    // 5 stars: crosses the week goal only
    const res = await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: owner.token, body: { kidId: kid.id, stars: 3, reason: 'x', reasonIcon: 'star' }
    }));
    const giveData = await res.json();
    expect(giveData.goalUnlocked).toBe(false);

    const res2 = await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: owner.token, body: { kidId: kid.id, stars: 2, reason: 'x', reasonIcon: 'star' }
    }));
    const giveData2 = await res2.json();
    expect(giveData2.goalUnlocked).toBe(true);
    expect(giveData2.unlockedPeriods).toEqual(['week']);

    const listRes = await SELF.fetch(authedRequest(`/api/sq/goal/list?kidId=${kid.id}`, { token: owner.token }));
    const { goals } = await listRes.json();
    expect(goals.week.status).toBe('UNLOCKED');
    expect(goals.month.status).toBe('ACTIVE');
    expect(goals.month.progress).toBe(5);
    expect(goals.year.status).toBe('ACTIVE');
    expect(goals.year.progress).toBe(5);
  });
});

describe('Star Quest: goals already met unlock without a new star', () => {
  async function giveStars(token, kidId, total) {
    for (let left = total; left > 0; left -= 3) {
      await SELF.fetch(authedRequest('/api/sq/star/give', {
        method: 'POST', token, body: { kidId, stars: Math.min(3, left), reason: 'x', reasonIcon: 'star' }
      }));
    }
  }

  it('a goal created after the kid already has enough stars is UNLOCKED immediately', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    await giveStars(owner.token, kid.id, 6);

    const goal = await createGoal(owner.token, kid.id, 5, 'week');
    expect(goal.status).toBe('UNLOCKED');
    expect(goal.reward_secret).toBe('Trip to the zoo!');
  });

  it('lowering an active target below current progress unlocks it (70 -> 30 with 35 stars)', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    const goal = await createGoal(owner.token, kid.id, 70, 'week');
    await giveStars(owner.token, kid.id, 35);

    const res = await SELF.fetch(authedRequest('/api/sq/goal/update', {
      method: 'POST', token: owner.token, body: { goalId: goal.id, targetStars: 30 }
    }));
    const updated = (await res.json()).goal;
    expect(updated.status).toBe('UNLOCKED');
    expect(updated.progress).toBe(35);
  });

  it('goal/history returns unlocked-but-unscratched goals as pending, then moves them to goals once revealed', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);
    const goal = await createGoal(owner.token, kid.id, 10, 'month');
    await giveStars(owner.token, kid.id, 9);
    // Stale ACTIVE goal that's already met — simulates rows written before this fix.
    await SELF.fetch(authedRequest('/api/sq/goal/update', {
      method: 'POST', token: owner.token, body: { goalId: goal.id, targetStars: 12 }
    }));

    let hist = await (await SELF.fetch(authedRequest(`/api/sq/goal/history?kidId=${kid.id}`, { token: owner.token }))).json();
    expect(hist.pending.length).toBe(0);

    await SELF.fetch(authedRequest('/api/sq/goal/update', {
      method: 'POST', token: owner.token, body: { goalId: goal.id, targetStars: 9 }
    }));
    hist = await (await SELF.fetch(authedRequest(`/api/sq/goal/history?kidId=${kid.id}`, { token: owner.token }))).json();
    expect(hist.pending.map((g) => g.id)).toEqual([goal.id]);
    expect(hist.goals.length).toBe(0);

    await SELF.fetch(authedRequest('/api/sq/goal/reveal', { method: 'POST', token: owner.token, body: { goalId: goal.id } }));
    hist = await (await SELF.fetch(authedRequest(`/api/sq/goal/history?kidId=${kid.id}`, { token: owner.token }))).json();
    expect(hist.pending.length).toBe(0);
    expect(hist.goals.map((g) => g.id)).toEqual([goal.id]);
  });
});

describe('Star Quest: star undo', () => {
  it('soft-deletes a star entry and it drops out of history', async () => {
    const owner = await createTestUser('owner');
    await createFamily(owner.token);
    const kid = await addKid(owner.token);

    const giveRes = await SELF.fetch(authedRequest('/api/sq/star/give', {
      method: 'POST', token: owner.token, body: { kidId: kid.id, stars: 2, reason: 'x', reasonIcon: 'star' }
    }));
    const { entryId } = await giveRes.json();

    const undoRes = await SELF.fetch(authedRequest('/api/sq/star/undo', {
      method: 'POST', token: owner.token, body: { starEntryId: entryId }
    }));
    expect(undoRes.status).toBe(200);

    const historyRes = await SELF.fetch(authedRequest(`/api/sq/star/history?kidId=${kid.id}`, { token: owner.token }));
    expect((await historyRes.json()).entries.length).toBe(0);
  });
});
