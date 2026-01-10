import { ref, computed } from 'vue'
import { apiClient } from '../services/api'

interface User {
  id: number
  username: string
  isAdmin?: boolean
}

// Global state (singleton pattern for authentication)
const currentUser = ref<User | null>(null)
const isChecking = ref(false)
const error = ref<string | null>(null)

export function useAuth() {
  const isAuthenticated = computed(() => currentUser.value !== null)
  const username = computed(() => currentUser.value?.username || '')
  const isAdmin = computed(() => currentUser.value?.isAdmin || false)

  async function login(username: string, password: string): Promise<boolean> {
    error.value = null

    try {
      const response = await apiClient.login({ username, password })

      if (response.success && response.user) {
        currentUser.value = response.user
        return true
      }

      error.value = 'Login failed'
      return false
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await apiClient.logout()
      currentUser.value = null
      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      // Still clear local state even if server logout fails
      currentUser.value = null
    }
  }

  async function checkSession(): Promise<void> {
    isChecking.value = true

    try {
      const response = await apiClient.checkSession()

      if (response.authenticated && response.user) {
        currentUser.value = response.user
      } else {
        currentUser.value = null
      }
    } catch (err) {
      console.error('Session check error:', err)
      currentUser.value = null
    } finally {
      isChecking.value = false
    }
  }

  return {
    // State
    currentUser,
    isAuthenticated,
    isChecking,
    error,
    username,
    isAdmin,

    // Actions
    login,
    logout,
    checkSession,
  }
}
