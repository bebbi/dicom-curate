import { parse, pattern } from 'iso8601-duration'

export const iso8601 = pattern

// Define an optional timezone regex: a sign followed by exactly 4 digits.
const timezonePattern = '(?:[-+]\\d{4})?'

const dtRegex = new RegExp(
  '^' +
    // Date: exactly 8 digits
    '\\d{8}' +
    // Time: at least 2 digits for hour, optionally minutes and seconds
    '\\d{2}(?:\\d{2}(?:\\d{2})?)?' +
    // Optional fractional seconds
    '(?:\\.\\d+)?' +
    // Optional timezone offset
    timezonePattern +
    '$',
)

const tmRegex = new RegExp(
  '^' +
    // Time: 2 digits for hour, optionally minutes and seconds
    '\\d{2}(?:\\d{2}(?:\\d{2})?)?' +
    // Optional fractional seconds
    '(?:\\.\\d+)?' +
    '$',
)

export function getDicomVR(value: string): 'DA' | 'DT' | 'TM' {
  // DA: exactly 8 digits (YYYYMMDD)
  if (/^\d{8}$/.test(value)) {
    return 'DA'
  }

  // DT: Must have at least 8 digits (date) + 2 digits (hour),
  // optionally additional digits for minutes/seconds, an optional fractional part,
  // and an optional timezone offset.
  if (dtRegex.test(value)) {
    return 'DT'
  }

  // TM: Must have 2, 4, or 6 digits (for HH, HHMM, or HHMMSS),
  // optionally a fractional part, and an optional timezone offset.
  if (tmRegex.test(value)) {
    return 'TM'
  }

  throw new Error(`Invalid DICOM date/time/datetime string "${value}"`)
}

/**
 * Converts any DICOM date/time string (DA, TM, or DT) into a canonical DT string
 * of the form "YYYYMMDDHHMMSS.FFFFFF" (timezone information is dropped).
 */
export function dicomToCanonicalDT(dicomValue: string): string {
  const pad = (s: string, length: number): string =>
    s.padEnd(length, '0').slice(0, length)
  const vr = getDicomVR(dicomValue)

  if (vr === 'DA') {
    return dicomValue + '000000.000000'
  } else if (vr === 'TM') {
    let hh = '00',
      mm = '00',
      ss = '00',
      frac = '000000'
    const len = dicomValue.length
    if (len >= 2) {
      hh = dicomValue.slice(0, 2)
    }
    if (len >= 4) {
      mm = dicomValue.slice(2, 4)
    }
    if (len >= 6) {
      const rest = dicomValue.slice(4)
      const dotIndex = rest.indexOf('.')
      if (dotIndex === -1) {
        ss = pad(rest.slice(0, 2), 2)
      } else {
        ss = pad(rest.slice(0, dotIndex), 2)
        frac = pad(rest.slice(dotIndex + 1), 6)
      }
    }
    return '19700101' + hh + mm + ss + '.' + frac
  } else if (vr === 'DT') {
    let base = dicomValue.slice(0, 14)
    if (base.length < 14) {
      base = base.padEnd(14, '0')
    }
    let frac = '000000'
    const dotIndex = dicomValue.indexOf('.')
    if (dotIndex !== -1) {
      const afterDot = dicomValue.slice(dotIndex + 1)
      const tzPos = afterDot.search(/[+-]/)
      if (tzPos === -1) {
        frac = pad(afterDot, 6)
      } else {
        frac = pad(afterDot.slice(0, tzPos), 6)
      }
    }
    return base + '.' + frac
  }
  throw new Error(`Unsupported DICOM VR "${vr}"`)
}

/**
 * Converts a canonical DT string ("YYYYMMDDHHMMSS.FFFFFF") back to a DICOM string
 * that matches the original formatting (including re‑adding any timezone information).
 */
export function canonicalDTToDicom(
  canonicalDT: string,
  original: string,
): string {
  const vr = getDicomVR(original)

  if (vr === 'DA') {
    return canonicalDT.slice(0, 8)
  }
  if (vr === 'TM') {
    const timePortion = canonicalDT.slice(8) // "HHMMSS.FFFFFF"
    const dotIndex = original.indexOf('.')
    const baseLen = dotIndex !== -1 ? dotIndex : original.length
    const baseTime = timePortion.slice(0, baseLen)
    let fraction = ''
    if (dotIndex !== -1) {
      const fracDigits = original.length - dotIndex - 1
      let canonicalFrac = canonicalDT.slice(canonicalDT.indexOf('.') + 1)
      if (canonicalFrac.length > fracDigits) {
        canonicalFrac = canonicalFrac.slice(0, fracDigits)
      } else if (canonicalFrac.length < fracDigits) {
        canonicalFrac = canonicalFrac.padEnd(fracDigits, '0')
      }
      fraction = '.' + canonicalFrac
    }
    return baseTime + fraction
  }
  if (vr === 'DT') {
    const base = canonicalDT.slice(0, 14)
    let fraction = ''
    let tz = ''
    const dotIndex = original.indexOf('.')
    if (dotIndex !== -1) {
      const plusIndex = original.indexOf('+', dotIndex)
      const minusIndex = original.indexOf('-', dotIndex)
      let tzIndex = -1
      if (plusIndex !== -1 && minusIndex !== -1) {
        tzIndex = Math.min(plusIndex, minusIndex)
      } else if (plusIndex !== -1) {
        tzIndex = plusIndex
      } else if (minusIndex !== -1) {
        tzIndex = minusIndex
      }
      const endFrac = tzIndex !== -1 ? tzIndex : original.length
      const origFrac = original.slice(dotIndex + 1, endFrac)
      const desiredDigits = origFrac.length
      let canonicalFrac = canonicalDT.slice(canonicalDT.indexOf('.') + 1)
      if (canonicalFrac.length > desiredDigits) {
        canonicalFrac = canonicalFrac.slice(0, desiredDigits)
      } else if (canonicalFrac.length < desiredDigits) {
        canonicalFrac = canonicalFrac.padEnd(desiredDigits, '0')
      }
      fraction = '.' + canonicalFrac
      if (tzIndex !== -1) {
        tz = original.slice(tzIndex)
      }
    } else {
      if (original.length > 14) {
        const afterBase = original.slice(14)
        if (afterBase[0] === '+' || afterBase[0] === '-') {
          tz = afterBase
        }
      }
    }
    return base + fraction + tz
  }
  throw new Error('Unsupported DICOM VR')
}

/**
 * Extracts the fractional part from the seconds portion of an ISO8601 duration string,
 * returning the value in microseconds (6-digit precision). If no fractional part is found,
 * returns 0.
 *
 * For example, "PT1.111111S" yields 111111.
 */
function getDurationFractionMicroseconds(iso8601Duration: string): number {
  const match = iso8601Duration.match(/(\d+)\.(\d+)S/)
  if (match) {
    let fracStr = match[2]
    fracStr = fracStr.padEnd(6, '0').slice(0, 6)
    return parseInt(fracStr, 10)
  }
  return 0
}

/**
 * Offsets a DICOM date/time value by an ISO8601 duration.
 *
 * This function:
 *   1. Converts the original DICOM string into a canonical DT string ("YYYYMMDDHHMMSS.FFFFFF").
 *   2. Splits that canonical string into its integer base (14-digit) and 6-digit fractional part.
 *   3. Checks if the duration is negative (by looking for a leading "-") and, if so, removes the minus and records the sign.
 *   4. Parses the ISO8601 duration using the package for the calendar units (years, months, days)
 *      and time units (hours, minutes, seconds) separately.
 *   5. Uses JavaScript Date methods for calendar arithmetic (years, months, days).
 *   6. Uses Date methods for time arithmetic (hours, minutes, seconds).
 *   7. Performs microsecond arithmetic to add the fractional seconds, carrying whole seconds as needed.
 *   8. Reassembles a new canonical DT string and converts it back to the original DICOM format.
 *
 * Note: This function uses JavaScript's Date arithmetic, which means it exhibits standard overflow behavior.
 * For example: Jan 31 + 1 month = March 3 (Feb 31 doesn't exist, so it overflows).
 * Similarly: Feb 29, 2024 + 1 year = March 1, 2025 (2025 is not a leap year).
 *
 * @param dicomValue - The original DICOM date/time string.
 * @param iso8601Duration - An ISO8601 duration string (e.g., "PT1.111111S", "-P5D", "-PT1.111111S", etc.).
 * @returns The offset DICOM string, formatted like the original.
 */
export function offsetDateTime(
  dicomValue: string,
  iso8601Duration: string,
): string {
  // Step 0: Trim leading/trailing spaces from the DICOM value
  const trimmedDicomValue = dicomValue.trim()

  // Step 0.5: Detect and handle a leading minus sign.
  let sign = 1
  let durationStr = iso8601Duration
  if (iso8601Duration.startsWith('-')) {
    sign = -1
    durationStr = iso8601Duration.slice(1)
  }

  // Step 1: Convert the original DICOM string to a canonical DT string.
  const canonical = dicomToCanonicalDT(trimmedDicomValue) // Format: "YYYYMMDDHHMMSS.FFFFFF"

  // Step 2: Split the canonical DT string.
  const base = canonical.slice(0, 14) // 14-digit base: YYYYMMDDHHMMSS
  const fractionStr = canonical.slice(15, 21) // 6-digit fractional part: FFFFFF
  const originalFractionMicro = parseInt(fractionStr, 10) // as an integer microseconds

  // Step 3: Parse the ISO8601 duration (without the sign).
  const durationParsed = parse(durationStr)

  // Step 4: Extract the fractional part (microseconds) from the duration string and apply the sign.
  let durationFractionMicro = getDurationFractionMicroseconds(durationStr)
  durationFractionMicro = sign * durationFractionMicro

  // Step 5: Add the fractional parts (in microseconds) and compute any carry.
  const totalFractionMicro = originalFractionMicro + durationFractionMicro
  const carry = Math.floor(totalFractionMicro / 1_000_000)
  const newFractionMicro = totalFractionMicro - carry * 1_000_000

  // Step 6: Parse the base into a JavaScript Date.
  const year = parseInt(base.slice(0, 4), 10)
  const month = parseInt(base.slice(4, 6), 10) - 1
  const day = parseInt(base.slice(6, 8), 10)
  const hour = parseInt(base.slice(8, 10), 10)
  const minute = parseInt(base.slice(10, 12), 10)
  const second = parseInt(base.slice(12, 14), 10)
  const date = new Date(year, month, day, hour, minute, second)

  // Step 7: Apply calendar arithmetic using Date methods to handle variable-length months/years correctly.
  // Apply years, months, and weeks first (calendar units)
  if (durationParsed.years) {
    date.setFullYear(date.getFullYear() + sign * durationParsed.years)
  }
  if (durationParsed.months) {
    date.setMonth(date.getMonth() + sign * durationParsed.months)
  }
  if (durationParsed.weeks) {
    date.setDate(date.getDate() + sign * durationParsed.weeks * 7)
  }
  if (durationParsed.days) {
    date.setDate(date.getDate() + sign * durationParsed.days)
  }

  // Apply time units (hours, minutes, seconds)
  if (durationParsed.hours) {
    date.setHours(date.getHours() + sign * durationParsed.hours)
  }
  if (durationParsed.minutes) {
    date.setMinutes(date.getMinutes() + sign * durationParsed.minutes)
  }
  if (durationParsed.seconds) {
    // Use only the integer part of seconds since fractional part is handled separately
    date.setSeconds(
      date.getSeconds() + sign * Math.trunc(durationParsed.seconds),
    )
  }

  // Apply any carry from fractional seconds
  date.setSeconds(date.getSeconds() + carry)

  // Step 8: Reassemble a new canonical DT string.
  const pad = (n: number, width: number = 2) =>
    n.toString().padStart(width, '0')
  const newBase = `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}`
  const newFractionStr = newFractionMicro.toString().padStart(6, '0')
  const newCanonical = newBase + '.' + newFractionStr

  // Step 9: Convert the canonical DT back to the original DICOM format.
  return canonicalDTToDicom(newCanonical, trimmedDicomValue)
}
