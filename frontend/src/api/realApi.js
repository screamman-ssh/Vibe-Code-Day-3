import { calculateScore, toPublicScore } from '../services/scoreEngine.js'

const BASE_URL = '' // relative URL proxied by Vite, or you can specify 'http://localhost:8080'

function getHeaders() {
  const token = localStorage.getItem('accessToken')
  const headers = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function request(path, options = {}) {
  options.headers = {
    ...getHeaders(),
    ...options.headers,
  }

  // Handle multipart form data headers override (fetch sets boundary automatically when Content-Type is omitted)
  if (options.body instanceof FormData) {
    delete options.headers['Content-Type']
  }

  let resp = await fetch(`/api/v1${path}`, options)

  // Token refresh logic on 401
  if (resp.status === 401 && !options._isRetry) {
    const rfToken = localStorage.getItem('refreshToken')
    if (rfToken) {
      try {
        const refreshResp = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rfToken }),
        })
        if (refreshResp.ok) {
          const data = await refreshResp.json()
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          localStorage.setItem('user', JSON.stringify(data.user))

          // Retry request
          options._isRetry = true
          options.headers = {
            ...getHeaders(),
            ...options.headers,
          }
          if (options.headers['Authorization']) {
            options.headers['Authorization'] = `Bearer ${data.accessToken}`
          }
          resp = await fetch(`/api/v1${path}`, options)
        } else {
          // Refresh token invalid, logout
          logoutSession()
        }
      } catch (err) {
        logoutSession()
      }
    }
  }

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    const err = new Error(errData.error || `HTTP error ${resp.status}`)
    err.status = resp.status
    err.code = errData.code
    throw err
  }

  return resp.json().catch(() => ({}))
}

function logoutSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  // We can force reload to trigger Vue Router guards to redirect to /login
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

export const realApi = {
  async loginAsPersona(persona) {
    const res = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: `mock_token_${persona}` }),
    })
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('refreshToken', res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res.user
  },

  async loginAsGuest(displayName) {
    const res = await request('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    })
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('refreshToken', res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res.user
  },

  async logout() {
    const rfToken = localStorage.getItem('refreshToken')
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rfToken }),
    }).catch(() => {})
    logoutSession()
  },

  getMe() {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  },

  async completeOnboarding({ action, groupName, inviteCode }) {
    const res = await request('/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify({ action, groupName, inviteCode }),
    })
    localStorage.setItem('user', JSON.stringify(res))
    return res
  },

  async getTransactions() {
    return request('/transactions')
  },

  async createTransaction(data) {
    return request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateTransaction(id, data) {
    return request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteTransaction(id) {
    return request(`/transactions/${id}`, {
      method: 'DELETE',
    })
  },

  async getBudget() {
    return request('/budgets/current')
  },

  async updateBudget(categories) {
    return request('/budgets/current', {
      method: 'PUT',
      body: JSON.stringify(categories),
    })
  },

  async getScore() {
    return request('/score')
  },

  async getLeaderboard() {
    const group = await this.getGroup()
    if (!group) return []
    return request(`/groups/${group.id}/leaderboard`)
  },

  async getFeed() {
    const group = await this.getGroup()
    if (!group) return []
    return request(`/groups/${group.id}/feed`)
  },

  async getGroup() {
    return request('/groups/me')
  },

  async getUsage() {
    return request('/usage')
  },

  async runOcr(file) {
    const formData = new FormData()
    if (file) {
      formData.append('image', file)
    } else {
      // Send a dummy placeholder image to satisfy multi-part file requirements in Go backend
      const dummyBlob = new Blob(['dummy content'], { type: 'image/jpeg' })
      formData.append('image', dummyBlob, 'receipt.jpg')
    }

    return request('/llm/ocr', {
      method: 'POST',
      body: formData,
    })
  },

  async updateProfile(data) {
    const res = await request('/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    localStorage.setItem('user', JSON.stringify(res))
    return res
  },

  async getCoachTips() {
    const res = await request('/llm/coach', {
      method: 'POST',
    })
    return res.response
  },

  async getAiAnalysisReport() {
    const res = await request('/llm/analyze', {
      method: 'POST',
    })
    return res.response
  },

  async sendChatMessage(_message) {
    const res = await request('/llm/coach', {
      method: 'POST',
    })
    return res.response
  },

  async reactToFeedEvent(eventId, reaction) {
    const group = await this.getGroup()
    if (!group) return
    return request(`/groups/${group.id}/feed/${eventId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    })
  },

  resetDemo() {
    logoutSession()
    return null
  },

  async getPublicScore() {
    return request('/score/public')
  },
}
