import type { DatabaseStatistics, Summit } from '../types/adif'

const API_BASE_URL = '/data/api'

export interface ExportFilters {
  callsigns?: string[]
  year?: number
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  success: boolean
  user?: {
    id: number
    username: string
  }
  error?: string
}

export interface SessionResponse {
  authenticated: boolean
  user?: {
    id: number
    username: string
  }
}

export const apiClient = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    return response.json()
  },

  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Logout failed')
    }
  },

  async checkSession(): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/session`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Session check failed')
    }

    return response.json()
  },

  async importAdif(records: any[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/import/adif`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ records }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Import failed')
    }

    return response.json()
  },

  async checkDuplicates(records: any[]): Promise<{ duplicates: boolean[] }> {
    const response = await fetch(`${API_BASE_URL}/import/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ records }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Duplicate check failed')
    }

    return response.json()
  },

  async getStatistics(): Promise<DatabaseStatistics> {
    const response = await fetch(`${API_BASE_URL}/statistics`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch statistics')
    }

    return response.json()
  },

  async getUserStatistics(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/statistics/user`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user statistics')
    }

    return response.json()
  },

  async getSummits(): Promise<Summit[]> {
    const response = await fetch(`${API_BASE_URL}/summits`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('getSummits failed:', response.status, error)
      throw new Error(error.error || `Failed to fetch summits (${response.status})`)
    }

    const summits = await response.json()
    console.log('getSummits response:', Array.isArray(summits) ? `${summits.length} summits` : 'Invalid response')
    return summits
  },

  async lookupSotaReference(sotaRef: string): Promise<Summit | null> {
    const response = await fetch(`${API_BASE_URL}/summits/sota/${encodeURIComponent(sotaRef)}`, {
      method: 'GET',
      credentials: 'include',
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error('Failed to lookup SOTA reference')
    }

    return response.json()
  },

  async exportActivatorCsv(filters?: ExportFilters): Promise<void> {
    const params = new URLSearchParams()

    if (filters?.callsigns && filters.callsigns.length > 0) {
      params.append('callsigns', filters.callsigns.join(','))
    }

    if (filters?.year) {
      params.append('year', filters.year.toString())
    }

    const url = `${API_BASE_URL}/export/activator${params.toString() ? '?' + params.toString() : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to export activator log')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl

    let filename = 'activator_log'
    if (filters?.year) {
      filename += `_${filters.year}`
    }
    if (filters?.callsigns && filters.callsigns.length > 0) {
      filename += `_${filters.callsigns.slice(0, 3).join('_')}`
      if (filters.callsigns.length > 3) {
        filename += '_etc'
      }
    }
    filename += '.csv'

    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  },

  async exportChaserCsv(filters?: ExportFilters): Promise<void> {
    const params = new URLSearchParams()

    if (filters?.callsigns && filters.callsigns.length > 0) {
      params.append('callsigns', filters.callsigns.join(','))
    }

    if (filters?.year) {
      params.append('year', filters.year.toString())
    }

    const url = `${API_BASE_URL}/export/chaser${params.toString() ? '?' + params.toString() : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to export chaser log')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl

    let filename = 'chaser_log'
    if (filters?.year) {
      filename += `_${filters.year}`
    }
    if (filters?.callsigns && filters.callsigns.length > 0) {
      filename += `_${filters.callsigns.slice(0, 3).join('_')}`
      if (filters.callsigns.length > 3) {
        filename += '_etc'
      }
    }
    filename += '.csv'

    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  },

  async getActivatorContacts(page: number = 1, pageSize: number = 25, year?: number, sortOrder: 'asc' | 'desc' = 'desc'): Promise<any> {
    let url = `${API_BASE_URL}/contacts/activator?page=${page}&pageSize=${pageSize}&sortOrder=${sortOrder}`
    if (year) {
      url += `&year=${year}`
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch activator contacts')
    }

    return response.json()
  },

  async getChaserContacts(page: number = 1, pageSize: number = 25, year?: number, sortOrder: 'asc' | 'desc' = 'desc'): Promise<any> {
    let url = `${API_BASE_URL}/contacts/chaser?page=${page}&pageSize=${pageSize}&sortOrder=${sortOrder}`
    if (year) {
      url += `&year=${year}`
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch chaser contacts')
    }

    return response.json()
  },
}
