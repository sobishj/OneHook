// Star Quest — page bootstrap. Auth check, family onboarding, and view
// routing live here. Parent/kid dashboard rendering is added in later
// stages (star-quest-parent.js / star-quest-kid.js are not loaded yet).

const sqApp = document.getElementById('sq-app');

function sqRender(html) {
  sqApp.innerHTML = html;
}

function sqEscape(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function renderOnboarding(prefillCode, pendingInvites) {
  const invites = pendingInvites || [];
  sqRender(`
    <div class="sq-onboard">
      <div class="sq-onboard-card">
        <h1 class="sq-onboard-title">⭐ Star Quest</h1>
        <p class="sq-onboard-sub">Cheer on your kids! Give daily stars for achievements and unlock secret rewards together.</p>

        ${invites.length > 0 ? `
        <div class="sq-onboard-section sq-invite-requests">
          <h2>📬 Requests <small class="sq-hint-inline">(${invites.length} pending)</small></h2>
          ${invites.map((inv) => `
            <div class="sq-invite-request-card" data-invite-code="${sqEscape(inv.code)}">
              <p class="sq-invite-request-text">
                <strong>${sqEscape(inv.inviter_display_name || inv.inviter_username || 'A family member')}</strong>
                invited you to join <strong>${sqEscape(inv.family_name || 'their family')}</strong>.
              </p>
              <div class="sq-invite-request-form">
                <input type="text" class="sq-invite-request-name" placeholder="Your name (e.g. Mummy, Papa)" maxlength="30" required>
                <div class="sq-invite-request-actions">
                  <button type="button" class="btn btn-secondary btn-sm sq-invite-decline-btn" data-code="${sqEscape(inv.code)}">Decline</button>
                  <button type="button" class="btn btn-primary btn-sm sq-invite-accept-btn" data-code="${sqEscape(inv.code)}">Accept</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="sq-onboard-divider">or</div>
        ` : ''}

        <div class="sq-onboard-section">
          <h2>Create your family</h2>
          <form id="sq-create-form" class="sq-form">
            <input type="text" id="sq-family-name" placeholder="Family name (e.g. The Smiths)" maxlength="50" required>
            <input type="text" id="sq-display-name" placeholder="Your name (e.g. Mummy, Papa)" maxlength="30" required>
            <button type="submit" class="btn btn-primary btn-full">Create Family</button>
          </form>
        </div>

        <div class="sq-onboard-divider">or</div>

        <div class="sq-onboard-section">
          <h2>Join with an invite code</h2>
          <form id="sq-join-form" class="sq-form">
            <input type="text" id="sq-invite-code" placeholder="Invite code" maxlength="10" value="${sqEscape(prefillCode || '')}" required>
            <input type="text" id="sq-join-display-name" placeholder="Your name (e.g. Mummy, Papa)" maxlength="30" required>
            <button type="submit" class="btn btn-secondary btn-full">Join Family</button>
          </form>
        </div>

        <p id="sq-onboard-error" class="sq-onboard-error hidden"></p>
        <a href="/" class="sq-back-link">← Back to SprintGames</a>
      </div>
    </div>
  `);

  const errorEl = document.getElementById('sq-onboard-error');
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  };

  document.getElementById('sq-create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    try {
      await window.sqApi.createFamily(
        document.getElementById('sq-family-name').value.trim(),
        document.getElementById('sq-display-name').value.trim()
      );
      await boot();
    } catch (err) {
      showError(err.message || 'Could not create family.');
    }
  });

  document.getElementById('sq-join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    try {
      await window.sqApi.acceptInvite(
        document.getElementById('sq-invite-code').value.trim(),
        document.getElementById('sq-join-display-name').value.trim()
      );
      await boot();
    } catch (err) {
      showError(err.message || 'Could not join family.');
    }
  });

  document.querySelectorAll('.sq-invite-accept-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      errorEl.classList.add('hidden');
      const card = btn.closest('.sq-invite-request-card');
      const displayName = card.querySelector('.sq-invite-request-name').value.trim();
      if (!displayName) {
        card.querySelector('.sq-invite-request-name').focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Joining…';
      try {
        await window.sqApi.acceptInvite(btn.dataset.code, displayName);
        await boot();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Accept';
        showError(err.message || 'Could not accept this invite.');
      }
    });
  });

  document.querySelectorAll('.sq-invite-decline-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      errorEl.classList.add('hidden');
      btn.disabled = true;
      try {
        await window.sqApi.declineInvite(btn.dataset.code);
        btn.closest('.sq-invite-request-card').remove();
      } catch (err) {
        btn.disabled = false;
        showError(err.message || 'Could not decline this invite.');
      }
    });
  });
}

let sqParentView = null;
let sqKidView = null;

async function renderParentDashboard(familyData) {
  if (!sqParentView) sqParentView = new StarQuestParent(sqApp);
  await sqParentView.load(familyData);
}

window.onEnterKidView = function (kids) {
  if (!sqKidView) sqKidView = new StarQuestKid(sqApp);
  sqKidView.open(kids, () => {
    // Parent PIN verified — return to the dashboard.
    boot();
  });
};

function renderSignInRequired() {
  sqRender(`
    <div class="sq-onboard">
      <div class="sq-onboard-card">
        <h1 class="sq-onboard-title">⭐ Star Quest</h1>
        <p class="sq-onboard-sub">Star Quest is a family feature — sign in to your SprintGames account first, then come back here.</p>
        <a href="/" class="btn btn-primary btn-full" style="display:block; text-align:center; text-decoration:none;">Go to Sign In</a>
      </div>
    </div>
  `);
}

async function boot() {
  const user = await window.apiClient.fetchMe();
  if (!user) {
    renderSignInRequired();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('invite');

  let familyData;
  try {
    familyData = await window.sqApi.getMyFamily();
  } catch (err) {
    const { invites } = await window.sqApi.pendingInvites().catch(() => ({ invites: [] }));
    renderOnboarding(inviteCode, invites);
    return;
  }

  if (!familyData.family) {
    const { invites } = await window.sqApi.pendingInvites().catch(() => ({ invites: [] }));
    renderOnboarding(inviteCode, invites);
    return;
  }

  await renderParentDashboard(familyData);
}

window.addEventListener('DOMContentLoaded', boot);
