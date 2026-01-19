<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showNotify } from 'vant'
import { apiClient, type ChallengeLeaderboardEntry } from '../services/api'

const activatorLeaderboard = ref<ChallengeLeaderboardEntry[]>([])
const chaserLeaderboard = ref<ChallengeLeaderboardEntry[]>([])
const loading = ref(false)

async function loadLeaderboards() {
  try {
    loading.value = true
    const [activatorData, chaserData] = await Promise.all([
      apiClient.getChallengeActivatorScores(),
      apiClient.getChallengeChaserScores()
    ])
    activatorLeaderboard.value = activatorData.leaderboard
    chaserLeaderboard.value = chaserData.leaderboard
  } catch (error) {
    console.error('Error loading challenge leaderboards:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to load challenge data',
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadLeaderboards()
})
</script>

<template>
  <div class="challenge-view">
    <div class="challenge-container">
      <!-- Challenge Summary -->
      <div class="challenge-summary">
        <h2 class="challenge-title">2026 WOTA 2m / 70cm SSB & CW Challenge</h2>
        <p class="challenge-description">
          Encouraging increased use of VHF/UHF bands within WOTA, promoting experimentation,
          portability, and VHF/UHF operating skills.
        </p>
        <div class="scoring-info">
          <div class="scoring-section">
            <h3>Qualifying Band/Mode Combinations</h3>
            <div class="band-modes">
              <van-tag type="primary">2m CW</van-tag>
              <van-tag type="primary">2m SSB</van-tag>
              <van-tag type="success">70cm CW</van-tag>
              <van-tag type="success">70cm SSB</van-tag>
            </div>
          </div>
          <div class="scoring-rules">
            <div class="rule">
              <strong>Activators:</strong> 1 point per unique fell per band/mode combination
            </div>
            <div class="rule">
              <strong>Chasers:</strong> 1 point per activator/fell/day/band/mode combination
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" size="24" />
        <div class="loading-text">Loading leaderboards...</div>
      </div>

      <div v-else class="leaderboards">
        <!-- Activator Leaderboard -->
        <div class="leaderboard-section">
          <h3 class="leaderboard-title">Activator Leaderboard</h3>
          <div v-if="activatorLeaderboard.length === 0" class="empty-state">
            <van-empty description="No activator scores yet" />
          </div>
          <div v-else class="table-wrapper">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th class="rank-col">Rank</th>
                  <th class="callsign-col">Callsign</th>
                  <th class="points-col">Points</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in activatorLeaderboard" :key="entry.callsign"
                    :class="{ 'top-three': entry.rank <= 3 }">
                  <td class="rank-cell">
                    <span v-if="entry.rank === 1" class="medal gold">1</span>
                    <span v-else-if="entry.rank === 2" class="medal silver">2</span>
                    <span v-else-if="entry.rank === 3" class="medal bronze">3</span>
                    <span v-else>{{ entry.rank }}</span>
                  </td>
                  <td class="callsign-cell">{{ entry.callsign }}</td>
                  <td class="points-cell">{{ entry.points }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Chaser Leaderboard -->
        <div class="leaderboard-section">
          <h3 class="leaderboard-title">Chaser Leaderboard</h3>
          <div v-if="chaserLeaderboard.length === 0" class="empty-state">
            <van-empty description="No chaser scores yet" />
          </div>
          <div v-else class="table-wrapper">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th class="rank-col">Rank</th>
                  <th class="callsign-col">Callsign</th>
                  <th class="points-col">Points</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in chaserLeaderboard" :key="entry.callsign"
                    :class="{ 'top-three': entry.rank <= 3 }">
                  <td class="rank-cell">
                    <span v-if="entry.rank === 1" class="medal gold">1</span>
                    <span v-else-if="entry.rank === 2" class="medal silver">2</span>
                    <span v-else-if="entry.rank === 3" class="medal bronze">3</span>
                    <span v-else>{{ entry.rank }}</span>
                  </td>
                  <td class="callsign-cell">{{ entry.callsign }}</td>
                  <td class="points-cell">{{ entry.points }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.challenge-view {
  padding-top: 8px;
}

.challenge-container {
  padding: 16px;
}

.challenge-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  color: white;
}

.challenge-title {
  margin: 0 0 12px 0;
  font-size: 22px;
  font-weight: 700;
}

.challenge-description {
  margin: 0 0 20px 0;
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.5;
}

.scoring-info {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 16px;
}

.scoring-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.band-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.scoring-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule {
  font-size: 13px;
  line-height: 1.4;
}

.leaderboards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.leaderboard-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.leaderboard-title {
  margin: 0;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  background: #f7f8fa;
  border-bottom: 1px solid #ebedf0;
}

.table-wrapper {
  max-height: 400px;
  overflow-y: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.leaderboard-table thead {
  background: #fafafa;
  position: sticky;
  top: 0;
}

.leaderboard-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #323233;
  border-bottom: 2px solid #ebedf0;
}

.leaderboard-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #ebedf0;
  color: #646566;
}

.leaderboard-table tbody tr:hover {
  background: #f7f8fa;
}

.leaderboard-table tbody tr.top-three {
  background: #fffbeb;
}

.leaderboard-table tbody tr.top-three:hover {
  background: #fef3c7;
}

.rank-col {
  width: 60px;
}

.callsign-col {
  width: auto;
}

.points-col {
  width: 80px;
  text-align: right;
}

.rank-cell {
  text-align: center;
}

.callsign-cell {
  font-family: monospace;
  font-weight: 600;
  color: #323233;
}

.points-cell {
  text-align: right;
  font-weight: 700;
  color: #1989fa;
}

.medal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 12px;
}

.medal.gold {
  background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%);
  color: #5c4813;
}

.medal.silver {
  background: linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%);
  color: #444;
}

.medal.bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);
  color: #fff;
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

@media (max-width: 768px) {
  .challenge-container {
    padding: 8px;
  }

  .challenge-summary {
    padding: 16px;
  }

  .challenge-title {
    font-size: 18px;
  }

  .leaderboards {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .leaderboard-table th,
  .leaderboard-table td {
    padding: 10px 12px;
  }

  .table-wrapper {
    max-height: 300px;
  }
}
</style>
