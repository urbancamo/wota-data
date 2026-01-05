<script setup lang="ts">
import { ref } from 'vue'
import { showNotify } from 'vant'
import { parseAdifFile, calculateStatistics as calculateAdifStatistics } from '../services/adifService'
import { parseCsvFile, calculateStatistics as calculateCsvStatistics } from '../services/csvService'
import type { ParsedAdif } from '../types/adif'

const emit = defineEmits<{
  (e: 'adifParsed', data: ParsedAdif): void
}>()

const adifFileInput = ref<HTMLInputElement | null>(null)
const csvFileInput = ref<HTMLInputElement | null>(null)
const chaserAdifFileInput = ref<HTMLInputElement | null>(null)
const chaserCsvFileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)

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

async function handleChaserAdifFileSelect(event: Event) {
  console.log('Chaser ADIF file select triggered')
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    console.log('No file selected')
    return
  }

  // TODO: Implement chaser ADIF import
  showNotify({
    type: 'warning',
    message: 'Chaser ADIF import not yet implemented',
  })

  // Reset file input
  if (target) target.value = ''
}

async function handleChaserCsvFileSelect(event: Event) {
  console.log('Chaser CSV file select triggered')
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    console.log('No file selected')
    return
  }

  // TODO: Implement chaser CSV import
  showNotify({
    type: 'warning',
    message: 'Chaser CSV import not yet implemented',
  })

  // Reset file input
  if (target) target.value = ''
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
