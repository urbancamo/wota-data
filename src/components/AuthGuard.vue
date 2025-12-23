<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import LoginForm from './LoginForm.vue'

const { isAuthenticated, isChecking, checkSession } = useAuth()

onMounted(async () => {
  // Check for existing session on app load
  await checkSession()
})
</script>

<template>
  <div>
    <!-- Loading state while checking session -->
    <div v-if="isChecking" class="auth-loading">
      <van-loading size="24px" vertical>
        Checking session...
      </van-loading>
    </div>

    <!-- Show login form if not authenticated -->
    <LoginForm v-else-if="!isAuthenticated" />

    <!-- Show app content if authenticated -->
    <slot v-else />
  </div>
</template>

<style scoped>
.auth-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
</style>
