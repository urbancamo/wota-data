<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import backgroundImage from '../assets/images/login-background.png'

const { login, error } = useAuth()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  // Clear previous error
  errorMessage.value = ''

  if (!username.value || !password.value) {
    errorMessage.value = 'Please enter username and password'
    return
  }

  isLoading.value = true

  try {
    const success = await login(username.value, password.value)

    if (!success) {
      errorMessage.value = error.value || 'Login failed'
      console.error('Login failed:', errorMessage.value)
    }
  } catch (err) {
    // Catch any errors not handled by useAuth
    errorMessage.value = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('Login error:', errorMessage.value)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-container" :style="{ backgroundImage: `url(${backgroundImage})` }">
    <div class="login-card">
      <div class="login-header">
        <h1>WOTA Data</h1>
        <p>Please log in to continue</p>
      </div>

      <van-form @submit="handleLogin">
        <van-cell-group inset>
          <van-field
            v-model="username"
            name="username"
            label="Username"
            placeholder="Enter callsign"
            :rules="[{ required: true, message: 'Callsign is required' }]"
            autocomplete="username"
          />

          <van-field
            v-model="password"
            type="password"
            name="password"
            label="Password"
            placeholder="Enter password"
            :rules="[{ required: true, message: 'Password is required' }]"
            autocomplete="current-password"
          />
        </van-cell-group>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div class="login-button-wrapper">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="isLoading"
          >
            Log In
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  padding: 16px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
  color: #333;
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.error-message {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #cf1322;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

.login-button-wrapper {
  margin-top: 24px;
  padding: 0 16px;
}

</style>
