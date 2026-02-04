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

export interface ChallengeLeaderboardEntry {
  rank: number
  callsign: string
  points: number
}

export interface ChallengeLeaderboardResponse {
  challenge: string
  type: 'activator' | 'chaser'
  leaderboard: ChallengeLeaderboardEntry[]
}

export interface LeagueTableEntry {
  rank: number
  callsign: string
  points: number
}

export interface LeagueTablesResponse {
  year: number
  fellWalkers: LeagueTableEntry[]
  fellChasers: LeagueTableEntry[]
  fellWatchers: LeagueTableEntry[]
}

export interface YearlyActivationStats {
  year: number
  uniqueFells: number
  activatorContacts: number
  chaserContacts: number
}

export interface ActivationContact {
  time: string | null
  stncall: string
  confirmed: boolean | null
  band: string | null
  frequency: number | null
  mode: string | null
}

export const apiClient = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        // Handle specific HTTP status codes
        if (response.status === 404) {
          throw new Error('Server not found. Please check your connection.')
        }

        if (response.status === 504) {
          throw new Error('Database connection timeout. Please try again.')
        }

        // Try to get error message from response
        let errorMessage = 'Login failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }

        throw new Error(errorMessage)
      }

      return response.json()
    } catch (error) {
      // Handle network errors (server unreachable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to reach server. Please check your connection.')
      }
      // Re-throw other errors
      throw error
    }
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

  async getSummitActivations(wotaid: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/summits/${wotaid}/activations`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch summit activations')
    }

    return response.json()
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
      const errorText = await response.text()
      throw new Error(`Failed to lookup SOTA reference: ${response.status} ${errorText}`)
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

  async getActivatorContacts(page: number = 1, pageSize: number = 25, year?: number, sortOrder: 'asc' | 'desc' = 'desc', callsign?: string): Promise<any> {
    let url = `${API_BASE_URL}/contacts/activator?page=${page}&pageSize=${pageSize}&sortOrder=${sortOrder}`
    if (year) {
      url += `&year=${year}`
    }
    if (callsign) {
      url += `&callsign=${encodeURIComponent(callsign)}`
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

  async getChaserContacts(page: number = 1, pageSize: number = 25, year?: number, sortOrder: 'asc' | 'desc' = 'desc', callsign?: string): Promise<any> {
    let url = `${API_BASE_URL}/contacts/chaser?page=${page}&pageSize=${pageSize}&sortOrder=${sortOrder}`
    if (year) {
      url += `&year=${year}`
    }
    if (callsign) {
      url += `&callsign=${encodeURIComponent(callsign)}`
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

  async getChallengeActivatorScores(): Promise<ChallengeLeaderboardResponse> {
    const response = await fetch(`${API_BASE_URL}/challenge/2026-vhf/activators`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch challenge activator scores')
    }

    return response.json()
  },

  async getChallengeChaserScores(): Promise<ChallengeLeaderboardResponse> {
    const response = await fetch(`${API_BASE_URL}/challenge/2026-vhf/chasers`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch challenge chaser scores')
    }

    return response.json()
  },

  async getLeagueTables(year?: number): Promise<LeagueTablesResponse> {
    let url = `${API_BASE_URL}/league-tables`
    if (year) {
      url += `?year=${year}`
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch league tables')
    }

    return response.json()
  },

  async getYearlyActivations(): Promise<YearlyActivationStats[]> {
    const response = await fetch(`${API_BASE_URL}/yearly-activations`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch yearly activations')
    }

    return response.json()
  },

  async getActivationContacts(wotaid: number, callsign: string, date: string): Promise<ActivationContact[]> {
    const params = new URLSearchParams({
      wotaid: wotaid.toString(),
      callsign,
      date,
    })

    const response = await fetch(`${API_BASE_URL}/activation/contacts?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch activation contacts')
    }

    return response.json()
  },
}
