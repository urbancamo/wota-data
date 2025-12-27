<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showNotify } from 'vant'
import { apiClient } from '../services/api'

const statistics = ref<any>(null)
const loading = ref(true)

async function fetchStatistics() {
  try {
    loading.value = true
    const result = await apiClient.getUserStatistics()
    console.log('User statistics fetched:', result)
    statistics.value = result
  } catch (error) {
    console.error('Error fetching user statistics:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load user statistics',
    })
    statistics.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStatistics()
})

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="user-statistics-panel">
    <div class="stats-card">
      <h3 v-if="statistics" class="card-title">{{ statistics.callsign }} Statistics</h3>
      <h3 v-else class="card-title">User Statistics</h3>

      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" size="24" />
        <div class="loading-text">Loading statistics...</div>
      </div>

      <div v-else-if="statistics" class="stats-grid">
        <!-- Activations Section -->
        <div class="stat-section">
          <div class="section-title">Activations</div>
          <div class="stat-item">
            <div class="stat-label">Total QSOs</div>
            <div class="stat-value">{{ statistics.activations.total }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Summits Activated</div>
            <div class="stat-value">{{ statistics.activations.uniqueSummits }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Last Activity</div>
            <div class="stat-value small">{{ formatDate(statistics.activations.lastActivity) }}</div>
          </div>
        </div>

        <!-- Chases Section -->
        <div class="stat-section">
          <div class="section-title">Chases</div>
          <div class="stat-item">
            <div class="stat-label">Total QSOs</div>
            <div class="stat-value">{{ statistics.chases.total }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Summits Chased</div>
            <div class="stat-value">{{ statistics.chases.uniqueSummits }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Last Activity</div>
            <div class="stat-value small">{{ formatDate(statistics.chases.lastActivity) }}</div>
          </div>
        </div>
      </div>

      <div v-else class="no-data">No statistics available</div>
    </div>
  </div>
</template>

<style scoped>
.user-statistics-panel {
  padding: 16px;
}

.stats-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.loading-container {
  text-align: center;
  padding: 20px;
}

.loading-text {
  text-align: center;
  margin-top: 8px;
  color: #666;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 16px;
}

.stat-section {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
  border-bottom: 2px solid #1989fa;
  padding-bottom: 8px;
}

.stat-item {
  text-align: center;
  margin-bottom: 12px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #323233;
}

.stat-value.small {
  font-size: 14px;
}

.no-data {
  text-align: center;
  color: #999;
  padding: 20px;
}
</style>
