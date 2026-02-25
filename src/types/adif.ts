export interface AdifRecord {
  call?: string
  qso_date?: string
  time_on?: string
  freq?: string
  band?: string
  mode?: string
  operator?: string
  station_callsign?: string
  sig?: string
  sig_info?: string
  rst_sent?: string
  rst_rcvd?: string
  my_sig?: string
  my_sig_info?: string
  my_sota_ref?: string
  sota_ref?: string
  [key: string]: string | undefined // Allow any other ADIF fields
}

export interface ParseError {
  recordIndex: number
  field?: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ParsedAdif {
  records: AdifRecord[]
  errors: ParseError[]
}

export interface ActivatorLogInput {
  activatedby: string
  callused: string
  wotaid: number
  date: Date
  time?: Date
  year: number
  stncall: string
  ucall: string
  rpt?: number
  s2s?: boolean
  confirmed?: boolean
  band?: string
  frequency?: number
  mode?: string
}

export interface ImportStatistics {
  totalQsos: number
  dateRange: { start: string; end: string } | null
  summits: number[]
  errors: number
  validRecords: number
}

export interface ImportResponse {
  success: boolean
  imported: number
  failed: number
  errors?: Array<{ record: number; reason: string }>
}

export interface DatabaseStatistics {
  activations: {
    total: number
    uniqueActivators: number
    uniqueSummits: number
    lastActivity: string | null
  }
  chases: {
    total: number
    uniqueChasers: number
    uniqueSummits: number
    lastActivity: string | null
  }
  summits: {
    total: number
    recentActivations?: Array<{
      wotaid: number
      name: string
      date: string
      callsign: string
    }>
  }
}

export interface Summit {
  wotaid: number
  sotaid?: number | null
  name: string
  reference: string
  height: number
  book: string
  last_act_by?: string | null
  last_act_date?: string | null
  humpid?: number | null
  gridid?: string | null
}

export interface SpotWithSummit {
  id: number
  datetime: string
  call: string
  wotaid: number
  freqmode: string
  comment: string
  spotter: string
  summitName: string | null
  sotaid: number | null
}

export interface AlertWithSummit {
  id: number
  datetime: string
  call: string
  wotaid: number
  freqmode: string
  comment: string | null
  postedby: string
  summitName: string | null
  sotaid: number | null
}

export interface MwisForecast {
  summary: string
  fetchedAt: string
}

export interface ChaserImportRecord {
  ucall: string
  stncall: string
  wotaRef: string
  sotaRef?: string
  wotaid?: number
  date: string
  time?: string
  year: number
  isValid: boolean
  validationErrors: string[]
  isDuplicate?: boolean
}

export interface ChaserImportResult {
  records: ChaserImportRecord[]
  totalRecords: number
  validRecords: number
  invalidRecords: number
}
