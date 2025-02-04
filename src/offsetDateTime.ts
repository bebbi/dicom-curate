import { parse, toSeconds, pattern } from 'iso8601-duration'

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

  throw new Error('Invalid DICOM date/time/datetime string')
}

export function dicomToCanonicalDT(dicomValue: string): string {
  // Helper to pad or truncate a string to a desired length.
  const pad = (s: string, length: number): string =>
    s.padEnd(length, '0').slice(0, length)

  const vr = getDicomVR(dicomValue)

  if (vr === 'DA') {
    // DA is in the format YYYYMMDD.
    // Append default time and fraction.
    return dicomValue + '000000.000000'
  } else if (vr === 'TM') {
    // TM is in the format HH[MM[SS[.FFFFFF]]].
    // Use a default date of 19700101.
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
      // The rest may contain seconds and an optional fractional part.
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
    // DT is in the format YYYYMMDDHHMMSS[.FFFFFF][(+|-)ZZZZ].
    // Extract the base date/time (first 14 digits).
    let base = dicomValue.slice(0, 14)
    if (base.length < 14) {
      base = base.padEnd(14, '0')
    }
    let frac = '000000'
    const dotIndex = dicomValue.indexOf('.')
    if (dotIndex !== -1) {
      // If a fractional part exists, it runs from the dot until a timezone indicator or end of string.
      // We ignore any timezone information.
      // Look for '+' or '-' after the dot.
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

  throw new Error('Unsupported DICOM VR')
}

export function canonicalDTToDicom(
  canonicalDT: string,
  original: string,
): string {
  const vr = getDicomVR(original)

  if (vr === 'DA') {
    // For DA, return the first 8 digits (YYYYMMDD)
    return canonicalDT.slice(0, 8)
  }

  if (vr === 'TM') {
    // For TM, canonicalDT is "19700101HHMMSS.FFFFFF".
    // Remove the default date ("19700101") to get the time portion.
    const timePortion = canonicalDT.slice(8) // yields "HHMMSS.FFFFFF"
    const dotIndex = original.indexOf('.')
    const baseLen = dotIndex !== -1 ? dotIndex : original.length // original base (e.g. "HHMMSS" or "HHMM")
    const baseTime = timePortion.slice(0, baseLen)
    let fraction = ''
    if (dotIndex !== -1) {
      // Determine how many digits the original fractional part had.
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
    // For DT, canonicalDT is in the form "YYYYMMDDHHMMSS.FFFFFF"
    const base = canonicalDT.slice(0, 14) // YYYYMMDDHHMMSS
    let fraction = ''
    let tz = ''
    const dotIndex = original.indexOf('.')
    if (dotIndex !== -1) {
      // Look for a timezone indicator after the fractional part.
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
      // No fractional part in the original; check for timezone info immediately after the base.
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

function getDurationFractionMicroseconds(iso8601Duration: string): number {
  const match = iso8601Duration.match(/(\d+)\.(\d+)S/)
  if (match) {
    let fracStr = match[2]
    // Ensure exactly 6 digits.
    fracStr = fracStr.padEnd(6, '0').slice(0, 6)
    return parseInt(fracStr, 10)
  }
  return 0
}

export function offsetDateTime(
  dicomValue: string,
  iso8601Duration: string,
): string {
  // 1. Convert to canonical DT.
  const canonical = dicomToCanonicalDT(dicomValue) // e.g., "123456" for TM becomes "19700101123456.123456"

  // 2. Split canonical DT.
  const base = canonical.slice(0, 14) // "YYYYMMDDHHMMSS"
  const fractionStr = canonical.slice(15, 21) // 6-digit fraction "FFFFFF"
  const originalFractionMicro = parseInt(fractionStr, 10) // microseconds as integer

  // 3. Parse the ISO8601 duration.
  const duration = parse(iso8601Duration)
  const totalDurationSec = toSeconds(duration) // full offset in seconds (as a float)
  const integerDurationSec = Math.floor(totalDurationSec)
  // And extract the fractional part manually.
  const durationFractionMicro = getDurationFractionMicroseconds(iso8601Duration)

  // 4. Compute new fractional microseconds.
  const totalFractionMicro = originalFractionMicro + durationFractionMicro
  const carry = Math.floor(totalFractionMicro / 1_000_000)
  const newFractionMicro = totalFractionMicro % 1_000_000

  // 5. Parse the base into a JavaScript Date.
  const year = parseInt(base.slice(0, 4), 10)
  const month = parseInt(base.slice(4, 6), 10) - 1
  const day = parseInt(base.slice(6, 8), 10)
  const hour = parseInt(base.slice(8, 10), 10)
  const minute = parseInt(base.slice(10, 12), 10)
  const second = parseInt(base.slice(12, 14), 10)
  const date = new Date(year, month, day, hour, minute, second)

  // 6. Add the integer seconds and any carry from the fraction.
  date.setSeconds(date.getSeconds() + integerDurationSec + carry)

  // 7. Reassemble the new canonical DT.
  const pad = (n: number, width: number = 2) =>
    n.toString().padStart(width, '0')
  const newBase = `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}`
  const newFractionStr = newFractionMicro.toString().padStart(6, '0')
  const newCanonical = newBase + '.' + newFractionStr

  // 8. Convert canonical DT back to original DICOM format.
  return canonicalDTToDicom(newCanonical, dicomValue)
}
