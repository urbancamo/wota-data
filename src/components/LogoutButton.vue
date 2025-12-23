<script setup lang="ts">
import { showConfirmDialog, showNotify } from 'vant'
import { useAuth } from '../composables/useAuth'

const { logout, username } = useAuth()

async function handleLogout() {
  try {
    await showConfirmDialog({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
    })

    await logout()

    showNotify({
      type: 'success',
      message: 'Logged out successfully',
    })
  } catch (err) {
    // User cancelled or error occurred
    if (err !== 'cancel') {
      showNotify({
        type: 'danger',
        message: 'Logout failed',
      })
    }
  }
}
</script>

<template>
  <div class="logout-section">
    <span class="username">{{ username }}</span>
    <van-button
      size="small"
      type="default"
      @click="handleLogout"
    >
      Logout
    </van-button>
  </div>
</template>

<style scoped>
.logout-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
}

.username {
  font-size: 14px;
  color: #666;
}
</style>
