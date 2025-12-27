<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
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
const pageSize = 25

async function loadContacts() {
  try {
    loading.value = true
    const result = props.contactType === 'activator'
      ? await apiClient.getActivatorContacts(currentPage.value, pageSize)
      : await apiClient.getChaserContacts(currentPage.value, pageSize)

    contacts.value = result.contacts
    totalPages.value = result.pagination.totalPages
    totalRecords.value = result.pagination.total
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

// Reload when contact type changes
watch(() => props.contactType, () => {
  currentPage.value = 1
  loadContacts()
})

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString()
}

function formatTime(time: Date | string | null): string {
  if (!time) return '-'
  const t = typeof time === 'string' ? new Date(time) : time
  return t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadContacts()
})
</script>

<template>
  <div class="contacts-view">
    <div class="contacts-container">
      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" size="24" />
        <div class="loading-text">Loading contacts...</div>
      </div>

      <div v-else-if="contacts.length === 0" class="empty-state">
        <van-empty description="No contacts found" />
      </div>

      <div v-else>
        <div class="table-wrapper">
          <table class="contacts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Call</th>
                <th>Summit</th>
                <template v-if="contactType === 'activator'">
                  <th>Band</th>
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
                <td class="summit-cell">
                  <div class="summit-name">{{ contact.summitName || 'Unknown' }}</div>
                  <div class="summit-ref">{{ formatWotaReference(contact.wotaid) }}</div>
                </td>
                <template v-if="contactType === 'activator'">
                  <td>{{ contact.band || '-' }}</td>
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

        <div class="pagination-wrapper">
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
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: #323233;
  border-bottom: 2px solid #ebedf0;
  white-space: nowrap;
}

.contacts-table td {
  padding: 12px 8px;
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

.summit-cell {
  min-width: 150px;
}

.summit-name {
  font-weight: 500;
  color: #323233;
  margin-bottom: 2px;
}

.summit-ref {
  font-size: 12px;
  color: #1989fa;
  font-family: monospace;
  font-weight: 600;
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

  .contacts-table {
    font-size: 12px;
  }

  .contacts-table th,
  .contacts-table td {
    padding: 8px 4px;
  }

  .summit-cell {
    min-width: 120px;
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
