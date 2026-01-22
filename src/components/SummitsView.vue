<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { showNotify } from 'vant'
import { apiClient, type ActivationContact } from '../services/api'
import { formatWotaReference, formatSotaReference, formatHumpReference, formatBookName, gridRefToLatLng } from '../utils/wotaReference'
import type { Summit } from '../types/adif'

// OpenLayers imports
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import { fromLonLat } from 'ol/proj'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style, Circle, Fill, Stroke } from 'ol/style'
import GeoJSON from 'ol/format/GeoJSON'
import { FullScreen, defaults as defaultControls } from 'ol/control'
import type { FeatureLike } from 'ol/Feature'
import 'ol/ol.css'

// URL for the summits GeoJSON (proxied through our API to avoid CORS)
const SUMMITS_GEOJSON_URL = '/data/api/summits/geojson'

interface Activation {
  date: string
  activatedby: string
  contacts: number
}

const summits = ref<Summit[]>([])
const filteredSummits = ref<Summit[]>([])
const loading = ref(false)
const searchQuery = ref('')
const sortColumn = ref<keyof Summit>('wotaid')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Summit detail popup state
const showDetailPopup = ref(false)
const selectedSummit = ref<Summit | null>(null)
const summitActivations = ref<Activation[]>([])
const loadingActivations = ref(false)
const activationSortColumn = ref<keyof Activation>('date')
const activationSortDirection = ref<'asc' | 'desc'>('desc')

// Activation detail popup state
const showActivationDetailPopup = ref(false)
const selectedActivationDetail = ref<{
  wotaid: number
  name: string
  date: string
  callsign: string
} | null>(null)
const activationDetailContacts = ref<ActivationContact[]>([])
const loadingActivationContacts = ref(false)

// Map state
const mapContainer = ref<HTMLElement | null>(null)
let map: Map | null = null
let fullScreenControl: FullScreen | null = null
const summitsGeoJson = ref<object | null>(null)
const geoJsonLoaded = ref(false)

async function loadSummits() {
  try {
    loading.value = true
    const result = await apiClient.getSummits()
    // Exclude wotaid 0 from the list
    const validSummits = result.filter(summit => summit.wotaid !== 0)
    summits.value = validSummits
    filteredSummits.value = validSummits
    applySorting()
  } catch (error) {
    console.error('Error loading summits:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to load summits'
    })
  } finally {
    loading.value = false
  }
}

function handleSort(column: keyof Summit) {
  if (sortColumn.value === column) {
    // Toggle direction if same column
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // New column, default to ascending
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
  applySorting()
}

function applySorting() {
  const sorted = [...filteredSummits.value].sort((a, b) => {
    const aVal = a[sortColumn.value]
    const bVal = b[sortColumn.value]

    // Handle null/undefined values
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    // Compare values
    let comparison = 0
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal)
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else {
      comparison = String(aVal).localeCompare(String(bVal))
    }

    return sortDirection.value === 'asc' ? comparison : -comparison
  })

  filteredSummits.value = sorted
}

function handleSearch() {
  if (!searchQuery.value.trim()) {
    filteredSummits.value = summits.value
  } else {
    const query = searchQuery.value.toLowerCase()
    filteredSummits.value = summits.value.filter(summit =>
      summit.name.toLowerCase().includes(query) ||
      summit.reference.toLowerCase().includes(query) ||
      formatWotaReference(summit.wotaid).toLowerCase().includes(query) ||
      (summit.gridid && summit.gridid.toLowerCase().includes(query))
    )
  }
  applySorting()
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  try {
    const d = new Date(date)
    return d.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return '-'
  }
}

function getSortIcon(column: keyof Summit): string {
  if (sortColumn.value !== column) return '↕'
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

async function handleSummitClick(summit: Summit) {
  selectedSummit.value = summit
  showDetailPopup.value = true
  await loadActivations(summit.wotaid)
}

async function loadActivations(wotaid: number) {
  try {
    loadingActivations.value = true
    const activations = await apiClient.getSummitActivations(wotaid)
    summitActivations.value = activations
    applySortingToActivations()
  } catch (error) {
    console.error('Error loading activations:', error)
    showNotify({
      type: 'danger',
      message: error instanceof Error ? error.message : 'Failed to load activations'
    })
  } finally {
    loadingActivations.value = false
  }
}

function handleActivationSort(column: keyof Activation) {
  if (activationSortColumn.value === column) {
    activationSortDirection.value = activationSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    activationSortColumn.value = column
    activationSortDirection.value = 'asc'
  }
  applySortingToActivations()
}

function applySortingToActivations() {
  const sorted = [...summitActivations.value].sort((a, b) => {
    const aVal = a[activationSortColumn.value]
    const bVal = b[activationSortColumn.value]

    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    let comparison = 0
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal)
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else {
      comparison = String(aVal).localeCompare(String(bVal))
    }

    return activationSortDirection.value === 'asc' ? comparison : -comparison
  })

  summitActivations.value = sorted
}

function getActivationSortIcon(column: keyof Activation): string {
  if (activationSortColumn.value !== column) return '↕'
  return activationSortDirection.value === 'asc' ? '↑' : '↓'
}

async function handleActivationRowClick(activation: Activation) {
  if (!selectedSummit.value) return

  selectedActivationDetail.value = {
    wotaid: selectedSummit.value.wotaid,
    name: selectedSummit.value.name,
    date: activation.date,
    callsign: activation.activatedby
  }
  showActivationDetailPopup.value = true
  loadingActivationContacts.value = true
  activationDetailContacts.value = []

  try {
    const contacts = await apiClient.getActivationContacts(
      selectedSummit.value.wotaid,
      activation.activatedby,
      activation.date
    )
    activationDetailContacts.value = contacts
  } catch (error) {
    console.error('Error fetching activation contacts:', error)
    showNotify({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Failed to load contacts'
    })
  } finally {
    loadingActivationContacts.value = false
  }
}

function formatTime(timeString: string | null): string {
  if (!timeString) return '-'
  const date = new Date(timeString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function copyActivationAsMarkdown() {
  if (!selectedActivationDetail.value || activationDetailContacts.value.length === 0) return

  const activation = selectedActivationDetail.value
  let markdown = `## ${activation.name} (${formatWotaReference(activation.wotaid)})\n`
  markdown += `**Callsign:** ${activation.callsign}  \n`
  markdown += `**Date:** ${formatDate(activation.date)}\n\n`
  markdown += `| Time | Callsign | Band | Mode | Confirmed |\n`
  markdown += `|------|----------|------|------|:---------:|\n`

  for (const contact of activationDetailContacts.value) {
    const time = formatTime(contact.time)
    const band = contact.band || '-'
    const mode = contact.mode || '-'
    const confirmed = contact.confirmed ? '✓' : '-'
    markdown += `| ${time} | [${contact.stncall}](https://qrz.com/db/${contact.stncall}) | ${band} | ${mode} | ${confirmed} |\n`
  }

  try {
    await navigator.clipboard.writeText(markdown)
    showNotify({
      type: 'success',
      message: 'Copied to clipboard'
    })
  } catch (error) {
    showNotify({
      type: 'warning',
      message: 'Failed to copy to clipboard'
    })
  }
}

function handleClosePopup() {
  showDetailPopup.value = false
  selectedSummit.value = null
  summitActivations.value = []
  // Clean up map
  if (map) {
    map.setTarget(undefined)
    map = null
    fullScreenControl = null
  }
}

function toggleFullScreen() {
  if (fullScreenControl && mapContainer.value) {
    // Trigger the fullscreen by simulating a click on the fullscreen button
    const button = mapContainer.value.querySelector('.ol-full-screen button') as HTMLButtonElement
    if (button) {
      button.click()
    }
  }
}

function initializeMap(summit: Summit) {
  // Get lat/lng from grid reference
  const coords = gridRefToLatLng(summit.reference)
  if (!coords) {
    console.warn('Could not convert grid reference to lat/lng:', summit.reference)
    return
  }

  // Wait for DOM to update, then initialize map
  nextTick(() => {
    if (!mapContainer.value) return

    // Clean up existing map
    if (map) {
      map.setTarget(undefined)
      map = null
    }

    // Calculate hit tolerance based on screen resolution (same as PHP)
    const screenRes = window.screen.availWidth
    const scaleFactorForHitTolerance = 1 / 250
    const hitTolerance = screenRes * scaleFactorForHitTolerance

    // Style function for summit markers (uses marker-color from GeoJSON)
    const styleFunction = (feature: FeatureLike) => {
      const markerColor = feature.get('marker-color') || '#e74c3c'
      const scale = screenRes / 4000.0
      return new Style({
        image: new Circle({
          radius: Math.max(6, 8 * scale),
          fill: new Fill({ color: markerColor }),
          stroke: new Stroke({ color: '#ffffff', width: 2 })
        })
      })
    }

    // Create summits layer from pre-loaded GeoJSON
    const summitsSource = new VectorSource()
    if (summitsGeoJson.value) {
      const features = new GeoJSON().readFeatures(summitsGeoJson.value, {
        featureProjection: 'EPSG:3857'
      })
      summitsSource.addFeatures(features)
    }

    const summitsLayer = new VectorLayer({
      source: summitsSource,
      style: styleFunction
    })

    // Create Thunderforest Landscape layer (same as PHP version)
    const landscapeLayer = new TileLayer({
      source: new OSM({
        url: 'https://{a-c}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=c08210aeeb8644feb553d1982c78ec9b',
        attributions: 'Maps &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      })
    })

    fullScreenControl = new FullScreen()

    map = new Map({
      target: mapContainer.value,
      controls: defaultControls().extend([fullScreenControl]),
      layers: [landscapeLayer, summitsLayer],
      view: new View({
        center: fromLonLat([coords.lng, coords.lat]),
        zoom: 14
      })
    })

    // Handle click on summit markers
    map.on('click', (evt) => {
      const feature = map?.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f,
        { hitTolerance }
      )

      if (feature) {
        const wotaId = feature.get('wotaId')
        if (wotaId) {
          navigateToSummit(wotaId)
        }
      }
    })

    // Change cursor on hover
    map.on('pointermove', (evt) => {
      if (evt.dragging) return

      const pixel = map?.getEventPixel(evt.originalEvent)
      if (!pixel || !map) return

      const hit = map.hasFeatureAtPixel(pixel, { hitTolerance })
      const target = map.getTarget()
      if (target && typeof target !== 'string') {
        target.style.cursor = hit ? 'pointer' : ''
      }
    })
  })
}

// Navigate to a summit by WOTA ID (e.g., "LDW-001" or "LDO-042")
function navigateToSummit(wotaId: string) {
  // Parse the WOTA ID to get the internal wotaid number
  const match = wotaId.match(/^(LDW|LDO)-(\d+)$/i)
  if (!match) return

  const series = match[1]!.toUpperCase()
  const refNumber = parseInt(match[2]!, 10)

  // Calculate internal wotaid
  let wotaid: number
  if (series === 'LDW') {
    wotaid = refNumber
  } else {
    // LDO: add 214 to get internal ID
    wotaid = refNumber + 214
  }

  // Find the summit in our loaded data
  const targetSummit = summits.value.find(s => s.wotaid === wotaid)
  if (targetSummit) {
    // Close current popup and open for the clicked summit
    handleClosePopup()
    nextTick(() => {
      handleSummitClick(targetSummit)
    })
  }
}

// Watch for popup open and initialize map
watch(showDetailPopup, (isOpen) => {
  if (isOpen && selectedSummit.value) {
    initializeMap(selectedSummit.value)
  }
})

// Load GeoJSON for map overlay
async function loadSummitsGeoJson() {
  if (geoJsonLoaded.value) return

  try {
    const response = await fetch(SUMMITS_GEOJSON_URL)
    if (response.ok) {
      summitsGeoJson.value = await response.json()
      geoJsonLoaded.value = true
    }
  } catch (error) {
    console.warn('Could not load summits GeoJSON:', error)
  }
}

// Load summits on mount
onMounted(() => {
  loadSummits()
  loadSummitsGeoJson()
})

// Expose refresh method for parent component
defineExpose({
  refresh: loadSummits
})
</script>

<template>
  <div class="summits-view">
    <!-- Search Bar -->
    <div class="search-section">
      <van-search
        v-model="searchQuery"
        placeholder="Search summits by name, reference, or grid"
        @update:model-value="handleSearch"
      />
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <span>Total Summits: {{ filteredSummits.length }} {{ filteredSummits.length !== summits.length ? `of ${summits.length}` : '' }}</span>
    </div>

    <!-- Loading State -->
    <van-loading v-if="loading" class="loading-spinner" />

    <!-- Summits Table -->
    <div v-else class="summits-table-container">
      <table class="summits-table">
        <thead>
          <tr>
            <th @click="handleSort('wotaid')" class="sortable">
              WOTA Ref {{ getSortIcon('wotaid') }}
            </th>
            <th @click="handleSort('name')" class="sortable">
              Name {{ getSortIcon('name') }}
            </th>
            <th @click="handleSort('height')" class="sortable">
              Height {{ getSortIcon('height') }}
            </th>
            <th @click="handleSort('book')" class="sortable">
              Book {{ getSortIcon('book') }}
            </th>
            <th @click="handleSort('sotaid')" class="sortable">
              SOTA Ref {{ getSortIcon('sotaid') }}
            </th>
            <th @click="handleSort('humpid')" class="sortable">
              Hump Ref {{ getSortIcon('humpid') }}
            </th>
            <th @click="handleSort('gridid')" class="sortable">
              Grid {{ getSortIcon('gridid') }}
            </th>
            <th @click="handleSort('last_act_by')" class="sortable">
              Last Activator {{ getSortIcon('last_act_by') }}
            </th>
            <th @click="handleSort('last_act_date')" class="sortable">
              Last Activation {{ getSortIcon('last_act_date') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="summit in filteredSummits" :key="summit.wotaid" @click="handleSummitClick(summit)" class="clickable-row">
            <td class="wota-ref">{{ formatWotaReference(summit.wotaid) }}</td>
            <td class="name">{{ summit.name }}</td>
            <td class="height">{{ summit.height }}m</td>
            <td class="book">{{ formatBookName(summit.book) }}</td>
            <td class="sota-ref">{{ formatSotaReference(summit.sotaid) }}</td>
            <td class="hump-ref">{{ formatHumpReference(summit.humpid) }}</td>
            <td class="grid">{{ summit.gridid || '-' }}</td>
            <td class="callsign">{{ summit.last_act_by || '-' }}</td>
            <td class="date">{{ formatDate(summit.last_act_date) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <van-empty
        v-if="filteredSummits.length === 0"
        description="No summits found"
      />
    </div>

    <!-- Summit Detail Popup -->
    <van-popup
      v-model:show="showDetailPopup"
      position="center"
      :style="{ width: '90%', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto', borderRadius: '16px' }"
      closeable
      @close="handleClosePopup"
    >
      <div v-if="selectedSummit" class="summit-detail-popup">
        <h3 class="popup-title">{{ selectedSummit.name }}</h3>

        <!-- Summit Details -->
        <div class="summit-details">
          <div class="detail-row two-col">
            <div class="detail-col">
              <span class="detail-label">WOTA:</span>
              <span class="detail-value wota-ref">{{ formatWotaReference(selectedSummit.wotaid) }}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Name:</span>
              <span class="detail-value">{{ selectedSummit.name }}</span>
            </div>
          </div>
          <div class="detail-row two-col">
            <div class="detail-col">
              <span class="detail-label">Height:</span>
              <span class="detail-value">{{ selectedSummit.height }}m</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Book:</span>
              <span class="detail-value">{{ formatBookName(selectedSummit.book) }}</span>
            </div>
          </div>
          <div class="detail-row two-col">
            <div class="detail-col">
              <span class="detail-label">SOTA:</span>
              <span class="detail-value sota-ref">{{ formatSotaReference(selectedSummit.sotaid) }}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Hump:</span>
              <span class="detail-value hump-ref">{{ formatHumpReference(selectedSummit.humpid) }}</span>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Grid:</span>
            <span class="detail-value">{{ selectedSummit.gridid || '-' }}</span>
          </div>
        </div>

        <!-- Map Section -->
        <div class="map-section">
          <div ref="mapContainer" class="summit-map"></div>
          <div class="map-link">
            <a
              href="#"
              @click.prevent="toggleFullScreen"
            >
              View Larger Map
            </a>
          </div>
        </div>

        <!-- Activations Section -->
        <div class="activations-section">
          <h4 class="section-title">Activations History</h4>

          <!-- Loading State -->
          <van-loading v-if="loadingActivations" class="loading-spinner" />

          <!-- Activations Table -->
          <div v-else-if="summitActivations.length > 0" class="activations-table-container">
            <table class="activations-table">
              <thead>
                <tr>
                  <th @click="handleActivationSort('date')" class="sortable">
                    Date {{ getActivationSortIcon('date') }}
                  </th>
                  <th @click="handleActivationSort('activatedby')" class="sortable">
                    Activated By {{ getActivationSortIcon('activatedby') }}
                  </th>
                  <th @click="handleActivationSort('contacts')" class="sortable">
                    Contacts {{ getActivationSortIcon('contacts') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="activation in summitActivations"
                  :key="`${activation.date}-${activation.activatedby}`"
                  class="clickable-row"
                  @click="handleActivationRowClick(activation)"
                >
                  <td class="date">{{ formatDate(activation.date) }}</td>
                  <td class="callsign">{{ activation.activatedby }}</td>
                  <td class="contacts">{{ activation.contacts }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- No Activations State -->
          <van-empty
            v-else
            description="No activations recorded"
            :image-size="60"
          />
        </div>
      </div>
    </van-popup>

    <!-- Activation Detail Popup -->
    <van-popup
      v-model:show="showActivationDetailPopup"
      position="bottom"
      :style="{ height: '70%' }"
      round
    >
      <div class="activation-detail-popup">
        <div class="popup-header">
          <h3>Activation Details</h3>
          <van-icon name="cross" class="close-icon" @click="showActivationDetailPopup = false" />
        </div>

        <div v-if="selectedActivationDetail" class="activation-info">
          <div class="info-row">
            <span class="info-label">Summit:</span>
            <span class="info-value">{{ selectedActivationDetail.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Reference:</span>
            <span class="info-value wota-ref">{{ formatWotaReference(selectedActivationDetail.wotaid) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Callsign:</span>
            <span class="info-value callsign">{{ selectedActivationDetail.callsign }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">{{ formatDate(selectedActivationDetail.date) }}</span>
          </div>
        </div>

        <div class="contacts-section">
          <div class="contacts-header">
            <div class="contacts-title">Contacts ({{ activationDetailContacts.length }})</div>
            <van-button
              v-if="activationDetailContacts.length > 0"
              size="small"
              icon="description"
              @click="copyActivationAsMarkdown"
            >
              Copy as Markdown
            </van-button>
          </div>

          <div v-if="loadingActivationContacts" class="loading-container">
            <van-loading type="spinner" size="24" />
          </div>

          <div v-else-if="activationDetailContacts.length > 0" class="contacts-table-wrapper">
            <table class="contacts-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Callsign</th>
                  <th>Band</th>
                  <th>Mode</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(contact, index) in activationDetailContacts" :key="index">
                  <td>{{ formatTime(contact.time) }}</td>
                  <td class="callsign">
                    <a :href="`https://qrz.com/db/${contact.stncall}`" target="_blank" rel="noopener">
                      {{ contact.stncall }}
                    </a>
                  </td>
                  <td>{{ contact.band || '-' }}</td>
                  <td>{{ contact.mode || '-' }}</td>
                  <td>
                    <van-icon v-if="contact.confirmed" name="success" color="#07c160" />
                    <span v-else>-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="no-contacts">No contacts found</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.summits-view {
  padding: 8px;
  min-height: calc(100vh - 46px - 44px);
}

.search-section {
  margin-bottom: 8px;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f7f8fa;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #646566;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.summits-table-container {
  background: white;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.summits-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.summits-table thead {
  background: #f7f8fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.summits-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: #323233;
  border-bottom: 2px solid #ebedf0;
  white-space: nowrap;
}

.summits-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.summits-table th.sortable:hover {
  background: #ebedf0;
}

.summits-table td {
  padding: 8px;
  border-bottom: 1px solid #ebedf0;
  vertical-align: top;
}

.summits-table tbody tr:hover {
  background: #f7f8fa;
}

.summits-table tbody tr.clickable-row {
  cursor: pointer;
}

.wota-ref,
.sota-ref,
.hump-ref {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  color: #1989fa;
  font-weight: 700;
}

.name {
  font-weight: 500;
  color: #323233;
  max-width: 200px;
}

.height {
  text-align: right;
  font-weight: 500;
  color: #646566;
}

.book {
  text-align: center;
  font-weight: 600;
  color: #969799;
}

.grid {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #646566;
}

.callsign {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #323233;
  font-weight: 500;
}

.date {
  font-size: 13px;
  color: #646566;
  white-space: nowrap;
}

.contacts {
  font-size: 13px;
  color: #323233;
  font-weight: 600;
  text-align: center;
}

@media (max-width: 768px) {
  .summits-view {
    padding: 4px;
  }

  .summits-table {
    font-size: 12px;
  }

  .summits-table th,
  .summits-table td {
    padding: 6px 4px;
  }

  .name {
    max-width: 150px;
    word-wrap: break-word;
  }
}

/* Summit Detail Popup Styles */
.summit-detail-popup {
  padding: 16px;
}

.popup-title {
  font-size: 18px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #ebedf0;
}

.summit-details {
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f7f8fa;
}

.detail-label {
  font-weight: 600;
  color: #646566;
  width: 80px;
  flex-shrink: 0;
}

.detail-value {
  color: #323233;
  flex: 1;
}

.detail-row.two-col {
  display: flex;
  gap: 16px;
}

.detail-col {
  flex: 1;
  display: flex;
}

.detail-col .detail-label {
  width: 80px;
  min-width: 80px;
}

.activations-section {
  margin-top: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #ebedf0;
}

.activations-table-container {
  background: white;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid #ebedf0;
}

.activations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.activations-table thead {
  background: #f7f8fa;
}

.activations-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: #323233;
  border-bottom: 2px solid #ebedf0;
  white-space: nowrap;
}

.activations-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.activations-table th.sortable:hover {
  background: #ebedf0;
}

.activations-table td {
  padding: 8px;
  border-bottom: 1px solid #ebedf0;
  vertical-align: top;
}

.activations-table tbody tr:hover {
  background: #f7f8fa;
}

.activations-table tbody tr.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.activations-table tbody tr.clickable-row:hover {
  background: #f0f7ff;
}

/* Activation Detail Popup Styles */
.activation-detail-popup {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.activation-detail-popup .popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.activation-detail-popup .popup-header h3 {
  margin: 0;
  font-size: 18px;
  color: #323233;
}

.activation-detail-popup .close-icon {
  font-size: 20px;
  color: #969799;
  cursor: pointer;
}

.activation-detail-popup .activation-info {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.activation-detail-popup .info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.activation-detail-popup .info-label {
  color: #969799;
  font-size: 14px;
}

.activation-detail-popup .info-value {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.activation-detail-popup .info-value.wota-ref {
  color: #1989fa;
  font-family: monospace;
}

.activation-detail-popup .info-value.callsign {
  font-family: monospace;
  font-weight: 600;
}

.activation-detail-popup .contacts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.activation-detail-popup .contacts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.activation-detail-popup .contacts-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.activation-detail-popup .loading-container {
  text-align: center;
  padding: 20px;
}

.activation-detail-popup .contacts-table-wrapper {
  flex: 1;
  overflow-y: auto;
}

.activation-detail-popup .contacts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.activation-detail-popup .contacts-table th,
.activation-detail-popup .contacts-table td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.activation-detail-popup .contacts-table th {
  background: #f7f8fa;
  font-weight: 600;
  color: #323233;
  position: sticky;
  top: 0;
}

.activation-detail-popup .contacts-table td.callsign {
  font-family: monospace;
  font-weight: 600;
}

.activation-detail-popup .contacts-table td.callsign a {
  color: #1989fa;
  text-decoration: none;
}

.activation-detail-popup .contacts-table td.callsign a:hover {
  text-decoration: underline;
}

.activation-detail-popup .contacts-table tbody tr:hover {
  background: #f7f8fa;
}

.activation-detail-popup .no-contacts {
  text-align: center;
  color: #999;
  padding: 20px;
}

/* Map Section Styles */
.map-section {
  margin: 16px 0;
}

.summit-map {
  width: 100%;
  height: 300px;
  border-radius: 8px;
  border: 1px solid #ebedf0;
}

.detail-value.wota-ref {
  font-size: 20px;
}
.detail-value.sota-ref {
  font-size: 20px;
}
.detail-value.-ref {
  font-size: 20px;
}

.map-link {
  margin-top: 8px;
  text-align: center;
}

.map-link a {
  color: #1989fa;
  font-size: 13px;
  text-decoration: none;
}

.map-link a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .detail-row {
    flex-direction: column;
  }

  .detail-label {
    width: 100%;
    margin-bottom: 4px;
  }

  .activations-table {
    font-size: 12px;
  }

  .activations-table th,
  .activations-table td {
    padding: 6px 4px;
  }

  .summit-map {
    height: 250px;
  }
}
</style>

<!-- Unscoped styles for OpenLayers controls -->
<style>
.summit-map .ol-viewport {
  position: relative !important;
}

/* Ensure the overlay container with controls is visible */
.summit-map .ol-overlaycontainer-stopevent {
  z-index: 1 !important;
}

.summit-map .ol-control {
  position: absolute !important;
  border-radius: 4px;
  padding: 2px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.summit-map .ol-control button {
  display: flex !important;
  align-items: center;
  justify-content: center;
  margin: 1px;
  padding: 0;
  color: #333 !important;
  font-size: 18px;
  font-weight: bold;
  text-decoration: none;
  text-align: center;
  height: 28px !important;
  width: 28px !important;
  line-height: 28px;
  border: 1px solid #ccc !important;
  border-radius: 2px;
  cursor: pointer;
  opacity: 1 !important;
  visibility: visible !important;
}

.summit-map .ol-control button:hover,
.summit-map .ol-control button:focus {
  background-color: #f0f0f0 !important;
  color: #000 !important;
  border-color: #999 !important;
}

.summit-map .ol-zoom {
  top: 8px !important;
  left: 8px !important;
}

.summit-map .ol-full-screen {
  top: 8px !important;
  right: 8px !important;
}

.summit-map .ol-attribution {
  right: 8px !important;
  bottom: 8px !important;
  max-width: calc(100% - 16px);
  background-color: rgba(255, 255, 255, 0.8) !important;
  padding: 2px 4px;
  border-radius: 2px;
}

.summit-map .ol-attribution ul {
  font-size: 10px;
  color: #333;
  margin: 0;
  padding: 0;
}

.summit-map .ol-attribution li {
  display: inline;
  list-style: none;
}

.summit-map .ol-attribution a {
  color: #0066cc;
}

/* Hide the collapse button in attribution */
.summit-map .ol-attribution button {
  display: none !important;
}

/* Make sure rotate control doesn't interfere */
.summit-map .ol-rotate {
  display: none !important;
}
</style>
