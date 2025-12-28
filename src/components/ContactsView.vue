<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { showNotify } from 'vant'
import { apiClient } from '../services/api'
import { formatWotaReference } from '../utils/wotaReference'

const props = defineProps<{
  contactType: 'activator' | 'chaser'
}>()

const contacts = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalRecords = ref(0)
const pageSize = ref(20)
const availableYears = ref<number[]>([])
const selectedYear = ref<number | null>(null)
const sortOrder = ref<'asc' | 'desc'>('desc')
const containerRef = ref<HTMLElement | null>(null)
const filterSectionRef = ref<HTMLElement | null>(null)
const paginationRef = ref<HTMLElement | null>(null)

// Compute dropdown options for year filter
const yearOptions = computed(() => {
  const options = [
    { text: 'All Years', value: null }
  ]

  availableYears.value.forEach(year => {
    options.push({ text: year.toString(), value: year })
  })

  return options
})

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

function calculatePageSize() {
  if (!containerRef.value) return

  // Get viewport height
  const viewportHeight = window.innerHeight

  // Calculate heights of fixed elements
  const filterHeight = filterSectionRef.value?.offsetHeight || 0
  const paginationHeight = paginationRef.value?.offsetHeight || 0

  // Account for: navbar (46px), tabs (44px), contacts-view padding-top (8px),
  // container padding (32px total), table header (~30px), and some buffer (10px)
  const fixedHeights = 46 + 44 + 8 + 32 + 30 + 10 + filterHeight + paginationHeight

  // Calculate available height for table body
  const availableHeight = viewportHeight - fixedHeights

  // Each row is approximately: 6px top padding + 6px bottom padding + ~20px content = ~32px
  const rowHeight = 32

  // Calculate how many rows can fit (minimum 10, maximum 100)
  const calculatedSize = Math.floor(availableHeight / rowHeight)
  const newPageSize = Math.max(10, Math.min(100, calculatedSize))

  // Only update if significantly different (avoid unnecessary reloads)
  if (Math.abs(pageSize.value - newPageSize) > 2) {
    pageSize.value = newPageSize
  }
}

let resizeTimeout: number | null = null
function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = window.setTimeout(() => {
    calculatePageSize()
  }, 250)
}

async function loadContacts() {
  try {
    loading.value = true
    const result = props.contactType === 'activator'
      ? await apiClient.getActivatorContacts(currentPage.value, pageSize.value, selectedYear.value || undefined, sortOrder.value)
      : await apiClient.getChaserContacts(currentPage.value, pageSize.value, selectedYear.value || undefined, sortOrder.value)

    contacts.value = result.contacts
    totalPages.value = result.pagination.totalPages
    totalRecords.value = result.pagination.total
    availableYears.value = result.availableYears || []
  } catch (error) {
    console.error(`Error loading ${props.contactType} contacts:`, error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to load contacts',
    })
  } finally {
    loading.value = false
  }
}

// Watch for page changes
watch(currentPage, () => {
  loadContacts()
})

// Watch for pageSize changes
watch(pageSize, () => {
  currentPage.value = 1
  loadContacts()
})

// Watch for year filter changes
watch(selectedYear, () => {
  currentPage.value = 1
  loadContacts()
})

// Watch for sort order changes
watch(sortOrder, () => {
  currentPage.value = 1
  loadContacts()
})

// Reload when contact type changes
watch(() => props.contactType, () => {
  currentPage.value = 1
  selectedYear.value = null
  sortOrder.value = 'desc'
  loadContacts()
})

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(time: Date | string | null): string {
  if (!time) return '-'
  const t = typeof time === 'string' ? new Date(time) : time
  return t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatFrequency(frequency: number | null): string {
  if (!frequency) return '-'
  return frequency.toFixed(3)
}

onMounted(() => {
  // Calculate initial page size
  setTimeout(() => {
    calculatePageSize()
  }, 100)

  // Add resize listener
  window.addEventListener('resize', handleResize)

  loadContacts()
})

onUnmounted(() => {
  // Clean up resize listener
  window.removeEventListener('resize', handleResize)
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
})
</script>

<template>
  <div class="contacts-view">
    <div class="contacts-container" ref="containerRef">
      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" size="24" />
        <div class="loading-text">Loading contacts...</div>
      </div>

      <div v-else-if="contacts.length === 0" class="empty-state">
        <van-empty description="No contacts found" />
      </div>

      <div v-else>
        <div class="filter-section" ref="filterSectionRef">
          <div v-if="availableYears.length > 0" class="filter-group">
            <div class="filter-label">Filter by Year:</div>
            <van-dropdown-menu>
              <van-dropdown-item v-model="selectedYear" :options="yearOptions" />
            </van-dropdown-menu>
          </div>
          <div class="filter-group">
            <div class="filter-label">Sort Order:</div>
            <van-button
              size="small"
              :icon="sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'"
              @click="toggleSortOrder"
            >
              {{ sortOrder === 'desc' ? 'Newest First' : 'Oldest First' }}
            </van-button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="contacts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Call</th>
                <th>WOTA Ref</th>
                <th>Summit</th>
                <template v-if="contactType === 'activator'">
                  <th>Band</th>
                  <th>Freq</th>
                  <th>Mode</th>
                  <th>S2S</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="contact in contacts" :key="contact.id">
                <td>{{ formatDate(contact.date) }}</td>
                <td>{{ formatTime(contact.time) }}</td>
                <td class="callsign">{{ contact.stncall }}</td>
                <td class="wota-ref">{{ formatWotaReference(contact.wotaid) }}</td>
                <td class="summit-name">{{ contact.summitName || 'Unknown' }}</td>
                <template v-if="contactType === 'activator'">
                  <td>{{ contact.band || '-' }}</td>
                  <td>{{ formatFrequency(contact.frequency) }}</td>
                  <td>{{ contact.mode || '-' }}</td>
                  <td class="s2s-cell">
                    <van-tag v-if="contact.s2s" type="success">S2S</van-tag>
                    <span v-else>-</span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-wrapper" ref="paginationRef">
          <div class="pagination-info">
            Showing {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, totalRecords) }} of {{ totalRecords }} contacts
          </div>
          <div class="pagination-controls">
            <van-button
              size="small"
              :disabled="currentPage === 1"
              @click="currentPage = 1"
            >
              First
            </van-button>
            <van-pagination
              v-model="currentPage"
              :total-items="totalRecords"
              :items-per-page="pageSize"
              :show-page-size="5"
              force-ellipses
            />
            <van-button
              size="small"
              :disabled="currentPage === totalPages"
              @click="currentPage = totalPages"
            >
              Last
            </van-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contacts-view {
  padding-top: 8px;
}

.contacts-container {
  padding: 16px;
}

.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  white-space: nowrap;
}

.table-wrapper {
  overflow-x: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.contacts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.contacts-table thead {
  background: #f7f8fa;
}

.contacts-table th {
  padding: 6px 8px;
  text-align: left;
  font-weight: 600;
  color: #323233;
  border-bottom: 2px solid #ebedf0;
  white-space: nowrap;
}

.contacts-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #ebedf0;
  color: #646566;
}

.contacts-table tbody tr:hover {
  background: #f7f8fa;
}

.callsign {
  font-family: monospace;
  font-weight: 600;
  color: #323233;
}

.wota-ref {
  font-family: monospace;
  font-weight: 600;
  color: #1989fa;
  white-space: nowrap;
}

.summit-name {
  color: #323233;
}

.s2s-cell {
  text-align: center;
}

.loading-container {
  text-align: center;
  padding: 40px 20px;
}

.loading-text {
  margin-top: 8px;
  color: #666;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.pagination-wrapper {
  padding: 20px 16px;
  background: white;
  border-radius: 0 0 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination-info {
  font-size: 14px;
  color: #646566;
}

@media (max-width: 768px) {
  .contacts-container {
    padding: 8px;
  }

  .filter-section {
    padding: 8px 12px;
    gap: 12px;
  }

  .filter-group {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-label {
    font-size: 12px;
  }

  .contacts-table {
    font-size: 12px;
  }

  .contacts-table th,
  .contacts-table td {
    padding: 4px 4px;
  }

  .pagination-info {
    font-size: 12px;
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
