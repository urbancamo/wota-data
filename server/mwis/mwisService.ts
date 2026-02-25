import { logger } from '../logger'

const MWIS_URL = 'https://www.mwis.org.uk/forecasts/english-and-welsh/lake-district/text'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const TIMEOUT_MS = 15_000

export interface MwisForecast {
  summary: string
  fetchedAt: string
}

let cachedForecast: MwisForecast | null = null
let cachedAt: number = 0

function extractFirstParagraph(text: string, heading: string): string | null {
  const headingIndex = text.indexOf(heading)
  if (headingIndex === -1) return null

  const afterHeading = text.substring(headingIndex + heading.length).trim()
  const lines = afterHeading.split('\n')
  const contentLines: string[] = []

  let foundContent = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (foundContent) break
      continue
    }
    foundContent = true
    contentLines.push(trimmed)
  }

  return contentLines.join(' ').trim() || null
}

function parseTodayForecast(html: string): string | null {
  // Strip HTML tags to get plain text, preserving block structure as newlines
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Block-level elements get newlines to preserve document structure
    .replace(/<\/?(h[1-6]|p|div|li|tr|br\s*\/?)[^>]*>/gi, '\n')
    // Remaining inline tags become spaces
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&deg;/g, '\u00B0')
    .replace(/&#?\w+;/g, '')
    // Collapse spaces within lines but preserve newlines
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  // Find today's forecast section - look for the first "Headline for Lake District"
  // or the content between the first date heading and the next date heading
  const headline = extractFirstParagraph(text, 'Headline for Lake District')
  const wind = extractFirstParagraph(text, 'How windy? (On the summits)')
  const windEffect = extractFirstParagraph(text, 'Effect of the wind on you?')
  const rain = extractFirstParagraph(text, 'How Wet?')
  const cloud = extractFirstParagraph(text, 'Cloud on the hills?')
  const cloudFree = extractFirstParagraph(text, 'Chance of cloud free summits?')
  const visibility = extractFirstParagraph(text, 'Sunshine and air clarity?')
  const temperature = extractFirstParagraph(text, 'How Cold? (at 750m)')
  const freezing = extractFirstParagraph(text, 'Freezing Level')

  if (!headline && !wind && !rain) {
    logger.warn('Could not parse any MWIS forecast sections from page')
    return null
  }

  // Build compact ticker summary
  const parts: string[] = []

  parts.push('LAKE DISTRICT MOUNTAIN WEATHER')

  if (headline) {
    parts.push(headline)
  }

  if (wind) {
    parts.push(`WIND: ${wind}`)
  }

  if (windEffect) {
    parts.push(windEffect)
  }

  if (rain) {
    parts.push(`RAIN: ${rain}`)
  }

  if (cloud) {
    let cloudText = `CLOUD: ${cloud}`
    if (cloudFree) {
      cloudText += `, ${cloudFree} chance of clear summits`
    }
    parts.push(cloudText)
  }

  if (visibility) {
    parts.push(`VIS: ${visibility}`)
  }

  if (temperature) {
    let tempText = `TEMP: ${temperature}`
    if (freezing) {
      tempText += ` / Freezing: ${freezing}`
    }
    parts.push(tempText)
  }

  return parts.join(' ... ') + ' ............'
}

export async function fetchMwisForecast(): Promise<MwisForecast | null> {
  // Return cached if still fresh
  if (cachedForecast && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedForecast
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    logger.info('Fetching MWIS forecast')
    const response = await fetch(MWIS_URL, { signal: controller.signal })

    if (!response.ok) {
      logger.warn({ status: response.status }, 'MWIS returned non-OK status')
      return cachedForecast // Return stale cache if available
    }

    const html = await response.text()
    const summary = parseTodayForecast(html)

    if (!summary) {
      logger.warn('Failed to parse MWIS forecast')
      return cachedForecast
    }

    cachedForecast = {
      summary,
      fetchedAt: new Date().toISOString(),
    }
    cachedAt = Date.now()

    logger.info({ summaryLength: summary.length }, 'MWIS forecast cached')
    return cachedForecast
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.warn('MWIS request timed out')
    } else {
      logger.warn({ error }, 'Failed to fetch MWIS forecast')
    }
    return cachedForecast // Return stale cache if available
  } finally {
    clearTimeout(timeout)
  }
}
