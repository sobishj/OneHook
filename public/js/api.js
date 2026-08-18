class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.token = localStorage.getItem('onehook_jwt') || null;
    this.user = JSON.parse(localStorage.getItem('onehook_user') || 'null');
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('onehook_jwt', token);
      localStorage.setItem('onehook_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('onehook_jwt');
      localStorage.removeItem('onehook_user');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server request failed');
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  // Auth Methods
  async register(username, email) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email })
    });
  }

  async login(identifier) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
  }

  async verify(email, code) {
    const res = await this.request('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });

    if (res.token && res.user) {
      this.setSession(res.token, res.user);
    }
    return res;
  }

  async fetchMe() {
    if (!this.token) return null;
    try {
      const res = await this.request('/api/auth/me');
      if (res.user) {
        this.user = res.user;
        localStorage.setItem('onehook_user', JSON.stringify(res.user));
      }
      return res.user;
    } catch (err) {
      this.setSession(null, null);
      return null;
    }
  }

  logout() {
    this.setSession(null, null);
  }

  // Scores & Leaderboards
  async submitScore(score, durationSeconds, catches) {
    const res = await this.request('/api/score/submit', {
      method: 'POST',
      body: JSON.stringify({ score, durationSeconds, catches })
    });
    if (res && typeof res.bestScore === 'number' && this.user) {
      this.user.best_score = res.bestScore;
      localStorage.setItem('onehook_user', JSON.stringify(this.user));
    }
    return res;
  }

  async getGlobalLeaderboard() {
    return this.request('/api/leaderboard/global');
  }

  async getFriendsLeaderboard() {
    return this.request('/api/leaderboard/friends');
  }

  // Social & Friends
  async searchUsers(query) {
    return this.request(`/api/friends/search?q=${encodeURIComponent(query)}`);
  }

  async sendFriendRequest(receiverId) {
    return this.request('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ receiverId })
    });
  }

  async getPendingRequests() {
    return this.request('/api/friends/requests');
  }

  async respondFriendRequest(requestId, action) {
    return this.request('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ requestId, action })
    });
  }

  async getFriendsList() {
    return this.request('/api/friends/list');
  }

  // Challenges
  async createChallenge(opponentId) {
    return this.request('/api/challenges/create', {
      method: 'POST',
      body: JSON.stringify({ opponentId })
    });
  }

  async getChallengesList() {
    return this.request('/api/challenges/list');
  }

  async completeChallenge(challengeId, scoreAchieved) {
    return this.request('/api/challenges/complete', {
      method: 'POST',
      body: JSON.stringify({ challengeId, scoreAchieved })
    });
  }
}

window.apiClient = new ApiClient();
