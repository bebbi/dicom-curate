type TFieldValue = number | string

export type Row = { [columnName: string]: TFieldValue }

export type TMappedValues = {
  [key: string]: {
    value: (
      // parser: Pick<TParser, 'getDicom' | 'getFilePathComp' | 'getFrom'>,
      parser: {
        getDicom: (attrName: string) => any
        getFilePathComp: (component: string | number | symbol) => string
        getFrom: (source: string, identifier: string) => string | number
      },
    ) => string | number // is TFieldValue
    replace: (row: Row) => TFieldValue
    lookup: (row: Row) => TFieldValue
  }
}

export type TColumnMappings = {
  /** original rows, so that replace(row) can work */
  rows: Row[]

  /** for each mappingKey, a map from that mapping’s lookup(row) → rowIndex */
  rowIndexByFieldValue: {
    // `mappingKey` per the definitions in `mapping`
    [mappingKey: string]: {
      [fieldValue: TFieldValue]: number
    }
  }
}

export function csvTextToRows(csvText: string): Row[] {
  const lines = csvText.trim().split(/\r\n|\r|\n/)

  if (lines.length < 2) {
    return []
  }

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

export function extractColumnMappings(
  rows: Row[],
  mapping: TMappedValues,
): TColumnMappings {
  const rowIndexByFieldValue: TColumnMappings['rowIndexByFieldValue'] = {}

  for (const key of Object.keys(mapping)) {
    const fn = mapping[key].lookup
    rowIndexByFieldValue[key] = {}
    rows.forEach((row, i) => {
      const v = fn(row)
      // It's a denormalized dataset, so we don't care if the index is overwritten
      // by a later row with the same value.
      rowIndexByFieldValue[key][v] = i
    })
  }

  return { rows, rowIndexByFieldValue }
}

export function extractCsvMappings(
  csvText: string,
  mapping: TMappedValues,
): TColumnMappings {
  const rows = csvTextToRows(csvText)

  return extractColumnMappings(rows, mapping)
}

export function getCsvMapping(
  columnMappings: TColumnMappings,
  mapping: TMappedValues,
  mappingKey: string,
  value: TFieldValue,
): TFieldValue {
  const rowIdx = columnMappings.rowIndexByFieldValue[mappingKey][value]

  if (rowIdx == null) {
    throw new Error(`No row for ${mappingKey} / ${value}`)
  }

  return mapping[mappingKey].replace(columnMappings.rows[rowIdx])
}
