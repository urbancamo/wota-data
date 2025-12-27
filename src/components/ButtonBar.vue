<script setup lang="ts">
import { ref } from 'vue'
import { showNotify, showLoadingToast, closeToast } from 'vant'
import { parseAdifFile, calculateStatistics } from '../services/adifService'
import { apiClient, type ExportFilters } from '../services/api'
import type { ParsedAdif } from '../types/adif'
import ExportFilterDialog from './ExportFilterDialog.vue'
import { useAuth } from '../composables/useAuth'

const { username } = useAuth()

const emit = defineEmits<{
  (e: 'adifParsed', data: ParsedAdif): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const isExporting = ref(false)
const showExportFilter = ref(false)
const exportType = ref<'activator' | 'chaser'>('activator')

function handleImportAdifClick() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  console.log('File select triggered')
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
    const stats = calculateStatistics(parsed.records, parsed.errors)

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
</script>

<template>
  <div class="button-bar">
    <input
      ref="fileInput"
      type="file"
      accept=".adi,.adif"
      style="display: none"
      @change="handleFileSelect"
    />

    <van-button
      type="primary"
      block
      :loading="isProcessing"
      @click="handleImportAdifClick"
    >
      Import ADIF
    </van-button>

    <van-button
      block
      :loading="isExporting"
      @click="handleExportActivatorClick"
    >
      Export Activator CSV
    </van-button>

    <van-button
      block
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
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #eee;
}

@media (max-width: 640px) {
  .button-bar {
    grid-template-columns: 1fr;
  }
}
</style>
