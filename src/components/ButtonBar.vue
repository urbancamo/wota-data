<script setup lang="ts">
import { ref } from 'vue'
import { showNotify, showDialog, showLoadingToast, closeToast } from 'vant'
import { parseAdifFile, calculateStatistics as calculateAdifStatistics, parseChaserAdifFile, validateChaserWotaRefs, checkChaserDuplicates } from '../services/adifService'
import { parseCsvFile, calculateStatistics as calculateCsvStatistics, parseChaserCsvFile } from '../services/csvService'
import type { ParsedAdif, ChaserImportRecord, ChaserImportResult } from '../types/adif'
import ChaserAdifPreviewModal from './ChaserAdifPreviewModal.vue'

const emit = defineEmits<{
  (e: 'adifParsed', data: ParsedAdif): void
  (e: 'chaserImportComplete'): void
}>()

const adifFileInput = ref<HTMLInputElement | null>(null)
const csvFileInput = ref<HTMLInputElement | null>(null)
const chaserAdifFileInput = ref<HTMLInputElement | null>(null)
const chaserCsvFileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)

// Chaser import state
const showChaserPreview = ref(false)
const chaserImportRecords = ref<ChaserImportRecord[]>([])
const chaserImportStats = ref({
  total: 0,
  valid: 0,
  invalid: 0,
  duplicates: 0
})

function handleImportActivatorAdifClick() {
  adifFileInput.value?.click()
}

function handleImportActivatorCsvClick() {
  csvFileInput.value?.click()
}

function handleImportChaserAdifClick() {
  chaserAdifFileInput.value?.click()
}

function handleImportChaserCsvClick() {
  chaserCsvFileInput.value?.click()
}

async function handleAdifFileSelect(event: Event) {
  console.log('ADIF file select triggered')
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  console.log('Selected file:', file)

  if (!file) {
    console.log('No file selected')
    return
  }

  // Check file extension
  if (!file.name.match(/\.(adi|adif)$/i)) {
    console.log('Invalid file extension')
    showNotify({
      type: 'warning',
      message: 'Please select an ADIF file (.adi or .adif)',
    })
    return
  }

  console.log('Starting to process file:', file.name)
  isProcessing.value = true

  showLoadingToast({
    message: 'Parsing activator ADIF...',
    forbidClick: true,
    duration: 0,
  })

  try {
    const parsed = await parseAdifFile(file)
    const stats = calculateAdifStatistics(parsed.records, parsed.errors)

    console.log('Parsed ADIF:', parsed)
    console.log('Statistics:', stats)

    if (parsed.records.length === 0) {
      showNotify({
        type: 'danger',
        message: 'No records found in ADIF file',
      })
      return
    }

    if (stats.validRecords === 0) {
      showNotify({
        type: 'warning',
        message: `Found ${parsed.records.length} QSOs but none have WOTA summit references. Showing preview anyway.`,
        duration: 5000,
      })
    }

    // Always show preview if we have records
    emit('adifParsed', parsed)
  } catch (error) {
    console.error('ADIF parse error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to parse ADIF file',
    })
  } finally {
    closeToast()
    isProcessing.value = false
    // Reset file input
    if (target) target.value = ''
  }
}

async function handleCsvFileSelect(event: Event) {
  console.log('CSV file select triggered')
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  console.log('Selected file:', file)

  if (!file) {
    console.log('No file selected')
    return
  }

  // Check file extension
  if (!file.name.match(/\.csv$/i)) {
    console.log('Invalid file extension')
    showNotify({
      type: 'warning',
      message: 'Please select a CSV file (.csv)',
    })
    return
  }

  console.log('Starting to process file:', file.name)
  isProcessing.value = true

  showLoadingToast({
    message: 'Parsing activator CSV...',
    forbidClick: true,
    duration: 0,
  })

  try {
    const parsed = await parseCsvFile(file)
    const stats = calculateCsvStatistics(parsed.records, parsed.errors)

    console.log('Parsed CSV:', parsed)
    console.log('Statistics:', stats)

    if (parsed.records.length === 0) {
      showNotify({
        type: 'danger',
        message: 'No records found in CSV file',
      })
      return
    }

    if (stats.validRecords === 0) {
      showNotify({
        type: 'warning',
        message: `Found ${parsed.records.length} QSOs but none have WOTA summit references. Showing preview anyway.`,
        duration: 5000,
      })
    }

    // Always show preview if we have records
    emit('adifParsed', parsed)
  } catch (error) {
    console.error('CSV parse error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to parse CSV file',
    })
  } finally {
    closeToast()
    isProcessing.value = false
    // Reset file input
    if (target) target.value = ''
  }
}

async function handleChaserAdifFileSelect(event: Event) {
  console.log('Chaser ADIF file select triggered')
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    console.log('No file selected')
    return
  }

  // Check file extension
  if (!file.name.match(/\.(adi|adif)$/i)) {
    showNotify({
      type: 'warning',
      message: 'Please select an ADIF file (.adi or .adif)',
    })
    return
  }

  isProcessing.value = true

  showLoadingToast({
    message: 'Parsing chaser ADIF...',
    forbidClick: true,
    duration: 0,
  })

  try {
    // Parse file
    let result: ChaserImportResult = await parseChaserAdifFile(file)

    if (result.totalRecords === 0) {
      showNotify({
        type: 'danger',
        message: 'No records found in ADIF file',
      })
      return
    }

    showLoadingToast({
      message: 'Validating WOTA references...',
      forbidClick: true,
      duration: 0,
    })

    // Validate WOTA references
    try {
      result.records = await validateChaserWotaRefs(result.records)
      console.log('WOTA reference validation complete')
    } catch (validationError) {
      console.error('WOTA validation error:', validationError)
      // Continue with unvalidated records
    }

    showLoadingToast({
      message: 'Checking for duplicates...',
      forbidClick: true,
      duration: 0,
    })

    // Check for duplicates
    try {
      result.records = await checkChaserDuplicates(result.records)
      console.log('Duplicate check complete')
    } catch (duplicateError) {
      console.error('Duplicate check error:', duplicateError)
      // Continue without duplicate checking
    }

    // Update stats
    const validRecords = result.records.filter(r => r.isValid).length
    const duplicateCount = result.records.filter(r => r.isDuplicate).length

    chaserImportRecords.value = result.records
    chaserImportStats.value = {
      total: result.totalRecords,
      valid: validRecords,
      invalid: result.totalRecords - validRecords,
      duplicates: duplicateCount
    }

    console.log('Chaser import stats:', chaserImportStats.value)
    console.log('Total records:', chaserImportRecords.value.length)

    // Show preview modal
    showChaserPreview.value = true
    console.log('Set showChaserPreview to true')
  } catch (error) {
    console.error('Chaser ADIF parse error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to parse chaser ADIF file',
    })
  } finally {
    closeToast()
    isProcessing.value = false
    // Reset file input
    if (target) target.value = ''
  }
}

async function handleChaserCsvFileSelect(event: Event) {
  console.log('Chaser CSV file select triggered')
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    console.log('No file selected')
    return
  }

  isProcessing.value = true

  showLoadingToast({
    message: 'Parsing chaser CSV...',
    forbidClick: true,
    duration: 0,
  })

  try {
    // Parse CSV file
    let result: ChaserImportResult = await parseChaserCsvFile(file)

    if (result.totalRecords === 0) {
      showNotify({
        type: 'danger',
        message: 'No records found in CSV file',
      })
      return
    }

    showLoadingToast({
      message: 'Validating WOTA references...',
      forbidClick: true,
      duration: 0,
    })

    // Validate WOTA references
    try {
      result.records = await validateChaserWotaRefs(result.records)
      console.log('WOTA reference validation complete')
    } catch (validationError) {
      console.error('WOTA validation error:', validationError)
      // Continue with unvalidated records
    }

    showLoadingToast({
      message: 'Checking for duplicates...',
      forbidClick: true,
      duration: 0,
    })

    // Check for duplicates
    try {
      result.records = await checkChaserDuplicates(result.records)
      console.log('Duplicate check complete')
    } catch (duplicateError) {
      console.error('Duplicate check error:', duplicateError)
      // Continue without duplicate checking
    }

    // Count duplicates
    const duplicates = result.records.filter(r => r.isDuplicate).length

    // Update stats
    chaserImportStats.value = {
      total: result.totalRecords,
      valid: result.validRecords,
      invalid: result.invalidRecords,
      duplicates: duplicates
    }

    // Store records and show preview
    chaserImportRecords.value = result.records
    showChaserPreview.value = true

    console.log('Showing chaser CSV preview modal:', {
      total: result.totalRecords,
      valid: result.validRecords,
      invalid: result.invalidRecords,
      duplicates
    })

  } catch (error) {
    console.error('CSV parsing error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to parse chaser CSV file',
    })
  } finally {
    closeToast()
    isProcessing.value = false
    // Reset file input
    if (target) target.value = ''
  }
}

async function handleChaserImportConfirm(validRecords: ChaserImportRecord[]) {
  try {
    isProcessing.value = true
    showLoadingToast({
      message: 'Importing chaser records...',
      forbidClick: true,
      duration: 0,
    })

    const response = await fetch('/data/api/import/chaser-adif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ records: validRecords })
    })

    if (!response.ok) {
      throw new Error('Import failed')
    }

    const result = await response.json()

    // Close modal
    showChaserPreview.value = false

    // Show success dialog
    await showDialog({
      title: 'Import Complete',
      message: `
        Imported: ${result.imported}
        Skipped (duplicates): ${result.skipped}
        Failed: ${result.failed}
      `,
    })

    showNotify({
      type: 'success',
      message: `Successfully imported ${result.imported} chaser records`,
    })

    // Emit event to refresh chaser contacts view
    if (result.imported > 0) {
      emit('chaserImportComplete')
    }
  } catch (error) {
    console.error('Chaser import error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Import failed',
    })
  } finally {
    closeToast()
    isProcessing.value = false
  }
}

// Expose methods for parent component
defineExpose({
  handleImportActivatorAdifClick,
  handleImportActivatorCsvClick,
  handleImportChaserAdifClick,
  handleImportChaserCsvClick,
})
</script>

<template>
  <div class="button-bar">
    <input
      ref="adifFileInput"
      type="file"
      accept=".adi,.adif"
      style="display: none"
      @change="handleAdifFileSelect"
    />

    <input
      ref="csvFileInput"
      type="file"
      accept=".csv"
      style="display: none"
      @change="handleCsvFileSelect"
    />

    <input
      ref="chaserAdifFileInput"
      type="file"
      accept=".adi,.adif"
      style="display: none"
      @change="handleChaserAdifFileSelect"
    />

    <input
      ref="chaserCsvFileInput"
      type="file"
      accept=".csv"
      style="display: none"
      @change="handleChaserCsvFileSelect"
    />

    <van-button
      type="primary"
      :loading="isProcessing"
      @click="handleImportActivatorAdifClick"
    >
      Import Activator ADIF
    </van-button>

    <van-button
      type="primary"
      :loading="isProcessing"
      @click="handleImportActivatorCsvClick"
    >
      Import Activator CSV
    </van-button>

    <van-button
      type="primary"
      :loading="isProcessing"
      @click="handleImportChaserAdifClick"
    >
      Import Chaser ADIF
    </van-button>

    <van-button
      type="primary"
      :loading="isProcessing"
      @click="handleImportChaserCsvClick"
    >
      Import Chaser CSV
    </van-button>

    <ChaserAdifPreviewModal
      :show="showChaserPreview"
      :records="chaserImportRecords"
      :total-records="chaserImportStats.total"
      :valid-records="chaserImportStats.valid"
      :invalid-records="chaserImportStats.invalid"
      :duplicate-records="chaserImportStats.duplicates"
      @close="showChaserPreview = false"
      @confirm="handleChaserImportConfirm"
    />
  </div>
</template>

<style scoped>
.button-bar {
  position: fixed;
  top: 46px;
  left: 0;
  right: 0;
  z-index: 99;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #eee;
}

@media (max-width: 640px) {
  .button-bar {
    flex-direction: column;
  }
}
</style>
