import {parseWotaReference} from '../utils/wotaReference'
import type {ImportStatistics, ParsedAdif, ParseError, ChaserImportRecord, ChaserImportResult} from '../types/adif'

interface CsvRecord {
  version: string
  callsign: string
  reference: string
  date: string
  time: string
  frequency: string
  mode: string
  stationWorked: string
  s2sReference?: string
  comment?: string
}

interface ChaserCsvRecord {
  version: string
  chaserCallsign: string
  column2: string  // Not used for chaser logs
  date: string
  time: string
  frequency: string
  mode: string
  activatorCallsign: string
  column8: string  // Optional
  wotaReference: string  // Column 9 - the activator's summit reference
}

export async function parseCsvFile(file: File): Promise<ParsedAdif> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const result = await parseCsvContent(content)
        resolve(result)
      } catch (error) {
        reject(new Error(`Failed to parse CSV file: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

export async function parseCsvContent(content: string): Promise<ParsedAdif> {
  const lines = content.split(/\r?\n/).filter(line => line.trim())

  const records: CsvRecord[] = []
  const errors: ParseError[] = []

  // Parse CSV lines
  lines.forEach((line, index) => {
    const parts = line.split(',').map(p => p.trim())

    if (parts.length < 8) {
      errors.push({
        recordIndex: index,
        message: `Line ${index + 1}: Insufficient columns (expected at least 8, got ${parts.length})`,
      })
      return
    }

    if (parts[0] !== 'V2') {
      errors.push({
        recordIndex: index,
        message: `Line ${index + 1}: Invalid version "${parts[0]}" (expected V2)`,
      })
      return
    }

    records.push({
      version: parts[0]!,
      callsign: parts[1]!,
      reference: parts[2]!,
      date: parts[3]!,
      time: parts[4]!,
      frequency: parts[5]!,
      mode: parts[6]!,
      stationWorked: parts[7]!,
      s2sReference: parts[8] || undefined,  // Optional column 9
      comment: parts[9] || undefined,        // Optional column 10 (ignored)
    })
  })

  // Convert SOTA references to WOTA references
  await convertSotaToWota(records)

  // Convert S2S SOTA references to WOTA references
  await convertS2sSotaToWota(records)

  // Convert to ADIF-like format for compatibility
  const adifLikeRecords = records.map((record) => ({
    call: record.stationWorked,
    qso_date: parseDateToAdifFormat(record.date),
    time_on: record.time,
    station_callsign: record.callsign,
    operator: record.callsign,
    my_sig_info: record.reference,
    my_sig: record.reference.toUpperCase().startsWith('LDW') || record.reference.toUpperCase().startsWith('LDO') ? 'WOTA' : 'SOTA',
    sig_info: record.s2sReference,  // S2S reference from column 9
    sig: record.s2sReference ? (
      record.s2sReference.toUpperCase().startsWith('LDW') ||
      record.s2sReference.toUpperCase().startsWith('LDO') ? 'WOTA' : 'SOTA'
    ) : undefined,
    // Frequency is only used to determine band, not stored in database
    band: frequencyToBand(record.frequency),
    mode: record.mode,
  }))

  return { records: adifLikeRecords, errors }
}

async function convertSotaToWota(records: CsvRecord[]): Promise<void> {
  const { apiClient } = await import('./api')

  for (const record of records) {
    const ref = record.reference.toUpperCase()
    if (ref.startsWith('G/LD-')) {
      try {
        console.log(`Looking up SOTA reference: ${record.reference}`)
        const summit = await apiClient.lookupSotaReference(record.reference)
        if (summit) {
          console.log(`Found summit for ${record.reference}: ${summit.name} (wotaid: ${summit.wotaid})`)
          // Convert to WOTA format
          if (summit.wotaid <= 214) {
            record.reference = `LDW-${String(summit.wotaid).padStart(3, '0')}`
          } else {
            record.reference = `LDO-${String(summit.wotaid - 214).padStart(3, '0')}`
          }
        } else {
          console.warn(`No summit found in database for SOTA reference: ${record.reference}`)
        }
      } catch (error) {
        console.error(`Error looking up SOTA reference ${record.reference}:`, error)
      }
    }
  }
}

async function convertS2sSotaToWota(records: CsvRecord[]): Promise<void> {
  const { apiClient } = await import('./api')

  for (const record of records) {
    // Convert S2S SOTA reference (station worked's summit) to WOTA
    if (record.s2sReference) {
      const ref = record.s2sReference.toUpperCase()

      // If it's already a WOTA reference, keep it as-is
      if (ref.startsWith('LDW-') || ref.startsWith('LDO-')) {
        continue
      }

      // If it's a G/LD SOTA reference, try to convert to WOTA
      if (ref.startsWith('G/LD-')) {
        try {
          console.log(`Looking up S2S SOTA reference: ${record.s2sReference}`)
          const summit = await apiClient.lookupSotaReference(record.s2sReference)
          if (summit) {
            console.log(`Found WOTA summit for ${record.s2sReference}: ${summit.name} (wotaid: ${summit.wotaid})`)
            // Convert to WOTA format
            if (summit.wotaid <= 214) {
              record.s2sReference = `LDW-${String(summit.wotaid).padStart(3, '0')}`
            } else {
              record.s2sReference = `LDO-${String(summit.wotaid - 214).padStart(3, '0')}`
            }
          } else {
            console.log(`S2S SOTA reference ${record.s2sReference} is not a WOTA summit - clearing s2sReference`)
            // Not a WOTA summit, so clear the s2sReference
            record.s2sReference = undefined
          }
        } catch (error) {
          console.error(`Error looking up S2S SOTA reference ${record.s2sReference}:`, error)
        }
      } else if (ref.match(/^[A-Z0-9]+\/[A-Z0-9]+-\d+$/)) {
        // It's a non-G/LD SOTA reference (e.g., LA/OS-001, SP/BZ-084)
        // These are not WOTA summits, so clear the s2sReference
        console.log(`S2S SOTA reference ${record.s2sReference} is not a Lake District summit - clearing s2sReference`)
        record.s2sReference = undefined
      }
    }
  }
}

function parseDateToAdifFormat(dateStr: string): string {
  // Convert dd/mm/yy to YYYYMMDD
  const parts = dateStr.split('/')
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }

  const day = parts[0]!.padStart(2, '0')
  const month = parts[1]!.padStart(2, '0')
  let year = parts[2]!

  // Handle 2-digit year
  if (year.length === 2) {
    const yearNum = parseInt(year, 10)
    // Assume 00-49 is 2000-2049, 50-99 is 1950-1999
    year = yearNum < 50 ? `20${year}` : `19${year}`
  }

  return `${year}${month}${day}`
}

function frequencyToBand(freqStr: string): string {
  // Convert frequency to band name
  const match = freqStr.match(/^(\d+(?:\.\d+)?)\s*([MK]?Hz)?$/i)
  if (!match) {
    return ''
  }

  const value = parseFloat(match[1]!)
  const unit = match[2]?.toUpperCase() || 'MHZ'

  let freqMhz = value
  if (unit === 'KHZ') {
    freqMhz = value / 1000
  } else if (unit === 'HZ') {
    freqMhz = value / 1000000
  }

  // Map frequency to band
  // Note: Some ranges are extended to handle common shorthand notations (e.g., "18MHz" for 17m band)
  if (freqMhz >= 1.8 && freqMhz <= 2.0) return '160m'
  if (freqMhz >= 3.5 && freqMhz <= 4.0) return '80m'
  if (freqMhz >= 5.3 && freqMhz <= 5.4) return '60m'
  if (freqMhz >= 7.0 && freqMhz <= 7.3) return '40m'
  if (freqMhz >= 10.1 && freqMhz <= 10.15) return '30m'
  if (freqMhz >= 14.0 && freqMhz <= 14.35) return '20m'
  if (freqMhz >= 18.0 && freqMhz <= 18.2) return '17m'  // Extended to include "18MHz" shorthand
  if (freqMhz >= 21.0 && freqMhz <= 21.45) return '15m'
  if (freqMhz >= 24.89 && freqMhz <= 24.99) return '12m'
  if (freqMhz >= 28.0 && freqMhz <= 29.7) return '10m'
  if (freqMhz >= 50.0 && freqMhz <= 54.0) return '6m'
  if (freqMhz >= 70.0 && freqMhz <= 70.5) return '4m'
  if (freqMhz >= 144.0 && freqMhz <= 148.0) return '2m'
  if (freqMhz >= 220.0 && freqMhz <= 225.0) return '1.25m'
  if (freqMhz >= 430.0 && freqMhz <= 440.0) return '70cm'
  if (freqMhz >= 902.0 && freqMhz <= 928.0) return '33cm'
  if (freqMhz >= 1240.0 && freqMhz <= 1300.0) return '23cm'

  return ''
}

export function calculateStatistics(
  records: any[],
  errors: ParseError[]
): ImportStatistics {
  const validRecords = records.filter((r) => r.qso_date && r.call)

  const dates = validRecords
    .map((r) => r.qso_date)
    .filter((d): d is string => !!d)
    .sort()

  const summitIds = validRecords
    .map((r) => {
      if (!r.my_sig_info) return null
      return parseWotaReference(r.my_sig_info.toUpperCase())
    })
    .filter((id): id is number => id !== null)

  const uniqueSummits = Array.from(new Set(summitIds))

  return {
    totalQsos: records.length,
    dateRange:
      dates.length > 0
        ? {
            start: formatAdifDate(dates[0]!),
            end: formatAdifDate(dates[dates.length - 1]!),
          }
        : null,
    summits: uniqueSummits,
    errors: errors.length,
    validRecords: validRecords.length,
  }
}

function formatAdifDate(adifDate: string): string {
  // Convert YYYYMMDD to YYYY-MM-DD
  const year = adifDate.substring(0, 4)
  const month = adifDate.substring(4, 6)
  const day = adifDate.substring(6, 8)
  return `${year}-${month}-${day}`
}

function formatCsvTime(timeStr: string): string {
  // CSV time is in format HH:MM or HHMM
  // Convert to HH:MM:SS format
  const cleaned = timeStr.replace(':', '')
  if (cleaned.length === 4) {
    const hours = cleaned.substring(0, 2)
    const minutes = cleaned.substring(2, 4)
    return `${hours}:${minutes}:00`
  }
  return timeStr
}

/**
 * Parse CSV file for chaser log import
 * Column 9 must contain a valid WOTA reference
 */
export async function parseChaserCsvFile(file: File): Promise<ChaserImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const lines = content.split(/\r?\n/).filter(line => line.trim())

        const csvRecords: ChaserCsvRecord[] = []
        const parseErrors: ParseError[] = []

        // Parse CSV lines
        lines.forEach((line, index) => {
          const parts = line.split(',').map(p => p.trim())

          // Must have at least 10 columns (0-9) for column 9 to exist
          if (parts.length < 10) {
            parseErrors.push({
              recordIndex: index,
              message: `Line ${index + 1}: Insufficient columns (expected at least 10 for chaser log, got ${parts.length})`,
            })
            return
          }

          if (parts[0] !== 'V2') {
            parseErrors.push({
              recordIndex: index,
              message: `Line ${index + 1}: Invalid version "${parts[0]}" (expected V2)`,
            })
            return
          }

          csvRecords.push({
            version: parts[0]!,
            chaserCallsign: parts[1]!,
            column2: parts[2]!,
            date: parts[3]!,
            time: parts[4]!,
            frequency: parts[5]!,
            mode: parts[6]!,
            activatorCallsign: parts[7]!,
            column8: parts[8]!,
            wotaReference: parts[9]!,  // Column 9 - the critical field
          })
        })

        // Convert SOTA references in column 9 to WOTA if needed
        await convertChaserSotaToWota(csvRecords)

        // Convert to ChaserImportRecord format
        const records: ChaserImportRecord[] = []

        csvRecords.forEach((csvRecord, index) => {
          const validationErrors: string[] = []

          // Validate WOTA reference in column 9
          const wotaRef = csvRecord.wotaReference.toUpperCase()
          let wotaId: number | null = null

          if (!wotaRef) {
            validationErrors.push('Column 9 (WOTA reference) is required')
          } else if (!wotaRef.startsWith('LDW-') && !wotaRef.startsWith('LDO-')) {
            validationErrors.push(`Column 9 must contain a valid WOTA reference (LDW-xxx or LDO-xxx), got: ${wotaRef}`)
          } else {
            wotaId = parseWotaReference(wotaRef)
            if (wotaId === null) {
              validationErrors.push(`Invalid WOTA reference format: ${wotaRef}`)
            }
          }

          // Validate required fields
          if (!csvRecord.chaserCallsign) {
            validationErrors.push('Chaser callsign (column 1) is required')
          }

          if (!csvRecord.activatorCallsign) {
            validationErrors.push('Activator callsign (column 7) is required')
          }

          if (!csvRecord.date) {
            validationErrors.push('Date (column 3) is required')
          }

          // Parse date
          let formattedDate = ''
          let year = 0
          try {
            const adifDate = parseDateToAdifFormat(csvRecord.date)
            formattedDate = formatAdifDate(adifDate)
            year = parseInt(adifDate.substring(0, 4))
          } catch (error) {
            validationErrors.push(`Invalid date format: ${csvRecord.date}`)
          }

          // Validate year (2009-2026)
          const validYears = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                              2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
          if (year && !validYears.includes(year)) {
            validationErrors.push(`Invalid year: ${year}. Must be between 2009-2026`)
          }

          records.push({
            ucall: csvRecord.chaserCallsign,
            stncall: csvRecord.activatorCallsign,
            wotaRef: wotaRef,
            wotaid: wotaId || undefined,
            date: formattedDate,
            time: csvRecord.time ? formatCsvTime(csvRecord.time) : undefined,
            year,
            isValid: validationErrors.length === 0,
            validationErrors
          })
        })

        const validRecords = records.filter(r => r.isValid).length

        resolve({
          records,
          totalRecords: records.length,
          validRecords,
          invalidRecords: records.length - validRecords
        })
      } catch (error) {
        reject(new Error(`Failed to parse chaser CSV file: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

async function convertChaserSotaToWota(records: ChaserCsvRecord[]): Promise<void> {
  const { apiClient } = await import('./api')

  for (const record of records) {
    // Convert WOTA reference in column 9 from SOTA to WOTA if needed
    const ref = record.wotaReference.toUpperCase()
    if (ref.startsWith('G/LD-')) {
      try {
        console.log(`Looking up SOTA reference in column 9: ${record.wotaReference}`)
        const summit = await apiClient.lookupSotaReference(record.wotaReference)
        if (summit) {
          console.log(`Found summit for ${record.wotaReference}: ${summit.name} (wotaid: ${summit.wotaid})`)
          // Convert to WOTA format
          if (summit.wotaid <= 214) {
            record.wotaReference = `LDW-${String(summit.wotaid).padStart(3, '0')}`
          } else {
            record.wotaReference = `LDO-${String(summit.wotaid - 214).padStart(3, '0')}`
          }
        } else {
          console.warn(`No summit found in database for SOTA reference: ${record.wotaReference}`)
        }
      } catch (error) {
        console.error(`Error looking up SOTA reference ${record.wotaReference}:`, error)
      }
    }
  }
}
