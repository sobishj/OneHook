// Star Quest — thin wrapper over window.apiClient for /api/sq/* routes.
// Reuses the same token/session handling as the rest of the site; no new
// auth code here.
class StarQuestApi {
  request(path, options) {
    return window.apiClient.request(`/api/sq${path}`, options);
  }

  // Family
  createFamily(name, displayName) {
    return this.request('/family/create', { method: 'POST', body: JSON.stringify({ name, displayName }) });
  }
  getMyFamily() {
    return this.request('/family/me');
  }
  deleteFamily() {
    return this.request('/family/delete', { method: 'POST' });
  }
  createInvite(email) {
    return this.request('/family/invite/create', { method: 'POST', body: JSON.stringify({ email: email || null }) });
  }
  acceptInvite(code, displayName) {
    return this.request('/family/invite/accept', { method: 'POST', body: JSON.stringify({ code, displayName }) });
  }
  pendingInvites() {
    return this.request('/family/invite/pending');
  }
  declineInvite(code) {
    return this.request('/family/invite/decline', { method: 'POST', body: JSON.stringify({ code }) });
  }
  removePartner(userId) {
    return this.request('/family/partner/remove', { method: 'POST', body: JSON.stringify({ userId }) });
  }
  updateMyDisplayName(displayName) {
    return this.request('/family/member/update', { method: 'POST', body: JSON.stringify({ displayName }) });
  }

  // Kids
  listKids() {
    return this.request('/kid/list');
  }
  createKid(kid) {
    return this.request('/kid/create', { method: 'POST', body: JSON.stringify(kid) });
  }
  updateKid(kidId, updates) {
    return this.request('/kid/update', { method: 'PATCH', body: JSON.stringify({ kidId, ...updates }) });
  }
  deleteKid(kidId) {
    return this.request('/kid/delete', { method: 'POST', body: JSON.stringify({ kidId }) });
  }

  // Reason presets
  listReasons() {
    return this.request('/reasons');
  }
  createReason(icon, label) {
    return this.request('/reasons/create', { method: 'POST', body: JSON.stringify({ icon, label }) });
  }
  deleteReason(reasonId) {
    return this.request('/reasons/delete', { method: 'POST', body: JSON.stringify({ reasonId }) });
  }

  // Stars
  giveStar(kidId, stars, reason, reasonIcon, praiseText, reasonIconPhotoKey) {
    return this.request('/star/give', { method: 'POST', body: JSON.stringify({ kidId, stars, reason, reasonIcon, reasonIconPhotoKey: reasonIconPhotoKey || null, praiseText }) });
  }
  undoStar(starEntryId) {
    return this.request('/star/undo', { method: 'POST', body: JSON.stringify({ starEntryId }) });
  }
  collectStar(starEntryId) {
    return this.request('/star/collect', { method: 'POST', body: JSON.stringify({ starEntryId }) });
  }
  starHistory(kidId) {
    return this.request(`/star/history?kidId=${encodeURIComponent(kidId)}`);
  }

  // Goals — a kid can have up to three concurrent goals, one per period
  // ('week' | 'month' | 'year'), each tracked and redeemed independently.
  createGoal(goal) {
    return this.request('/goal/create', { method: 'POST', body: JSON.stringify(goal) });
  }
  updateGoal(goalId, updates) {
    return this.request('/goal/update', { method: 'POST', body: JSON.stringify({ goalId, ...updates }) });
  }
  activeGoal(kidId, period) {
    return this.request(`/goal/active?kidId=${encodeURIComponent(kidId)}&period=${encodeURIComponent(period)}`);
  }
  // All three period slots in one call — { goals: { week, month, year } }.
  listGoals(kidId) {
    return this.request(`/goal/list?kidId=${encodeURIComponent(kidId)}`);
  }
  goalHistory(kidId) {
    return this.request(`/goal/history?kidId=${encodeURIComponent(kidId)}`);
  }
  revealGoal(goalId) {
    return this.request('/goal/reveal', { method: 'POST', body: JSON.stringify({ goalId }) });
  }
  redeemGoal(goalId) {
    return this.request('/goal/redeem', { method: 'POST', body: JSON.stringify({ goalId }) });
  }

  // Uploads
  uploadStatus() {
    return this.request('/upload/status');
  }
  async uploadKidAvatarPhoto(kidId, file) {
    // Raw binary body, not JSON — bypasses request() which always sets
    // Content-Type: application/json.
    const res = await fetch(`/api/sq/upload/kid-avatar?kidId=${encodeURIComponent(kidId)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${window.apiClient.token}` },
      body: file
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Upload failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }
  async uploadReasonIconPhoto(reasonId, file) {
    const res = await fetch(`/api/sq/upload/reason-icon?reasonId=${encodeURIComponent(reasonId)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${window.apiClient.token}` },
      body: file
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Upload failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }
  mediaUrl(key) {
    return `/api/sq/media?key=${encodeURIComponent(key)}`;
  }
}

window.sqApi = new StarQuestApi();
