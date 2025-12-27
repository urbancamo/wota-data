<script setup lang="ts">
import { ref } from 'vue'
import { showNotify, showLoadingToast, closeToast, showDialog, showActionSheet, type ActionSheetAction } from 'vant'
import AuthGuard from './components/AuthGuard.vue'
import LogoutButton from './components/LogoutButton.vue'
import ButtonBar from './components/ButtonBar.vue'
import AdifPreviewModal from './components/AdifPreviewModal.vue'
import StatisticsPanel from './components/StatisticsPanel.vue'
import UserStatisticsPanel from './components/UserStatisticsPanel.vue'
import ContactsView from './components/ContactsView.vue'
import { mapToActivatorLog, calculateStatistics } from './services/adifService'
import { apiClient } from './services/api'
import type { ParsedAdif, ImportStatistics } from './types/adif'

const activeView = ref(0)
const buttonBarRef = ref<InstanceType<typeof ButtonBar> | null>(null)
const showActions = ref(false)

const actions: ActionSheetAction[] = [
  { name: 'Import ADIF', subname: 'Import contacts from ADIF file' },
  { name: 'Import CSV', subname: 'Import contacts from CSV file' },
  { name: 'Export Activator CSV', subname: 'Export activator contacts' },
  { name: 'Export Chaser CSV', subname: 'Export chaser contacts' },
]

function handleActionSelect(action: ActionSheetAction, index: number) {
  showActions.value = false

  if (!buttonBarRef.value) return

  switch (index) {
    case 0:
      buttonBarRef.value.handleImportAdifClick()
      break
    case 1:
      buttonBarRef.value.handleImportCsvClick()
      break
    case 2:
      buttonBarRef.value.handleExportActivatorClick()
      break
    case 3:
      buttonBarRef.value.handleExportChaserClick()
      break
  }
}

const showPreview = ref(false)
const parsedData = ref<ParsedAdif | null>(null)
const statistics = ref<ImportStatistics | null>(null)

function handleAdifParsed(data: ParsedAdif) {
  parsedData.value = data
  statistics.value = calculateStatistics(data.records, data.errors)
  showPreview.value = true
}

function handlePreviewClose() {
  showPreview.value = false
}

async function handleConfirmImport() {
  if (!parsedData.value) return
  showLoadingToast({
    message: 'Importing...',
    forbidClick: true,
    duration: 0,
  });
  try {
    // Map ADIF records to ActivatorLog format
    const records = parsedData.value.records
      .map(mapToActivatorLog)
      .filter((r) => r !== null)

    if (records.length === 0) {
      showNotify({
        type: 'danger',
        message: 'No valid records to import',
      })
      return
    }

    // Send to backend
    const result = await apiClient.importAdif(records)

    // Close preview modal
    showPreview.value = false

    // Build result message for dialog
    const totalRecords = parsedData.value.records.length
    const skippedCount = result.skipped || 0
    const failedCount = result.failed || 0
    const importedCount = result.imported

    let messageHtml = `<div style="text-align: left; padding: 8px 0;">
      <div style="font-size: 15px; margin-bottom: 12px;">
        <strong>Import Summary</strong>
      </div>
      <div style="font-size: 14px; line-height: 1.8;">
        <div style="color: #07c160;">✓ <strong>${importedCount}</strong> record${importedCount !== 1 ? 's' : ''} imported successfully</div>`

    if (skippedCount > 0) {
      messageHtml += `<div style="color: #ff976a; margin-top: 4px;">⊘ <strong>${skippedCount}</strong> duplicate record${skippedCount !== 1 ? 's' : ''} skipped</div>`
    }

    if (failedCount > 0) {
      messageHtml += `<div style="color: #ee0a24; margin-top: 4px;">✗ <strong>${failedCount}</strong> record${failedCount !== 1 ? 's' : ''} failed</div>`
    }

    messageHtml += `<div style="color: #969799; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">Total records processed: ${totalRecords}</div>
      </div>
    </div>`

    showDialog({
      title: importedCount > 0 ? 'Import Complete' : 'Import Failed',
      message: messageHtml,
      confirmButtonText: 'OK',
      confirmButtonColor: '#1989fa',
      allowHtml: true,
    })
  } catch (error) {
    console.error('Import error:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Import failed',
    })
  } finally {
    closeToast()
  }
}
</script>

<template>
  <AuthGuard>
    <div class="app-container">
      <!-- Top Navigation Bar -->
      <van-nav-bar
        title="WOTA Data"
        fixed
        placeholder
      >
        <template #left>
          <van-button
            size="small"
            type="primary"
            @click="showActions = true"
          >
            Actions
          </van-button>
        </template>
        <template #right>
          <LogoutButton />
        </template>
      </van-nav-bar>

      <!-- Hidden Button Bar (keeps functionality) -->
      <ButtonBar
        ref="buttonBarRef"
        style="display: none"
        @adif-parsed="handleAdifParsed"
      />

      <!-- Page Content -->
      <div class="page-content">
        <van-tabs v-model:active="activeView" sticky :offset-top="46">
          <van-tab title="Statistics">
            <div class="statistics-container">
              <StatisticsPanel />
              <UserStatisticsPanel />
            </div>
          </van-tab>

          <van-tab title="Activator Contacts">
            <ContactsView contact-type="activator" />
          </van-tab>

          <van-tab title="Chaser Contacts">
            <ContactsView contact-type="chaser" />
          </van-tab>
        </van-tabs>
      </div>

      <!-- ADIF Preview Modal -->
      <AdifPreviewModal
        :show="showPreview"
        :parsed-data="parsedData"
        @close="handlePreviewClose"
        @confirm="handleConfirmImport"
      />

      <!-- Actions Menu -->
      <van-action-sheet
        v-model:show="showActions"
        :actions="actions"
        cancel-text="Cancel"
        close-on-click-action
        @select="handleActionSelect"
      />
    </div>
  </AuthGuard>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
}

.page-content {
  min-height: 100vh;
  padding-top: 46px;
}

.statistics-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

@media (max-width: 768px) {
  .statistics-container {
    grid-template-columns: 1fr;
  }
}
</style>
