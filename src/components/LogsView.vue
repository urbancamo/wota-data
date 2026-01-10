<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { showNotify } from 'vant'

interface LogEntry {
  id: string
  timestamp: string
  level: string
  message: string | null
  context: any
  hostname: string | null
  pid: number | null
  request_id: string | null
  user_id: string | null
  username: string | null
  path: string | null
  method: string | null
  status_code: number | null
  error_message: string | null
  error_stack: string | null
}

interface LogsResponse {
  logs: LogEntry[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalRecords = ref(0)
const pageSize = ref(50)
const selectedLevel = ref<string>('')
const showDetailPopup = ref(false)
const selectedLog = ref<LogEntry | null>(null)

const levelOptions = [
  { text: 'All Levels', value: '' },
  { text: 'Error', value: 'error' },
  { text: 'Warn', value: 'warn' },
  { text: 'Info', value: 'info' },
  { text: 'Debug', value: 'debug' },
  { text: 'Trace', value: 'trace' }
]

async function loadLogs() {
  try {
    loading.value = true
    console.log('Loading logs...')

    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      pageSize: pageSize.value.toString()
    })

    if (selectedLevel.value) {
      params.append('level', selectedLevel.value)
    }

    console.log('Fetching logs with params:', params.toString())

    const response = await fetch(`/data/api/admin/logs?${params}`, {
      credentials: 'include'
    })

    console.log('Response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Error response:', errorData)
      throw new Error(errorData.error || 'Failed to fetch logs')
    }

    const result: LogsResponse = await response.json()
    console.log('Logs loaded:', result.logs.length, 'records')

    logs.value = result.logs
    totalPages.value = result.pagination.totalPages
    totalRecords.value = result.pagination.total
  } catch (error) {
    console.error('Error loading logs:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to load logs'
    })
  } finally {
    loading.value = false
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getLevelColor(level: string) {
  switch (level.toLowerCase()) {
    case 'error':
    case 'fatal':
      return '#ee0a24'
    case 'warn':
      return '#ff976a'
    case 'info':
      return '#1989fa'
    case 'debug':
      return '#969799'
    case 'trace':
      return '#c8c9cc'
    default:
      return '#323233'
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
}

function handleRowClick(log: LogEntry) {
  selectedLog.value = log
  showDetailPopup.value = true
}

function formatJsonValue(value: any): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Watch for filter changes
watch([selectedLevel, pageSize], () => {
  currentPage.value = 1
  loadLogs()
})

// Watch for page changes
watch(currentPage, () => {
  loadLogs()
})

// Load logs on mount
onMounted(() => {
  console.log('LogsView mounted')
  loadLogs()
})

// Expose refresh method for parent component
defineExpose({
  refresh: loadLogs
})
</script>

<template>
  <div class="logs-view">
    <!-- Header -->
    <div class="logs-header">
      <h2>System Logs</h2>
    </div>

    <!-- Filter Section -->
    <div class="filter-section">
      <van-dropdown-menu>
        <van-dropdown-item v-model="selectedLevel" :options="levelOptions" @change="loadLogs" />
      </van-dropdown-menu>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <span>Total Logs: {{ totalRecords }}</span>
      <span>Page: {{ currentPage }} / {{ totalPages }}</span>
    </div>

    <!-- Loading State -->
    <van-loading v-if="loading" class="loading-spinner" />

    <!-- Logs Table -->
    <div v-else class="logs-table-container">
      <table class="logs-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Level</th>
            <th>Message</th>
            <th>Username</th>
            <th>Path</th>
            <th>Method</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="log in logs"
            :key="log.id"
            class="clickable-row"
            @click="handleRowClick(log)"
          >
            <td class="timestamp">{{ formatTimestamp(log.timestamp) }}</td>
            <td>
              <van-tag
                :color="getLevelColor(log.level)"
                size="medium"
              >
                {{ log.level.toUpperCase() }}
              </van-tag>
            </td>
            <td class="message">
              <div>{{ log.message }}</div>
              <div v-if="log.error_message" class="error-message">
                Error: {{ log.error_message }}
              </div>
            </td>
            <td>{{ log.username || '-' }}</td>
            <td class="path">{{ log.path || '-' }}</td>
            <td>{{ log.method || '-' }}</td>
            <td>{{ log.status_code || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <van-empty
        v-if="logs.length === 0"
        description="No logs found"
      />
    </div>

    <!-- Pagination -->
    <div class="pagination-section">
      <van-pagination
        v-model="currentPage"
        :total-items="totalRecords"
        :items-per-page="pageSize"
        :show-page-size="5"
        @change="handlePageChange"
      />
    </div>

    <!-- Log Detail Popup -->
    <van-popup
      v-model:show="showDetailPopup"
      position="bottom"
      :style="{ height: '80%' }"
      round
      closeable
    >
      <div v-if="selectedLog" class="log-detail">
        <h3 class="log-detail-title">Log Details</h3>

        <div class="log-detail-section">
          <div class="log-detail-row">
            <span class="log-detail-label">ID:</span>
            <span class="log-detail-value">{{ selectedLog.id }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Timestamp:</span>
            <span class="log-detail-value">{{ formatTimestamp(selectedLog.timestamp) }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Level:</span>
            <span class="log-detail-value">
              <van-tag
                :color="getLevelColor(selectedLog.level)"
                size="medium"
              >
                {{ selectedLog.level.toUpperCase() }}
              </van-tag>
            </span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Message:</span>
            <span class="log-detail-value">{{ selectedLog.message || '-' }}</span>
          </div>
        </div>

        <div class="log-detail-section">
          <h4 class="log-detail-subtitle">Request Information</h4>

          <div class="log-detail-row">
            <span class="log-detail-label">Path:</span>
            <span class="log-detail-value monospace">{{ selectedLog.path || '-' }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Method:</span>
            <span class="log-detail-value">{{ selectedLog.method || '-' }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Status Code:</span>
            <span class="log-detail-value">{{ selectedLog.status_code || '-' }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Request ID:</span>
            <span class="log-detail-value monospace">{{ selectedLog.request_id || '-' }}</span>
          </div>
        </div>

        <div class="log-detail-section">
          <h4 class="log-detail-subtitle">User Information</h4>

          <div class="log-detail-row">
            <span class="log-detail-label">Username:</span>
            <span class="log-detail-value">{{ selectedLog.username || '-' }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">User ID:</span>
            <span class="log-detail-value">{{ selectedLog.user_id || '-' }}</span>
          </div>
        </div>

        <div class="log-detail-section">
          <h4 class="log-detail-subtitle">System Information</h4>

          <div class="log-detail-row">
            <span class="log-detail-label">Hostname:</span>
            <span class="log-detail-value">{{ selectedLog.hostname || '-' }}</span>
          </div>

          <div class="log-detail-row">
            <span class="log-detail-label">Process ID:</span>
            <span class="log-detail-value">{{ selectedLog.pid || '-' }}</span>
          </div>
        </div>

        <div v-if="selectedLog.error_message || selectedLog.error_stack" class="log-detail-section">
          <h4 class="log-detail-subtitle error-title">Error Details</h4>

          <div v-if="selectedLog.error_message" class="log-detail-row">
            <span class="log-detail-label">Error Message:</span>
            <span class="log-detail-value error-text">{{ selectedLog.error_message }}</span>
          </div>

          <div v-if="selectedLog.error_stack" class="log-detail-row full-width">
            <span class="log-detail-label">Stack Trace:</span>
            <pre class="log-detail-stack">{{ selectedLog.error_stack }}</pre>
          </div>
        </div>

        <div v-if="selectedLog.context" class="log-detail-section">
          <h4 class="log-detail-subtitle">Context (JSON)</h4>
          <pre class="log-detail-json">{{ formatJsonValue(selectedLog.context) }}</pre>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.logs-view {
  padding: 16px;
  min-height: calc(100vh - 46px - 44px);
}

.logs-header {
  margin-bottom: 16px;
}

.logs-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  margin: 0;
}

.filter-section {
  margin-bottom: 16px;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f7f8fa;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #646566;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.logs-table-container {
  background: white;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.logs-table thead {
  background: #f7f8fa;
}

.logs-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: #323233;
  border-bottom: 2px solid #ebedf0;
  white-space: nowrap;
}

.logs-table td {
  padding: 8px;
  border-bottom: 1px solid #ebedf0;
  vertical-align: top;
}

.logs-table tbody tr:hover {
  background: #f7f8fa;
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.clickable-row:hover {
  background: #e8f3ff !important;
}

.timestamp {
  white-space: nowrap;
  font-size: 13px;
  color: #646566;
}

.message {
  max-width: 400px;
  word-wrap: break-word;
}

.error-message {
  color: #ee0a24;
  font-size: 12px;
  margin-top: 4px;
}

.path {
  font-family: monospace;
  font-size: 12px;
  color: #646566;
}

.pagination-section {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

@media (max-width: 768px) {
  .logs-view {
    padding: 8px;
  }

  .logs-table {
    font-size: 12px;
  }

  .logs-table th,
  .logs-table td {
    padding: 6px 4px;
  }

  .message {
    max-width: 200px;
  }
}

/* Log Detail Popup Styles */
.log-detail {
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.log-detail-title {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #ebedf0;
}

.log-detail-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebedf0;
}

.log-detail-section:last-child {
  border-bottom: none;
}

.log-detail-subtitle {
  font-size: 16px;
  font-weight: 600;
  color: #646566;
  margin: 0 0 12px 0;
}

.error-title {
  color: #ee0a24;
}

.log-detail-row {
  display: flex;
  margin-bottom: 12px;
  line-height: 1.6;
}

.log-detail-row.full-width {
  flex-direction: column;
}

.log-detail-label {
  min-width: 140px;
  font-weight: 600;
  color: #646566;
  flex-shrink: 0;
}

.log-detail-value {
  color: #323233;
  word-break: break-word;
  flex: 1;
}

.log-detail-value.monospace {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.error-text {
  color: #ee0a24;
  font-weight: 500;
}

.log-detail-stack {
  background: #f7f8fa;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #ee0a24;
  overflow-x: auto;
  margin: 8px 0 0 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.log-detail-json {
  background: #f7f8fa;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #323233;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
