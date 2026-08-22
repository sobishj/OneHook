class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.token = localStorage.getItem('sprintgames_jwt') || null;
    this.user = JSON.parse(localStorage.getItem('sprintgames_user') || 'null');
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('sprintgames_jwt', token);
      localStorage.setItem('sprintgames_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sprintgames_jwt');
      localStorage.removeItem('sprintgames_user');
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
        const error = new Error(data.error || 'Server request failed');
        error.status = response.status;
        throw error;
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
        localStorage.setItem('sprintgames_user', JSON.stringify(res.user));
      }
      return res.user;
    } catch (err) {
      if (err.status === 401 || err.status === 403 || err.status === 404) {
        this.setSession(null, null);
      }
      return null;
    }
  }

  logout() {
    this.setSession(null, null);
  }

  // Profile Management Methods
  async updateUsername(username) {
    const res = await this.request('/api/user/update-username', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
    if (res.token && res.user) {
      this.setSession(res.token, res.user);
    }
    return res;
  }

  async requestEmailChange(newEmail) {
    return this.request('/api/user/request-email-change', {
      method: 'POST',
      body: JSON.stringify({ newEmail })
    });
  }

  async verifyEmailChange(newEmail, code) {
    const res = await this.request('/api/user/verify-email-change', {
      method: 'POST',
      body: JSON.stringify({ newEmail, code })
    });
    if (res.token && res.user) {
      this.setSession(res.token, res.user);
    }
    return res;
  }

  // Scores & Leaderboards
  async submitScore(score, durationSeconds, catches) {
    const res = await this.request('/api/score/submit', {
      method: 'POST',
      body: JSON.stringify({ score, durationSeconds, catches })
    });
    if (res && typeof res.bestScore === 'number' && this.user) {
      this.user.best_score = res.bestScore;
      localStorage.setItem('sprintgames_user', JSON.stringify(this.user));
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
  async createChallenge(opponentId, score = null) {
    return this.request('/api/challenges/create', {
      method: 'POST',
      body: JSON.stringify({ opponentId, score })
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

  async withdrawChallenge(challengeId) {
    return this.request('/api/challenges/withdraw', {
      method: 'POST',
      body: JSON.stringify({ challengeId })
    });
  }
}

window.apiClient = new ApiClient();
