<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { apiClient } from '../services/api'

// Target scroll speed: ~80 pixels per second (comfortable reading pace)
const SCROLL_SPEED_PX_PER_SEC = 80

const summary = ref<string | null>(null)
const loading = ref(true)
const paused = ref(false)
const totalWidth = ref(0)
const tickerRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const animationDuration = computed(() => {
  if (totalWidth.value <= 0) return '120s'
  const seconds = Math.round(totalWidth.value / SCROLL_SPEED_PX_PER_SEC)
  return `${seconds}s`
})

async function fetchForecast() {
  try {
    const forecast = await apiClient.getMwisForecast()
    if (forecast) {
      summary.value = forecast.summary
      // Measure after DOM updates
      requestAnimationFrame(measureWidths)
    }
  } catch (error) {
    console.error('Error fetching MWIS forecast:', error)
  } finally {
    loading.value = false
  }
}

function measureWidths() {
  const textW = tickerRef.value?.scrollWidth ?? 0
  const containerW = containerRef.value?.clientWidth ?? 0
  // Total travel = container padding (starts offscreen right) + text width
  totalWidth.value = containerW + textW
}

onMounted(() => {
  fetchForecast()
  // Refresh forecast every hour
  refreshTimer = setInterval(fetchForecast, 60 * 60 * 1000)
  window.addEventListener('resize', measureWidths)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  window.removeEventListener('resize', measureWidths)
})
</script>

<template>
  <div v-if="summary" ref="containerRef" class="mwis-ticker">
    <div class="ticker-track" :class="{ paused }" :style="{ animationDuration }">
      <span ref="tickerRef" class="ticker-text">{{ summary }}</span>
    </div>
    <button class="pause-btn" @click="paused = !paused">
      {{ paused ? '\u25B6' : '\u275A\u275A' }}
    </button>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');

.mwis-ticker {
  background: #ffffff;
  color: #323233;
  padding: 8px 0;
  overflow: hidden;
  position: relative;
  border-bottom: 1px solid #eee;
}

.mwis-ticker::before,
.mwis-ticker::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  z-index: 1;
  pointer-events: none;
}

.mwis-ticker::before {
  left: 0;
  background: linear-gradient(to right, #ffffff, transparent);
}

.mwis-ticker::after {
  right: 0;
  background: linear-gradient(to left, #ffffff, transparent);
}

.ticker-track {
  display: inline-block;
  white-space: nowrap;
  animation: scroll-ticker 120s linear infinite;
  padding-left: 100%;
}

.ticker-text {
  font-family: 'Special Elite', 'Courier New', Courier, monospace;
  font-size: 14px;
  letter-spacing: 0.5px;
  display: inline-block;
}

.ticker-track.paused {
  animation-play-state: paused;
}

.pause-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  color: #646566;
  cursor: pointer;
  line-height: 1;
}

.pause-btn:hover {
  background: rgba(255, 255, 255, 0.9);
}

@keyframes scroll-ticker {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}
</style>
