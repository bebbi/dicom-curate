type TFieldValue = number | string

export type Row = { [columnName: string]: TFieldValue }

export type TColumnMappings = {
  headers: string[]
  rowValues: TFieldValue[][]
  rowIndexByFieldValue: {
    [header: string]: {
      [fieldValue: TFieldValue]: number
    }
  }
}

export function extractCsvMappingsFromRows(rows: Row[]): TColumnMappings {
  // If no rows, return empties
  if (rows.length === 0) {
    return {
      headers: [],
      rowValues: [],
      rowIndexByFieldValue: {},
    }
  }

  // Derive header names from the first row
  const headers = Object.keys(rows[0])

  // Prepare outputs
  const rowValues: TFieldValue[][] = []
  const rowIndexByFieldValue: {
    [header: string]: { [fv in TFieldValue]: number }
  } = {}

  // Initialize reverse‑lookup maps
  headers.forEach((h) => {
    rowIndexByFieldValue[h] = {}
  })

  // Build rowValues array and fill reverse indexes
  rows.forEach((row, rowIdx) => {
    // Flatten this row into an array of values in header order
    const values = headers.map((h) => row[h])
    rowValues.push(values)

    // Populate rowIndexByFieldValue
    values.forEach((fv, colIdx) => {
      const header = headers[colIdx]
      rowIndexByFieldValue[header][fv] = rowIdx
    })
  })

  return {
    headers,
    rowValues,
    rowIndexByFieldValue,
  }
}

export function csvMappingStringToRows(csvText: string): Row[] {
  const lines = csvText.trim().split(/\r\n|\r|\n/)

  if (lines.length < 2) {
    return []
  }

  // Parse headers (no more stray '\r' anywhere!)
  const headers = lines[0].split(',').map((h) => h.trim())

  // Build Row[] from the remaining lines
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())

    const obj: Row = {}
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? ''
    })
    return obj
  })
}

export function extractCsvMappings(csvText: string): TColumnMappings {
  const rows = csvMappingStringToRows(csvText)

  return extractCsvMappingsFromRows(rows)
}

export function getCsvMapping(
  columnMappings: TColumnMappings,
  value: TFieldValue,
  fromColumn: string,
  toColumn: string,
) {
  const rowIndex = columnMappings.rowIndexByFieldValue[fromColumn][value]
  const columnIndex = columnMappings.headers.indexOf(toColumn)
  return columnMappings.rowValues[rowIndex][columnIndex]
}
