<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { showNotify } from 'vant'
import { apiClient, type LeagueTableEntry } from '../services/api'

const loading = ref(true)
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const fellWalkers = ref<LeagueTableEntry[]>([])
const fellChasers = ref<LeagueTableEntry[]>([])
const fellWatchers = ref<LeagueTableEntry[]>([])

// Generate year options from 2009 to current year
const yearOptions = computed(() => {
  const options = []
  for (let y = currentYear; y >= 2009; y--) {
    options.push({ text: y.toString(), value: y })
  }
  return options
})

async function fetchLeagueTables() {
  try {
    loading.value = true
    const result = await apiClient.getLeagueTables(selectedYear.value)
    fellWalkers.value = result.fellWalkers
    fellChasers.value = result.fellChasers
    fellWatchers.value = result.fellWatchers
  } catch (error) {
    console.error('Error fetching league tables:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load league tables',
    })
  } finally {
    loading.value = false
  }
}

watch(selectedYear, () => {
  fetchLeagueTables()
})

onMounted(() => {
  fetchLeagueTables()
})
</script>

<template>
  <div class="league-tables-panel">
    <div class="stats-card">
      <div class="card-header">
        <h3 class="card-title">League Tables</h3>
        <div class="year-selector">
          <van-dropdown-menu>
            <van-dropdown-item v-model="selectedYear" :options="yearOptions" />
          </van-dropdown-menu>
        </div>
      </div>

      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" size="24" />
        <div class="loading-text">Loading league tables...</div>
      </div>

      <div v-else class="tables-grid">
        <!-- Top Fell Walkers -->
        <div class="league-section">
          <div class="section-title">Top Fell Walkers</div>
          <div v-if="fellWalkers.length === 0" class="no-data">No data yet</div>
          <table v-else class="league-table">
            <thead>
              <tr>
                <th class="rank-col">#</th>
                <th class="call-col">Call</th>
                <th class="points-col">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in fellWalkers" :key="entry.callsign">
                <td class="rank-cell">{{ entry.rank }}</td>
                <td class="call-cell">{{ entry.callsign }}</td>
                <td class="points-cell">{{ entry.points }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Top Fell Chasers -->
        <div class="league-section">
          <div class="section-title">Top Fell Chasers</div>
          <div v-if="fellChasers.length === 0" class="no-data">No data yet</div>
          <table v-else class="league-table">
            <thead>
              <tr>
                <th class="rank-col">#</th>
                <th class="call-col">Call</th>
                <th class="points-col">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in fellChasers" :key="entry.callsign">
                <td class="rank-cell">{{ entry.rank }}</td>
                <td class="call-cell">{{ entry.callsign }}</td>
                <td class="points-cell">{{ entry.points }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Top Fell Watchers -->
        <div class="league-section">
          <div class="section-title">Top Fell Watchers</div>
          <div v-if="fellWatchers.length === 0" class="no-data">No data yet</div>
          <table v-else class="league-table">
            <thead>
              <tr>
                <th class="rank-col">#</th>
                <th class="call-col">Call</th>
                <th class="points-col">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in fellWatchers" :key="entry.callsign">
                <td class="rank-cell">{{ entry.rank }}</td>
                <td class="call-cell">{{ entry.callsign }}</td>
                <td class="points-cell">{{ entry.points }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.league-tables-panel {
  padding: 16px;
}

.stats-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.year-selector {
  min-width: 100px;
}

.year-selector :deep(.van-dropdown-menu__bar) {
  background: transparent;
  box-shadow: none;
  height: 32px;
}

.year-selector :deep(.van-dropdown-menu__title) {
  font-size: 14px;
  font-weight: 600;
}

.loading-container {
  text-align: center;
  padding: 20px;
}

.loading-text {
  text-align: center;
  margin-top: 8px;
  color: #666;
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.league-section {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
  border-bottom: 2px solid #1989fa;
  padding-bottom: 8px;
}

.league-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.league-table thead {
  background: #ebedf0;
}

.league-table th {
  padding: 6px 8px;
  text-align: left;
  font-weight: 600;
  color: #323233;
}

.league-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #ebedf0;
  color: #646566;
}

.league-table tbody tr:hover {
  background: #e8f4ff;
}

.rank-col {
  width: 30px;
  text-align: center;
}

.call-col {
  width: auto;
}

.points-col {
  width: 40px;
  text-align: right;
}

.rank-cell {
  text-align: center;
  font-weight: 600;
  color: #969799;
}

.call-cell {
  font-family: monospace;
  font-weight: 600;
  color: #323233;
}

.points-cell {
  text-align: right;
  font-weight: 700;
  color: #1989fa;
}

.no-data {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 13px;
}

@media (max-width: 768px) {
  .tables-grid {
    grid-template-columns: 1fr;
  }

  .league-tables-panel {
    padding: 8px;
  }
}
</style>
