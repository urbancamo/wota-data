<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ExportFilters } from '../services/api'

interface Props {
  show: boolean
  exportType: 'activator' | 'chaser'
  defaultCallsign?: string
  defaultYear?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', filters: ExportFilters): void
}>()

const callsignsInput = ref('')
const yearInput = ref('')
const allYears = ref(false)

// Watch for dialog opening and set defaults
watch(() => props.show, (newShow) => {
  if (newShow) {
    callsignsInput.value = props.defaultCallsign || ''
    yearInput.value = props.defaultYear ? props.defaultYear.toString() : ''
    allYears.value = false
  }
})

// Watch allYears checkbox - clear year input when checked
watch(allYears, (isAllYears) => {
  if (isAllYears) {
    yearInput.value = ''
  }
})

const parsedCallsigns = computed(() => {
  if (!callsignsInput.value.trim()) {
    return []
  }
  return callsignsInput.value
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length > 0)
})

const callsignCount = computed(() => {
  const count = parsedCallsigns.value.length
  if (count === 0) return 'No filters applied - will export all records'
  if (count === 1) return '1 callsign will be filtered'
  return `${count} callsigns will be filtered`
})

const yearValidator = (value: string) => {
  if (!value) return true
  const year = parseInt(value, 10)
  if (isNaN(year)) return 'Year must be a number'
  if (year < 1900 || year > 2099) return 'Year must be between 1900 and 2099'
  if (value.length !== 4) return 'Year must be 4 digits'
  return true
}

function handleClose() {
  resetForm()
  emit('close')
}

function handleConfirm() {
  try {
    const filters: ExportFilters = {
      callsigns: parsedCallsigns.value.length > 0 ? parsedCallsigns.value : undefined,
      year: allYears.value ? undefined : (yearInput.value ? parseInt(yearInput.value, 10) : undefined),
    }

    emit('confirm', filters)
    resetForm()
  } catch (error) {
    console.error('Error in handleConfirm:', error)
  }
}

function resetForm() {
  callsignsInput.value = ''
  yearInput.value = ''
  allYears.value = false
}
</script>

<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '60%' }"
    @click-overlay="handleClose">
    <div class="export-filter-dialog">
      <div class="dialog-header">
        <h3>{{ exportType === 'activator' ? 'Activator' : 'Chaser' }} Export Filters</h3>
        <p class="subtitle">Filter your export data (optional)</p>
      </div>

      <div class="filter-form">
        <van-cell-group inset>
          <van-field
            v-model="callsignsInput"
            type="textarea"
            name="callsigns"
            label="Callsigns"
            placeholder="e.g., M0ABC, G4XYZ, 2E0DEF"
            rows="3"
            autosize
            :border="true">
            <template #extra>
              <div class="helper-text">{{ callsignCount }}</div>
            </template>
          </van-field>

          <van-field
            v-model="yearInput"
            type="digit"
            name="year"
            label="Year"
            placeholder="e.g., 2024"
            maxlength="4"
            :disabled="allYears"
            :rules="[{ validator: yearValidator }]"
            :border="true" />

          <van-field name="allYears" :border="true">
            <template #input>
              <van-checkbox v-model="allYears">All Years</van-checkbox>
            </template>
          </van-field>
        </van-cell-group>

        <div class="help-section">
          <p class="help-text">
            <strong>Callsigns:</strong> Enter station callsigns separated by commas. Leave blank to export all.
          </p>
          <p class="help-text">
            <strong>Year:</strong> Enter a 4-digit year to filter contacts from that year, or check "All Years" to export all.
          </p>
        </div>

        <div class="action-buttons">
          <van-button
            plain
            type="default"
            @click="handleClose">
            Cancel
          </van-button>
          <van-button
            type="primary"
            @click="handleConfirm">
            Apply Filters
          </van-button>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.export-filter-dialog {
  padding: 15px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  margin-bottom: 15px;
  text-align: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.subtitle {
  margin: 3px 0 0 0;
  font-size: 11px;
  color: #969799;
}

.filter-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.helper-text {
  font-size: 9px;
  color: #969799;
  margin-top: 3px;
}

.help-section {
  margin: 15px 12px;
  padding: 9px;
  background-color: #f7f8fa;
  border-radius: 6px;
}

.help-text {
  margin: 0 0 6px 0;
  font-size: 10px;
  line-height: 1.4;
  color: #646566;
}

.help-text:last-child {
  margin-bottom: 0;
}

.help-text strong {
  color: #323233;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  padding: 12px;
  margin-top: auto;
}

@media (max-width: 480px) {
  .dialog-header h3 {
    font-size: 14px;
  }

  .action-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
