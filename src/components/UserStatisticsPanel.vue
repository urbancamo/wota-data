<script setup lang="ts">
import {onMounted, ref, watch} from 'vue'
import {showNotify} from 'vant'
import type {AwardProgress} from '../services/api'
import {apiClient} from '../services/api'

const statistics = ref<any>(null)
const loading = ref(true)

const awardProgress = ref<AwardProgress[]>([])
const awardLoading = ref(false)
const activeAwardType = ref(0)

async function fetchStatistics() {
  try {
    loading.value = true
    statistics.value = await apiClient.getUserStatistics()
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

async function fetchAwardProgress(type: 'activator' | 'chaser') {
  try {
    awardLoading.value = true
    const result = await apiClient.getAwardProgress(type)
    awardProgress.value = result.awards
  } catch (error) {
    console.error('Error fetching award progress:', error)
    awardProgress.value = []
  } finally {
    awardLoading.value = false
  }
}

watch(activeAwardType, (val) => {
  fetchAwardProgress(val === 0 ? 'activator' : 'chaser')
})

onMounted(() => {
  fetchStatistics()
  fetchAwardProgress('activator')
})

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

function barWidth(worked: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.min((worked / total) * 100, 100)}%`
}

function tierGradient(tiers: AwardProgress['tiers']): string {
  if (!tiers) return 'none'
  const stops = tiers.map((t, i) => {
    const start = i === 0 ? 0 : (tiers[i - 1].threshold / tiers[tiers.length - 1].threshold) * 100
    const end = (t.threshold / tiers[tiers.length - 1].threshold) * 100
    return `${t.color} ${start}%, ${t.color} ${end}%`
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}

function tierFillColor(award: AwardProgress): string | undefined {
  if (!award.tiers) return undefined
  const tierColors = [
    'rgba(7, 193, 96, 0.4)',
    'rgba(7, 193, 96, 0.6)',
    'rgba(7, 193, 96, 0.8)',
    'rgba(7, 193, 96, 1)',
  ]
  let color: string | undefined
  for (let i = 0; i < award.tiers.length; i++) {
    if (award.worked >= award.tiers[i].threshold) {
      color = tierColors[i]
    }
  }
  return color
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

      <div v-else-if="statistics">
        <div class="stats-grid">
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

        <!-- Award Progress Section -->
        <div class="award-progress-section">
          <div class="section-title">Award Progress</div>

          <van-tabs v-model:active="activeAwardType" type="card" class="award-tabs">
            <van-tab title="Activator" />
            <van-tab title="Chaser" />
          </van-tabs>

          <div v-if="awardLoading" class="loading-container">
            <van-loading type="spinner" size="20" />
          </div>

          <div v-else class="award-bars">
            <div
              v-for="award in awardProgress"
              :key="award.code"
              class="award-row"
              :class="{ 'award-row--complete': award.worked >= award.total }"
            >
              <div class="award-label">{{ award.name }}</div>
              <div class="award-bar-container">
                <div
                  class="award-bar-track"
                  :style="award.tiers ? { background: tierGradient(award.tiers) } : {}"
                >
                  <!-- Tier markers for Outlying Fells -->
                  <template v-if="award.tiers">
                    <div
                      v-for="(tier, i) in award.tiers.slice(0, -1)"
                      :key="tier.name"
                      class="tier-marker"
                      :style="{ left: ((i + 1) * 25) + '%' }"
                    >
                      <span class="tier-label">{{ tier.name }}</span>
                    </div>
                  </template>

                  <div
                    class="award-bar-fill"
                    :style="{ width: barWidth(award.worked, award.total), background: tierFillColor(award) }"
                  >
                    <span v-if="award.worked > 0" class="award-bar-value">{{ award.worked }}</span>
                  </div>
                </div>
              </div>
              <div class="award-max">{{ award.total }}</div>
            </div>
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

/* Award Progress */
.award-progress-section {
  margin-top: 24px;
}

.award-tabs {
  margin-bottom: 16px;
}

.award-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.award-row {
  display: grid;
  grid-template-columns: 140px 1fr 40px;
  align-items: center;
  gap: 8px;
}

.award-row--complete .award-bar-fill {
  background: #07c160;
}

.award-label {
  font-size: 13px;
  color: #323233;
  text-align: right;
  white-space: nowrap;
}

.award-bar-container {
  position: relative;
}

.award-bar-track {
  background: #f0f0f0;
  border-radius: 4px;
  height: 22px;
  position: relative;
  overflow: hidden;
}

.award-bar-fill {
  background: #1989fa;
  height: 100%;
  border-radius: 4px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  transition: width 0.3s ease;
}

.award-bar-value {
  font-size: 11px;
  font-weight: 600;
  color: white;
  padding-right: 6px;
  white-space: nowrap;
}

.award-max {
  font-size: 12px;
  color: #999;
  text-align: left;
}

/* Tier markers for Outlying Fells */
.tier-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.tier-label {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 600;
  color: #999;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .award-row {
    display: grid;
    grid-template-columns: 1fr 40px;
    grid-template-rows: auto auto;
    gap: 2px 8px;
  }

  .award-label {
    grid-column: 1 / -1;
    text-align: left;
    font-size: 12px;
  }

  .award-bar-container {
    grid-column: 1;
    grid-row: 2;
  }

  .award-max {
    grid-column: 2;
    grid-row: 2;
  }
}
</style>
