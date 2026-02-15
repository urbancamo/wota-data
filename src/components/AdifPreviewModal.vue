<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {showNotify, showDialog} from 'vant'
import type {AdifRecord, ParsedAdif, Summit} from '../types/adif'
import {extractWotaId} from '../services/adifService'
import {formatWotaReference, parseWotaReference} from '../utils/wotaReference'
import {apiClient} from '../services/api'

const props = defineProps<{
  parsedData: ParsedAdif | null
  show: boolean
  importErrors?: Array<{ record: number; reason: string }>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const isImporting = ref(false)
const activeErrorPanel = ref<string[]>([])
const editableRecords = ref<Map<number, string>>(new Map())
const duplicateFlags = ref<boolean[]>([])
const possibleDuplicateFlags = ref<boolean[]>([])

// Autocomplete state
const summits = ref<Summit[]>([])
const autocompleteActive = ref<number | null>(null)
const autocompleteMatches = ref<Summit[]>([])
const autocompleteInput = ref('')

const displayRecords = computed(() => {
  if (!props.parsedData) return []
  // Show first 100 records max for performance
  return props.parsedData.records.slice(0, 100)
})

function updateWotaReference(index: number, value: string) {
  editableRecords.value.set(index, value)
}

async function copyReferenceToSubsequent(fromIndex: number) {
  if (!props.parsedData) return

  const fromRecord = props.parsedData.records[fromIndex]
  if (!fromRecord) return

  const fromValue = getSummit(fromRecord, fromIndex)

  if (!fromValue) {
    showNotify({
      type: 'warning',
      message: 'Please enter a WOTA reference in this field first',
    })
    return
  }

  // Parse and validate the reference
  let wotaId: number | null = null
  wotaId = parseWotaReference(fromValue)
  if (wotaId === null) {
    wotaId = extractWotaId(fromValue)
  }
  if (wotaId === null) {
    const parsed = parseInt(fromValue, 10)
    if (!isNaN(parsed)) {
      wotaId = parsed
    }
  }

  if (wotaId === null) {
    showNotify({
      type: 'warning',
      message: 'Invalid WOTA reference format',
    })
    return
  }

  // Format the reference properly
  const formattedRef = formatWotaReference(wotaId)

  let copiedCount = 0

  // Copy to this field and all subsequent records without original WOTA references
  props.parsedData.records.forEach((record, index) => {
    if (index >= fromIndex && !hasOriginalSummit(record)) {
      editableRecords.value.set(index, wotaId!.toString())
      copiedCount++
    }
  })

  showNotify({
    type: 'success',
    message: `Copied "${formattedRef}" to ${copiedCount} field${copiedCount !== 1 ? 's' : ''}`,
  })

  // Re-check duplicates after copying
  await checkDuplicates()
}

const hasMoreRecords = computed(() => {
  return (props.parsedData?.records.length || 0) > 100
})

const recordsWithoutSummit = computed(() => {
  if (!props.parsedData) return 0
  return props.parsedData.records.filter((record, index) => {
    // Check if there's an original summit or a manually edited value
    const hasOriginal = hasSummit(record)
    const hasEdited = editableRecords.value.has(index) && editableRecords.value.get(index)
    return !hasOriginal && !hasEdited
  }).length
})

const duplicateCount = computed(() => {
  return duplicateFlags.value.filter(d => d).length
})

const possibleDuplicateCount = computed(() => {
  return possibleDuplicateFlags.value.filter(d => d).length
})

const failedRecordIndices = computed(() => {
  if (!props.importErrors) return new Set<number>()
  return new Set(props.importErrors.map(e => e.record))
})

const failedCount = computed(() => {
  return props.importErrors?.length || 0
})

function formatDate(adifDate?: string): string {
  if (!adifDate) return '-'
  const year = adifDate.substring(0, 4)
  const month = adifDate.substring(4, 6)
  const day = adifDate.substring(6, 8)
  return `${day}/${month}/${year}`
}

function formatTime(adifTime?: string): string {
  if (!adifTime) return '-'
  const timeStr = adifTime.padEnd(6, '0')
  const hours = timeStr.substring(0, 2)
  const minutes = timeStr.substring(2, 4)
  return `${hours}:${minutes}`
}

function getWotaSigInfo(record: AdifRecord): string | undefined {
  // Only return sig_info values where the SIG field is WOTA (not BOTA, POTA, etc.)
  const mySigInfo = record.my_sig?.toUpperCase() === 'WOTA' ? record.my_sig_info : undefined
  const sigInfo = record.sig?.toUpperCase() === 'WOTA' ? record.sig_info : undefined
  return mySigInfo || sigInfo
}

function getSummit(record: AdifRecord, index: number): string {
  // Check if user has edited this record
  const edited = editableRecords.value.get(index)
  if (edited) return edited

  // IMPORTANT: my_sig_info is the activator's summit, sig_info is the contacted station's summit (S2S)
  const sigInfo = getWotaSigInfo(record)
  if (!sigInfo) return ''

  // First try to parse as a formatted WOTA reference (e.g., "LDO-093")
  const parsedWotaId = parseWotaReference(sigInfo)
  if (parsedWotaId !== null) {
    return parsedWotaId.toString()
  }

  // Fall back to extracting just the number
  const id = extractWotaId(sigInfo)
  return id ? id.toString() : ''
}

function getFormattedWotaReference(record: AdifRecord, index: number): string {
  // Get the raw value (either edited or from record)
  const rawValue = getSummit(record, index)
  if (!rawValue) return '-'

  // Try to parse it as a number or extract from formatted string
  let wotaId: number | null

  // First try to parse as a WOTA reference (e.g., "LDW-001")
  wotaId = parseWotaReference(rawValue)

  // If that didn't work, try to extract the number
  if (wotaId === null) {
    wotaId = extractWotaId(rawValue)
  }

  // If we still don't have a number, try parsing as plain number
  if (wotaId === null) {
    const parsed = parseInt(rawValue, 10)
    if (!isNaN(parsed)) {
      wotaId = parsed
    }
  }

  return formatWotaReference(wotaId)
}

function hasSummit(record: AdifRecord): boolean {
  // Only check the ORIGINAL record data, not edited values
  // my_sig_info is the activator's summit, sig_info is the contacted station's summit (S2S)
  const id = extractWotaId(getWotaSigInfo(record))
  return id !== null
}

function hasOriginalSummit(record: AdifRecord): boolean {
  // my_sig_info is the activator's summit, sig_info is the contacted station's summit (S2S)
  const id = extractWotaId(getWotaSigInfo(record))
  return id !== null
}

function hasValidSummit(record: AdifRecord, index: number): boolean {
  // Check if there's an original summit or a manually edited value
  const hasOriginal = hasSummit(record)
  const hasEdited = editableRecords.value.has(index) && editableRecords.value.get(index)
  return hasOriginal || !!hasEdited
}

function isConvertedFromSota(record: AdifRecord): boolean {
  // Check if this was auto-converted from SOTA
  // Only records that have MY_SOTA_REF are SOTA conversions
  return !!(record.my_sota_ref)
}

function handleClose() {
  if (isImporting.value) return
  emit('close')
}

async function handleConfirm() {
  // Check for possible duplicates and show warning dialog
  if (possibleDuplicateCount.value > 0) {
    try {
      await showDialog({
        title: 'Possible Duplicates Detected',
        message: `${possibleDuplicateCount.value} record${possibleDuplicateCount.value !== 1 ? 's' : ''} may be duplicate${possibleDuplicateCount.value !== 1 ? 's' : ''} of existing records that have no band/mode information. Do you want to proceed with the import?`,
        showCancelButton: true,
        confirmButtonText: 'Import Anyway',
        cancelButtonText: 'Cancel',
      })
    } catch (error) {
      // User clicked cancel
      return
    }
  }

  // Update parsedData with manually entered WOTA references
  if (props.parsedData) {
    editableRecords.value.forEach((wotaId, index) => {
      if (props.parsedData!.records[index]) {
        // Add the manually entered WOTA ID to the record
        props.parsedData!.records[index].my_sig_info = wotaId
        props.parsedData!.records[index].my_sig = 'WOTA'
      }
    })
  }
  emit('confirm')
}

// Load summits function
async function loadSummits() {
  if (summits.value.length > 0) {
    console.log(`Summits already loaded: ${summits.value.length}`)
    return // Already loaded
  }

  try {
    console.log('Fetching summits from API...')
    const fetchedSummits = await apiClient.getSummits()
    console.log(`API returned ${fetchedSummits.length} summits`)
    summits.value = fetchedSummits

    if (summits.value.length > 0) {
      console.log('Sample summit:', summits.value[0])
    }
  } catch (error) {
    console.error('Failed to load summits:', error)
    showNotify({
      type: 'warning',
      message: 'Failed to load summit data. Summit names may not display correctly.',
    })
  }
}

// Check for duplicates
async function checkDuplicates() {
  if (!props.parsedData || props.parsedData.records.length === 0) {
    duplicateFlags.value = []
    possibleDuplicateFlags.value = []
    return
  }

  try {
    console.log('Checking for duplicate records...')
    // Import mapToActivatorLog to transform records
    const { mapToActivatorLog } = await import('../services/adifService')

    // Transform records and maintain original indices
    const transformedRecords = []
    const indexMapping: any[] = []

    for (let i = 0; i < props.parsedData.records.length; i++) {
      if (props.parsedData.records[i] === undefined) {
        continue;
      }
      const transformed =  mapToActivatorLog(props.parsedData.records[i])
      if (transformed !== null) {
        transformedRecords.push(transformed)
        indexMapping.push(i)
      }
    }

    // Check duplicates for transformed records
    const response = await apiClient.checkDuplicates(transformedRecords)

    // Map duplicate flags back to original record indices
    const dupFlags = new Array(props.parsedData.records.length).fill(false)
    const possDupFlags = new Array(props.parsedData.records.length).fill(false)

    response.duplicates.forEach((isDuplicate, transformedIndex) => {
      const originalIndex = indexMapping[transformedIndex]
      dupFlags[originalIndex] = isDuplicate
    })

    duplicateFlags.value = dupFlags
    possibleDuplicateFlags.value = possDupFlags

    const dupCount = dupFlags.filter(d => d).length
    const possDupCount = possDupFlags.filter(d => d).length

    if (dupCount > 0) {
      console.log(`Found ${dupCount} duplicate record(s)`)
    }
    if (possDupCount > 0) {
      console.log(`Found ${possDupCount} possible duplicate record(s)`)
    }
  } catch (error) {
    console.error('Failed to check for duplicates:', error)
    duplicateFlags.value = []
    possibleDuplicateFlags.value = []
  }
}

// Fetch summits on mount
onMounted(() => {
  loadSummits()
})

// Also load summits and check duplicates when modal is shown
watch(() => props.show, (isShown) => {
  if (isShown) {
    loadSummits()
    checkDuplicates()
  }
})

// Check duplicates when parsedData changes
watch(() => props.parsedData, () => {
  if (props.show) {
    checkDuplicates()
  }
})

// Autocomplete search function
function searchSummits(input: string): Summit[] {
  if (!input || input.length < 1) return []

  const searchTerm = input.trim().toUpperCase()

  // Check if input looks like a reference (starts with L or is a digit)
  const isReference = /^[L\d]/.test(searchTerm)

  return summits.value.filter((summit) => {
    if (isReference && searchTerm.length >= 1) {
      // Match against formatted reference or just the number
      const formattedRef = formatWotaReference(summit.wotaid)

      // Match formatted reference (e.g., "LDW-001" matches "L", "LD", "LDW", "LDW-", "LDW-0", etc.)
      if (formattedRef.toUpperCase().startsWith(searchTerm)) {
        return true
      }

      // Match raw wotaid number
      if (summit.wotaid.toString().startsWith(searchTerm)) {
        return true
      }

      // Match database reference field
      if (summit.reference.toUpperCase().includes(searchTerm)) {
        return true
      }
    }

    // Match against summit name (need at least 3 characters)
    if (!isReference && searchTerm.length >= 3) {
      return summit.name.toUpperCase().includes(searchTerm)
    }

    return false
  }).slice(0, 10) // Limit to 10 results
}

// Handle input change
function handleAutocompleteInput(index: number, value: string) {
  autocompleteInput.value = value
  autocompleteActive.value = index

  autocompleteMatches.value = searchSummits(value)

  // Update the editable record
  updateWotaReference(index, value)
}

// Select summit from autocomplete
async function selectSummit(index: number, summit: Summit) {
  editableRecords.value.set(index, summit.wotaid.toString())
  autocompleteActive.value = null
  autocompleteMatches.value = []

  // Re-check duplicates after selection
  await checkDuplicates()
}

// Close autocomplete
// Get summit name by wotaid
function getSummitName(record: AdifRecord, index: number): string {
  const rawValue = getSummit(record, index)
  if (!rawValue) return '-'

  // Try to parse as WOTA reference or number
  let wotaId: number | null = null

  wotaId = parseWotaReference(rawValue)
  if (wotaId === null) {
    wotaId = extractWotaId(rawValue)
  }
  if (wotaId === null) {
    const parsed = parseInt(rawValue, 10)
    if (!isNaN(parsed)) {
      wotaId = parsed
    }
  }

  if (wotaId === null) {
    console.warn('Could not parse wotaId from rawValue:', rawValue)
    return '-'
  }

  // Look up summit name
  const summit = summits.value.find(s => s.wotaid === wotaId)
  if (!summit) {
    console.warn(`Summit not found for wotaId ${wotaId}. Total summits: ${summits.value.length}`)
  }
  return summit?.name || '-'
}

// Get S2S reference (the contacted station's summit)
function getS2sReference(record: AdifRecord): string {
  // Only show S2S reference when the SIG field is WOTA
  if (record.sig?.toUpperCase() !== 'WOTA' || !record.sig_info) return '-'

  // Extract wotaId from sig_info (handles both formatted refs and plain numbers)
  const wotaId = extractWotaId(record.sig_info)
  if (wotaId !== null) {
    return formatWotaReference(wotaId)
  }

  // Return the raw reference if it can't be parsed
  return record.sig_info
}

// Get S2S summit name
function getS2sSummitName(record: AdifRecord): string {
  // Only show S2S summit name when the SIG field is WOTA
  if (record.sig?.toUpperCase() !== 'WOTA' || !record.sig_info) return ''

  // Extract wotaId from sig_info (handles both formatted refs and plain numbers)
  const wotaId = extractWotaId(record.sig_info)
  if (wotaId === null) return ''

  // Look up summit name
  const summit = summits.value.find(s => s.wotaid === wotaId)
  return summit?.name || ''
}
</script>

<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '90%' }"
    @click-overlay="handleClose"
  >
    <div class="preview-container">
      <div class="preview-header">
        <h3>{{ failedCount > 0 ? 'Import Failed - Review Errors' : 'Review Import' }}</h3>
        <p class="record-count">
          {{ parsedData?.records.length || 0 }} QSO records found
          <span v-if="parsedData?.errors.length" class="error-count">
            ({{ parsedData.errors.length }} errors)
          </span>
        </p>
        <p v-if="failedCount > 0" class="import-error-summary">
          {{ failedCount }} record{{ failedCount !== 1 ? 's' : '' }} failed to import. Please review the highlighted records below.
        </p>
      </div>

      <div v-if="parsedData?.errors.length" class="error-section">
        <van-collapse v-model="activeErrorPanel">
          <van-collapse-item title="View Errors" name="1">
            <div
              v-for="(error, index) in parsedData.errors"
              :key="index"
              class="error-item"
            >
              Record {{ error.recordIndex + 1 }}: {{ error.message }}
            </div>
          </van-collapse-item>
        </van-collapse>
      </div>

      <div class="table-container">
        <table class="preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Time</th>
              <th>Call</th>
              <th>WOTA Ref</th>
              <th>Band</th>
              <th>Freq</th>
              <th>Mode</th>
              <th>S2S</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(record, index) in displayRecords"
              :key="index"
              :class="{
                'missing-summit': !hasValidSummit(record, index),
                'duplicate-record': duplicateFlags[index],
                'possible-duplicate-record': possibleDuplicateFlags[index] && !duplicateFlags[index],
                'failed-record': failedRecordIndices.has(index)
              }"
            >
              <td class="qso-number">{{ String(index + 1).padStart(4, '0') }}</td>
              <td>{{ formatDate(record.qso_date) }}</td>
              <td>{{ formatTime(record.time_on) }}</td>
              <td>
                {{ record.call || '-' }}
                <span v-if="failedRecordIndices.has(index)" class="failed-indicator" :title="importErrors?.find(e => e.record === index)?.reason || 'Import failed'">FAILED</span>
                <span v-else-if="duplicateFlags[index]" class="duplicate-indicator" title="Duplicate record already exists in database">DUP</span>
                <span v-else-if="possibleDuplicateFlags[index]" class="possible-duplicate-indicator" title="Possible duplicate - database record has no band/mode">?</span>
              </td>
              <td class="summit-cell">
                <div class="summit-input-wrapper">
                  <div v-if="!hasOriginalSummit(record)" class="input-with-button">
                    <div class="autocomplete-container">
                      <input
                        type="text"
                        class="summit-input"
                        :value="getSummit(record, index)"
                        @input="handleAutocompleteInput(index, ($event.target as HTMLInputElement).value)"
                        @focus="handleAutocompleteInput(index, getSummit(record, index))"
                        placeholder="e.g. LDW-001 or Scafell"
                      />

                      <!-- Autocomplete dropdown -->
                      <div
                        v-if="autocompleteActive === index && autocompleteMatches.length > 0"
                        class="autocomplete-dropdown"
                      >
                        <div
                          v-for="summit in autocompleteMatches"
                          :key="summit.wotaid"
                          class="autocomplete-item"
                          @click="selectSummit(index, summit)"
                        >
                          <div class="autocomplete-ref">{{ formatWotaReference(summit.wotaid) }}</div>
                          <div class="autocomplete-name">{{ summit.name }}</div>
                        </div>
                      </div>
                    </div>

                    <van-button
                      size="mini"
                      type="primary"
                      class="copy-button"
                      icon="arrow-down"
                      @click="copyReferenceToSubsequent(index)"
                    />
                  </div>
                  <span v-else class="formatted-reference">
                    {{ getFormattedWotaReference(record, index) }}
                    <span v-if="isConvertedFromSota(record)" class="sota-indicator" title="Auto-converted from SOTA">SOTA</span>
                  </span>
                </div>
                <div class="summit-name">{{ getSummitName(record, index) }}</div>
              </td>
              <td>{{ record.band || '-' }}</td>
              <td>{{ record.freq || '-' }}</td>
              <td>{{ record.mode || '-' }}</td>
              <td class="s2s-cell">
                <div class="s2s-reference">{{ getS2sReference(record) }}</div>
                <div v-if="getS2sSummitName(record)" class="summit-name">{{ getS2sSummitName(record) }}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="hasMoreRecords" class="more-records-notice">
          Showing first 100 of {{ parsedData?.records.length }} records
        </div>
      </div>

      <!-- Import warnings and errors -->
      <div v-if="recordsWithoutSummit > 0 || duplicateCount > 0 || possibleDuplicateCount > 0 || failedCount > 0" class="import-warnings">
        <div v-if="failedCount > 0" class="warning-item failed-warning">
          <van-icon name="close-o" />
          <span>{{ failedCount }} record{{ failedCount !== 1 ? 's' : '' }} failed to import (see highlighted rows)</span>
        </div>
        <div v-if="recordsWithoutSummit > 0" class="warning-item missing-warning">
          <van-icon name="warning-o" />
          <span>{{ recordsWithoutSummit }} record{{ recordsWithoutSummit !== 1 ? 's' : '' }} without valid WOTA reference will be skipped</span>
        </div>
        <div v-if="duplicateCount > 0" class="warning-item duplicate-warning">
          <van-icon name="warning-o" />
          <span>{{ duplicateCount }} duplicate record{{ duplicateCount !== 1 ? 's' : '' }} will be skipped</span>
        </div>
        <div v-if="possibleDuplicateCount > 0" class="warning-item possible-duplicate-warning">
          <van-icon name="info-o" />
          <span>{{ possibleDuplicateCount }} possible duplicate{{ possibleDuplicateCount !== 1 ? 's' : '' }} (database has no band/mode)</span>
        </div>
      </div>

      <div class="action-buttons">
        <van-button block @click="handleClose">
          Cancel
        </van-button>
        <van-button
          type="primary"
          block
          :loading="isImporting"
          @click="handleConfirm"
        >
          Confirm Import
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
  padding: 20px 16px 16px;
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

.import-error-summary {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #ee0a24;
  font-weight: 500;
}

.error-count {
  color: #ee0a24;
  font-weight: 500;
}

.error-section {
  padding: 12px 16px;
  background: #fff7f0;
  border-bottom: 1px solid #eee;
}

.error-item {
  padding: 4px 0;
  font-size: 13px;
  color: #ee0a24;
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

.preview-table tbody tr.missing-summit {
  background: #fff7f0;
}

.summit-cell {
  min-width: 160px;
  position: relative;
}

.summit-name {
  color: #666;
  font-size: 11px;
  margin-top: 2px;
  font-style: italic;
}

.s2s-cell {
  min-width: 120px;
}

.qso-number {
  font-family: monospace;
  font-weight: 600;
  color: #969799;
  text-align: center;
}

.s2s-reference {
  font-weight: 600;
  color: #1989fa;
  font-family: monospace;
}

.summit-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-with-button {
  display: flex;
  gap: 4px;
  align-items: flex-start;
}

.autocomplete-container {
  position: relative;
  flex: 1;
}

.summit-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ee0a24;
  border-radius: 4px;
  font-size: 13px;
  background: white;
}

.summit-input:focus {
  outline: none;
  border-color: #1989fa;
}

.copy-button {
  flex-shrink: 0;
  min-width: 32px;
}

.formatted-reference {
  font-weight: 600;
  color: #1989fa;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 6px;
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
}

.duplicate-indicator {
  font-size: 9px;
  font-weight: 600;
  color: white;
  background: #ee0a24;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: sans-serif;
  letter-spacing: 1px;
  margin-left: 6px;
}

.duplicate-record {
  background-color: #fff1f0;
}

.duplicate-record:hover {
  background-color: #ffe7e5;
}

.failed-record {
  background-color: #ffe7e5;
  border-left: 3px solid #ee0a24;
}

.failed-record:hover {
  background-color: #ffd6d3;
}

.failed-indicator {
  font-size: 9px;
  font-weight: 600;
  color: white;
  background: #ee0a24;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: sans-serif;
  letter-spacing: 1px;
  margin-left: 6px;
}

.failed-warning {
  color: #ee0a24;
}

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #1989fa;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 2px;
}

.autocomplete-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.autocomplete-item:hover {
  background: #f7f8fa;
}

.autocomplete-ref {
  font-weight: 600;
  color: #1989fa;
  font-family: monospace;
  font-size: 12px;
  margin-bottom: 2px;
}

.autocomplete-name {
  font-size: 11px;
  color: #666;
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

.missing-warning {
  color: #d46b08;
}

.duplicate-warning {
  color: #d46b08;
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
