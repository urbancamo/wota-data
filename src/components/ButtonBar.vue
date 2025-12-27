<script setup lang="ts">
import { ref } from 'vue'
import { showNotify, showLoadingToast, closeToast } from 'vant'
import { parseAdifFile, calculateStatistics as calculateAdifStatistics } from '../services/adifService'
import { parseCsvFile, calculateStatistics as calculateCsvStatistics } from '../services/csvService'
import { apiClient, type ExportFilters } from '../services/api'
import type { ParsedAdif } from '../types/adif'
import ExportFilterDialog from './ExportFilterDialog.vue'
import { useAuth } from '../composables/useAuth'

const { username } = useAuth()

const emit = defineEmits<{
  (e: 'adifParsed', data: ParsedAdif): void
}>()

const adifFileInput = ref<HTMLInputElement | null>(null)
const csvFileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const isExporting = ref(false)
const showExportFilter = ref(false)
const exportType = ref<'activator' | 'chaser'>('activator')

function handleImportAdifClick() {
  adifFileInput.value?.click()
}

function handleImportCsvClick() {
  csvFileInput.value?.click()
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
    isProcessing.value = false
    // Reset file input
    if (target) target.value = ''
  }
}

function handleExportActivatorClick() {
  exportType.value = 'activator'
  showExportFilter.value = true
}

function handleExportChaserClick() {
  exportType.value = 'chaser'
  showExportFilter.value = true
}

function handleFilterDialogClose() {
  showExportFilter.value = false
}

async function handleFilterConfirm(filters: ExportFilters) {
  showExportFilter.value = false
  showLoadingToast({
    message: 'Exporting...',
    forbidClick: true,
    duration: 0,
  });
  try {
    isExporting.value = true

    if (exportType.value === 'activator') {
      await apiClient.exportActivatorCsv(filters)
    } else {
      await apiClient.exportChaserCsv(filters)
    }

    showNotify({
      type: 'success',
      message: `${exportType.value === 'activator' ? 'Activator' : 'Chaser'} log exported successfully`,
    })
  } catch (error) {
    console.error('Export error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Export failed',
    })
  } finally {
    isExporting.value = false
    closeToast()
  }
}

// Expose methods for parent component
defineExpose({
  handleImportAdifClick,
  handleImportCsvClick,
  handleExportActivatorClick,
  handleExportChaserClick,
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

    <van-button
      type="primary"
      :loading="isProcessing"
      @click="handleImportAdifClick"
    >
      Import ADIF
    </van-button>

    <van-button
      type="primary"
      :loading="isProcessing"
      @click="handleImportCsvClick"
    >
      Import CSV
    </van-button>

    <van-button
      type="primary"
      :loading="isExporting"
      @click="handleExportActivatorClick"
    >
      Export Activator CSV
    </van-button>

    <van-button
      type="primary"
      :loading="isExporting"
      @click="handleExportChaserClick"
    >
      Export Chaser CSV
    </van-button>

    <ExportFilterDialog
      :show="showExportFilter"
      :export-type="exportType"
      :default-callsign="username"
      :default-year="new Date().getFullYear()"
      @close="handleFilterDialogClose"
      @confirm="handleFilterConfirm"
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
