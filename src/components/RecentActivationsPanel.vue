<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showNotify } from 'vant'
import { type ActivationContact, apiClient } from '../services/api'
import type { DatabaseStatistics } from '../types/adif'
import { formatWotaReference } from '../utils/wotaReference'

const statistics = ref<DatabaseStatistics | null>(null)
const loading = ref(true)

const showActivationPopup = ref(false)
const selectedActivation = ref<{
  wotaid: number
  name: string
  date: string
  callsign: string
} | null>(null)
const activationContacts = ref<ActivationContact[]>([])
const loadingContacts = ref(false)

async function fetchStatistics() {
  try {
    loading.value = true
    statistics.value = await apiClient.getStatistics()
  } catch (error) {
    console.error('Error fetching statistics:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load statistics',
    })
    statistics.value = null
  } finally {
    loading.value = false
  }
}

async function openActivationDetails(activation: { wotaid: number; name: string; date: string; callsign: string }) {
  selectedActivation.value = activation
  showActivationPopup.value = true
  loadingContacts.value = true
  activationContacts.value = []

  try {
    activationContacts.value = await apiClient.getActivationContacts(
      activation.wotaid,
      activation.callsign,
      activation.date
    )
  } catch (error) {
    console.error('Error fetching activation contacts:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load contacts',
    })
  } finally {
    loadingContacts.value = false
  }
}

function formatTime(timeString: string | null): string {
  if (!timeString) return '-'
  const date = new Date(timeString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function copyAsMarkdown() {
  if (!selectedActivation.value || activationContacts.value.length === 0) return

  const activation = selectedActivation.value
  let markdown = `## ${activation.name} (${formatWotaReference(activation.wotaid)})\n`
  markdown += `**Callsign:** ${activation.callsign}  \n`
  markdown += `**Date:** ${formatDate(activation.date)}\n\n`
  markdown += `| Time | Callsign | Band | Mode | Confirmed |\n`
  markdown += `|------|----------|------|------|:---------:|\n`

  for (const contact of activationContacts.value) {
    const time = formatTime(contact.time)
    const band = contact.band || '-'
    const mode = contact.mode || '-'
    const confirmed = contact.confirmed ? '✓' : '-'
    markdown += `| ${time} | [${contact.stncall}](https://qrz.com/db/${contact.stncall}) | ${band} | ${mode} | ${confirmed} |\n`
  }

  try {
    await navigator.clipboard.writeText(markdown)
    showNotify({
      type: 'success',
      message: 'Copied to clipboard',
    })
  } catch (error) {
    showNotify({
      type: 'warning',
      message: 'Failed to copy to clipboard',
    })
  }
}

onMounted(() => {
  fetchStatistics()
})
</script>

<template>
  <div class="recent-activations-panel">
    <div class="stats-card">
      <h3 class="card-title">Recent Activations</h3>

      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" size="24" />
        <div class="loading-text">Loading...</div>
      </div>

      <div v-else-if="statistics && statistics.summits.recentActivations && statistics.summits.recentActivations.length > 0" class="recent-summits-list">
        <div
          v-for="(summit, index) in statistics.summits.recentActivations"
          :key="index"
          class="recent-summit-item clickable"
          @click="openActivationDetails(summit)"
        >
          <div class="summit-name">{{ summit.name }}</div>
          <div class="summit-id">{{ formatWotaReference(summit.wotaid) }}</div>
          <div class="summit-callsign">{{ summit.callsign }}</div>
          <div class="summit-date">{{ formatDate(summit.date) }}</div>
        </div>
      </div>

      <div v-else class="no-data">No recent activations</div>

      <!-- Activation Details Popup -->
      <van-popup
        v-model:show="showActivationPopup"
        position="bottom"
        :style="{ height: '70%' }"
        round
      >
        <div class="activation-popup">
          <div class="popup-header">
            <h3>Activation Details</h3>
            <van-icon name="cross" class="close-icon" @click="showActivationPopup = false" />
          </div>

          <div v-if="selectedActivation" class="activation-info">
            <div class="info-row">
              <span class="info-label">Summit:</span>
              <span class="info-value">{{ selectedActivation.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Reference:</span>
              <span class="info-value wota-ref">{{ formatWotaReference(selectedActivation.wotaid) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Callsign:</span>
              <span class="info-value callsign">{{ selectedActivation.callsign }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">{{ formatDate(selectedActivation.date) }}</span>
            </div>
          </div>

          <div class="contacts-section">
            <div class="contacts-header">
              <div class="contacts-title">Contacts ({{ activationContacts.length }})</div>
              <van-button
                v-if="activationContacts.length > 0"
                size="small"
                icon="description"
                @click="copyAsMarkdown"
              >
                Copy as Markdown
              </van-button>
            </div>

            <div v-if="loadingContacts" class="loading-container">
              <van-loading type="spinner" size="24" />
            </div>

            <div v-else-if="activationContacts.length > 0" class="contacts-table-wrapper">
              <table class="contacts-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Callsign</th>
                    <th>Band</th>
                    <th>Mode</th>
                    <th>Confirmed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(contact, index) in activationContacts" :key="index">
                    <td>{{ formatTime(contact.time) }}</td>
                    <td class="callsign">
                      <a :href="`https://qrz.com/db/${contact.stncall}`" target="_blank" rel="noopener">
                        {{ contact.stncall }}
                      </a>
                    </td>
                    <td>{{ contact.band || '-' }}</td>
                    <td>{{ contact.mode || '-' }}</td>
                    <td>
                      <van-icon v-if="contact.confirmed" name="success" color="#07c160" />
                      <span v-else>-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="no-data">No contacts found</div>
          </div>
        </div>
      </van-popup>
    </div>
  </div>
</template>

<style scoped>
.recent-activations-panel {
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

.no-data {
  text-align: center;
  color: #999;
  padding: 20px;
}

.recent-summits-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.recent-summit-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 4px;
  border-left: 3px solid #1989fa;
}

.summit-name {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.summit-id {
  font-size: 12px;
  color: #1989fa;
  font-weight: 600;
  font-family: monospace;
}

.summit-callsign {
  font-size: 12px;
  color: #323233;
  font-weight: 600;
  font-family: monospace;
}

.summit-date {
  font-size: 12px;
  color: #969799;
}

@media (max-width: 640px) {
  .recent-summit-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}

.recent-summit-item.clickable {
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.recent-summit-item.clickable:hover {
  background: #f0f7ff;
  transform: translateX(2px);
}

.activation-popup {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.popup-header h3 {
  margin: 0;
  font-size: 18px;
  color: #323233;
}

.close-icon {
  font-size: 20px;
  color: #969799;
  cursor: pointer;
}

.activation-info {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.info-label {
  color: #969799;
  font-size: 14px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.info-value.wota-ref {
  color: #1989fa;
  font-family: monospace;
}

.info-value.callsign {
  font-family: monospace;
  font-weight: 600;
}

.contacts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.contacts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.contacts-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.contacts-table-wrapper {
  flex: 1;
  overflow-y: auto;
}

.contacts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.contacts-table th,
.contacts-table td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.contacts-table th {
  background: #f7f8fa;
  font-weight: 600;
  color: #323233;
  position: sticky;
  top: 0;
}

.contacts-table td.callsign {
  font-family: monospace;
  font-weight: 600;
}

.contacts-table td.callsign a {
  color: #1989fa;
  text-decoration: none;
}

.contacts-table td.callsign a:hover {
  text-decoration: underline;
}

.contacts-table tbody tr:hover {
  background: #f7f8fa;
}
</style>