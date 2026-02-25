<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { showNotify, showDialog } from 'vant'
import { apiClient } from '../services/api'
import type { SpotWithSummit, AlertWithSummit } from '../types/adif'
import { formatWotaReference, formatSotaReference } from '../utils/wotaReference'
import {
  filterTodaySpots,
  filterAndDeduplicateAlerts,
  isSpotRecent,
  isAlertToday,
} from '../utils/spotsAlerts'
import { useAuth } from '../composables/useAuth'

const { username, isAdmin } = useAuth()

const spots = ref<SpotWithSummit[]>([])
const alerts = ref<AlertWithSummit[]>([])
const loadingSpots = ref(true)
const loadingAlerts = ref(true)
const countdown = ref(60)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const filteredSpots = computed(() => filterTodaySpots(spots.value))
const filteredAlerts = computed(() => filterAndDeduplicateAlerts(alerts.value))

function formatDateTime(datetime: string): string {
  const date = new Date(datetime)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function canDelete(ownerCallsign: string): boolean {
  const userCall = username.value?.toUpperCase()
  return isAdmin.value || ownerCallsign.trim().toUpperCase() === userCall
}

async function fetchSpots() {
  try {
    loadingSpots.value = true
    spots.value = await apiClient.getSpots()
  } catch (error) {
    console.error('Error fetching spots:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load spots',
    })
  } finally {
    loadingSpots.value = false
  }
}

async function fetchAlerts() {
  try {
    loadingAlerts.value = true
    alerts.value = await apiClient.getAlerts()
  } catch (error) {
    console.error('Error fetching alerts:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load alerts',
    })
  } finally {
    loadingAlerts.value = false
  }
}

async function fetchAll() {
  await Promise.all([fetchSpots(), fetchAlerts()])
  countdown.value = 60
}

function confirmDeleteSpot(spot: SpotWithSummit) {
  showDialog({
    title: 'Delete Spot',
    message: `Delete spot for ${spot.call} on ${formatWotaReference(spot.wotaid)}?`,
    showCancelButton: true,
    confirmButtonText: 'Delete',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await apiClient.deleteSpot(spot.id)
      showNotify({ type: 'success', message: 'Spot deleted' })
      await fetchSpots()
    } catch (error) {
      showNotify({
        type: 'danger',
        message: error instanceof Error ? error.message : 'Failed to delete spot',
      })
    }
  }).catch(() => {
    // User cancelled
  })
}

function confirmDeleteAlert(alert: AlertWithSummit) {
  showDialog({
    title: 'Delete Alert',
    message: `Delete alert for ${alert.call} on ${formatWotaReference(alert.wotaid)}?`,
    showCancelButton: true,
    confirmButtonText: 'Delete',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await apiClient.deleteAlert(alert.id)
      showNotify({ type: 'success', message: 'Alert deleted' })
      await fetchAlerts()
    } catch (error) {
      showNotify({
        type: 'danger',
        message: error instanceof Error ? error.message : 'Failed to delete alert',
      })
    }
  }).catch(() => {
    // User cancelled
  })
}

function startAutoRefresh() {
  refreshTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      fetchAll()
    }
  }, 1000)
}

onMounted(() => {
  fetchAll()
  startAutoRefresh()
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div class="spots-alerts-panel">
    <div class="columns">
      <!-- Alerts Column (Left) -->
      <div class="column">
        <div class="column-header">Alerts</div>

        <div v-if="loadingAlerts" class="loading-container">
          <van-loading type="spinner" size="24" />
        </div>

        <div v-else-if="filteredAlerts.length === 0" class="no-data">
          No upcoming alerts
        </div>

        <div v-else class="entries-list">
          <div
            v-for="alert in filteredAlerts"
            :key="alert.id"
            class="entry-item"
            :class="{ 'entry-recent': isAlertToday(alert.datetime) }"
          >
            <div class="entry-header">
              <a
                :href="`https://qrz.com/db/${alert.call}`"
                target="_blank"
                rel="noopener"
                class="callsign-link"
              >
                {{ alert.call }}
              </a>
              <span class="entry-datetime">{{ formatDateTime(alert.datetime) }}</span>
            </div>

            <div class="entry-tags">
              <span class="tag tag-wota">{{ formatWotaReference(alert.wotaid) }}</span>
              <span
                v-if="alert.sotaid"
                class="tag tag-sota"
              >
                {{ formatSotaReference(alert.sotaid) }}
              </span>
              <span class="tag tag-freq">{{ alert.freqmode }}</span>
            </div>

            <div v-if="alert.summitName" class="entry-summit">{{ alert.summitName }}</div>
            <div v-if="alert.comment" class="entry-comment">{{ alert.comment }}</div>

            <div class="entry-footer">
              <span class="entry-poster">
                Posted by:
                <a
                  :href="`https://qrz.com/db/${alert.postedby.trim()}`"
                  target="_blank"
                  rel="noopener"
                  class="callsign-link"
                >
                  {{ alert.postedby.trim() }}
                </a>
              </span>
              <van-button
                v-if="canDelete(alert.postedby)"
                size="mini"
                type="danger"
                plain
                @click="confirmDeleteAlert(alert)"
              >
                Delete
              </van-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Spots Column (Right) -->
      <div class="column">
        <div class="column-header">Spots</div>

        <div v-if="loadingSpots" class="loading-container">
          <van-loading type="spinner" size="24" />
        </div>

        <div v-else-if="filteredSpots.length === 0" class="no-data">
          No spots today
        </div>

        <div v-else class="entries-list">
          <div
            v-for="spot in filteredSpots"
            :key="spot.id"
            class="entry-item"
            :class="{ 'entry-recent': isSpotRecent(spot.datetime) }"
          >
            <div class="entry-header">
              <a
                :href="`https://qrz.com/db/${spot.call}`"
                target="_blank"
                rel="noopener"
                class="callsign-link"
              >
                {{ spot.call }}
              </a>
              <span class="entry-datetime">{{ formatDateTime(spot.datetime) }}</span>
            </div>

            <div class="entry-tags">
              <span class="tag tag-wota">{{ formatWotaReference(spot.wotaid) }}</span>
              <span
                v-if="spot.sotaid"
                class="tag tag-sota"
              >
                {{ formatSotaReference(spot.sotaid) }}
              </span>
              <span class="tag tag-freq">{{ spot.freqmode }}</span>
            </div>

            <div v-if="spot.summitName" class="entry-summit">{{ spot.summitName }}</div>
            <div v-if="spot.comment" class="entry-comment">{{ spot.comment }}</div>

            <div class="entry-footer">
              <span class="entry-poster">
                Spotted by:
                <a
                  :href="`https://qrz.com/db/${spot.spotter.trim()}`"
                  target="_blank"
                  rel="noopener"
                  class="callsign-link"
                >
                  {{ spot.spotter.trim() }}
                </a>
              </span>
              <van-button
                v-if="canDelete(spot.spotter)"
                size="mini"
                type="danger"
                plain
                @click="confirmDeleteSpot(spot)"
              >
                Delete
              </van-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spots-alerts-panel {
  padding: 16px;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 768px) {
  .columns {
    grid-template-columns: 1fr;
  }
}

.column {
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.column-header {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
  border-bottom: 2px solid #1989fa;
  padding-bottom: 8px;
}

.loading-container {
  text-align: center;
  padding: 20px;
}

.no-data {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 14px;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
  overflow-y: auto;
}

.entry-item {
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 6px;
  border-left: 3px solid #ddd;
}

.entry-item.entry-recent {
  background: #d4edda;
  border-left-color: #07c160;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.callsign-link {
  color: #1989fa;
  text-decoration: none;
  font-weight: 600;
  font-family: monospace;
  font-size: 14px;
}

.callsign-link:hover {
  text-decoration: underline;
}

.entry-datetime {
  font-size: 12px;
  color: #969799;
}

.entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}

.tag-wota {
  background: #e8f0fe;
  color: #1989fa;
}

.tag-sota {
  background: #e8f8e8;
  color: #07c160;
}

.tag-freq {
  background: #f2f3f5;
  color: #646566;
}

.entry-summit {
  font-size: 13px;
  font-weight: 500;
  color: #323233;
  margin-bottom: 4px;
}

.entry-comment {
  font-size: 12px;
  color: #646566;
  font-style: italic;
  margin-bottom: 4px;
}

.entry-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.entry-poster {
  font-size: 12px;
  color: #969799;
}

.entry-poster .callsign-link {
  font-size: 12px;
}
</style>