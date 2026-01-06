<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import type {ChaserImportRecord, Summit} from '../types/adif'
import {formatWotaReference} from '../utils/wotaReference'
import {apiClient} from '../services/api'

const props = defineProps<{
  records: ChaserImportRecord[]
  show: boolean
  totalRecords: number
  validRecords: number
  invalidRecords: number
  duplicateRecords: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', validRecords: ChaserImportRecord[]): void
}>()

const summits = ref<Summit[]>([])

const displayRecords = computed(() => {
  // Show first 100 records max for performance
  return props.records.slice(0, 100)
})

const hasMoreRecords = computed(() => {
  return props.records.length > 100
})

const validImportableRecords = computed(() => {
  return props.validRecords - props.duplicateRecords
})

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return dateStr
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '-'
  // Time is already in HH:MM:SS format from parsing
  const parts = timeStr.split(':')
  return `${parts[0]}:${parts[1]}`
}

function getFormattedWotaReference(record: ChaserImportRecord): string {
  if (!record.wotaid) return record.wotaRef || '-'
  return formatWotaReference(record.wotaid)
}

function getDisplayReference(record: ChaserImportRecord): string {
  const wotaRef = getFormattedWotaReference(record)
  if (record.sotaRef) {
    return `${record.sotaRef} → ${wotaRef}`
  }
  return wotaRef
}

function isConvertedFromSota(record: ChaserImportRecord): boolean {
  return !!record.sotaRef
}

function getSummitName(record: ChaserImportRecord): string {
  if (!record.wotaid) return '-'

  const summit = summits.value.find(s => s.wotaid === record.wotaid)
  return summit?.name || '-'
}

function handleClose() {
  emit('close')
}

function handleConfirm() {
  // Emit only valid, non-duplicate records
  const validRecords = props.records.filter(r => r.isValid && !r.isDuplicate)
  emit('confirm', validRecords)
}

// Load summits function
async function loadSummits() {
  if (summits.value.length > 0) {
    return // Already loaded
  }

  try {
    summits.value = await apiClient.getSummits()
  } catch (error) {
    console.error('Failed to load summits:', error)
  }
}

// Fetch summits on mount
onMounted(() => {
  console.log('ChaserAdifPreviewModal mounted')
  console.log('Initial show value:', props.show)
  console.log('Initial records count:', props.records.length)
  loadSummits()
})

// Load summits when modal is shown
watch(() => props.show, (isShown) => {
  console.log('ChaserAdifPreviewModal show changed:', isShown)
  console.log('Records count:', props.records.length)
  console.log('Stats:', {
    total: props.totalRecords,
    valid: props.validRecords,
    invalid: props.invalidRecords,
    duplicates: props.duplicateRecords
  })
  if (isShown) {
    loadSummits()
  }
})
</script>

<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '90%' }"
    :teleport="'body'"
    :z-index="3000"
    @click-overlay="handleClose"
  >
    <div class="preview-container">
      <div class="preview-header">
        <h3>Review Chaser Import</h3>
        <p class="record-count">
          {{ totalRecords }} chaser QSO{{ totalRecords !== 1 ? 's' : '' }} found
        </p>
      </div>

      <div class="stats-section">
        <van-tag type="primary">Total: {{ totalRecords }}</van-tag>
        <van-tag type="success">Valid: {{ validRecords }}</van-tag>
        <van-tag v-if="invalidRecords > 0" type="danger">Invalid: {{ invalidRecords }}</van-tag>
        <van-tag v-if="duplicateRecords > 0" type="warning">Duplicates: {{ duplicateRecords }}</van-tag>
      </div>

      <div class="table-container">
        <table class="preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Time</th>
              <th>My Call</th>
              <th>Worked</th>
              <th>WOTA Ref</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(record, index) in displayRecords"
              :key="index"
              :class="{
                'invalid-record': !record.isValid,
                'duplicate-record': record.isDuplicate && record.isValid
              }"
            >
              <td class="qso-number">{{ String(index + 1).padStart(4, '0') }}</td>
              <td>{{ formatDate(record.date) }}</td>
              <td>{{ formatTime(record.time) }}</td>
              <td>{{ record.ucall || '-' }}</td>
              <td>{{ record.stncall || '-' }}</td>
              <td class="summit-cell">
                <div class="formatted-reference">
                  {{ getDisplayReference(record) }}
                  <span v-if="isConvertedFromSota(record)" class="sota-indicator" title="Auto-converted from SOTA">SOTA</span>
                </div>
                <div class="summit-name">{{ getSummitName(record) }}</div>
              </td>
              <td>
                <van-tag v-if="!record.isValid" type="danger">Invalid</van-tag>
                <van-tag v-else-if="record.isDuplicate" type="warning">Duplicate</van-tag>
                <van-tag v-else type="success">OK</van-tag>
                <div v-if="record.validationErrors.length > 0" class="validation-errors">
                  <small v-for="(error, i) in record.validationErrors" :key="i">
                    {{ error }}
                  </small>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="hasMoreRecords" class="more-records-notice">
          Showing first 100 of {{ totalRecords }} records
        </div>
      </div>

      <!-- Import warnings -->
      <div v-if="invalidRecords > 0 || duplicateRecords > 0" class="import-warnings">
        <div v-if="invalidRecords > 0" class="warning-item invalid-warning">
          <van-icon name="close-o" />
          <span>{{ invalidRecords }} invalid record{{ invalidRecords !== 1 ? 's' : '' }} will be skipped</span>
        </div>
        <div v-if="duplicateRecords > 0" class="warning-item duplicate-warning">
          <van-icon name="warning-o" />
          <span>{{ duplicateRecords }} duplicate record{{ duplicateRecords !== 1 ? 's' : '' }} will be skipped</span>
        </div>
      </div>

      <div class="help-text">
        <p><strong>Import Behavior:</strong></p>
        <ul>
          <li>✓ Valid records with SIG=WOTA and valid WOTA references will be imported</li>
          <li>✓ Valid records with SIG=SOTA and valid G/LD-xxx SOTA references will be auto-converted to WOTA and imported</li>
          <li>✗ Invalid records (missing fields, invalid SIG, or bad references) will be excluded</li>
          <li>✗ Duplicate records (already in your chaser log) will be skipped</li>
        </ul>
      </div>

      <!-- Import summary -->
      <div v-if="validImportableRecords > 0" class="import-summary">
        <van-icon name="success" color="#07c160" />
        <span class="summary-text">
          <strong>{{ validImportableRecords }}</strong> valid record{{ validImportableRecords !== 1 ? 's' : '' }} ready to import
        </span>
      </div>
      <div v-else class="import-summary warning">
        <van-icon name="warning-o" color="#ee0a24" />
        <span class="summary-text">
          No valid records to import
        </span>
      </div>

      <div class="action-buttons">
        <van-button block @click="handleClose">
          Cancel
        </van-button>
        <van-button
          type="primary"
          block
          :disabled="validImportableRecords === 0"
          @click="handleConfirm"
        >
          Import {{ validImportableRecords }} Record{{ validImportableRecords !== 1 ? 's' : '' }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.preview-header {
  padding: 20px 16px 12px;
  border-bottom: 1px solid #eee;
}

.preview-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.record-count {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.stats-section {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  flex-wrap: wrap;
  background: #f7f8fa;
  border-bottom: 1px solid #eee;
}

.table-container {
  flex: 1;
  overflow: auto;
  padding: 0 16px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.preview-table thead {
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
}

.preview-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #eee;
  background: #f7f8fa;
}

.preview-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #f0f0f0;
}

.preview-table tbody tr:hover {
  background: #f7f8fa;
}

.invalid-record {
  background-color: #fff1f0;
}

.invalid-record:hover {
  background-color: #ffe7e5;
}

.duplicate-record {
  background-color: #fff7e6;
}

.duplicate-record:hover {
  background-color: #ffedd4;
}

.qso-number {
  font-family: monospace;
  font-weight: 600;
  color: #969799;
  text-align: center;
}

.summit-cell {
  min-width: 160px;
}

.formatted-reference {
  font-weight: 600;
  color: #1989fa;
  font-family: monospace;
}

.summit-name {
  color: #666;
  font-size: 11px;
  margin-top: 2px;
  font-style: italic;
}

.sota-indicator {
  font-size: 9px;
  font-weight: 600;
  color: white;
  background: #07c160;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: sans-serif;
  letter-spacing: 1px;
  margin-left: 6px;
}

.validation-errors {
  margin-top: 4px;
}

.validation-errors small {
  display: block;
  color: #ee0a24;
  font-size: 10px;
}

.more-records-notice {
  padding: 12px 0;
  text-align: center;
  font-size: 13px;
  color: #666;
  font-style: italic;
}

.import-warnings {
  padding: 12px 16px;
  background: #fff7e6;
  border-top: 1px solid #ffe7ba;
  border-bottom: 1px solid #ffe7ba;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 0;
}

.invalid-warning {
  color: #ee0a24;
}

.duplicate-warning {
  color: #d46b08;
}

.help-text {
  padding: 12px 16px;
  background: #f0f9ff;
  border-radius: 4px;
  font-size: 13px;
  margin: 0 16px 12px;
}

.help-text p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.help-text ul {
  margin: 0;
  padding-left: 20px;
}

.help-text li {
  margin: 4px 0;
  line-height: 1.5;
}

.import-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin: 0 16px 12px;
  background: #f0fdf4;
  border: 2px solid #07c160;
  border-radius: 8px;
  font-size: 15px;
}

.import-summary.warning {
  background: #fff1f0;
  border-color: #ee0a24;
}

.import-summary .summary-text {
  flex: 1;
}

.import-summary strong {
  font-size: 18px;
  color: #07c160;
}

.import-summary.warning strong {
  color: #ee0a24;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #eee;
  background: white;
}

.action-buttons > * {
  flex: 0 1 200px;
  max-width: 200px;
}

@media (max-width: 480px) {
  .action-buttons {
    flex-direction: column;
  }

  .action-buttons > * {
    flex: 1;
    max-width: none;
  }
}
</style>
