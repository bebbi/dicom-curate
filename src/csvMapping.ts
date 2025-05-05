type TFieldValue = number | string

export type TColumnMappings = {
  headers: string[]
  rowValues: { [rowIdx: number]: TFieldValue[] }
  rowIndexByFieldValue: {
    [header: string]: {
      [fieldValue: TFieldValue]: number
    }
  }
}

export function extractCsvMappings(csvText: string) {
  const rows = csvText.trim().split('\n')
  const headers = rows.slice(0, 1)[0].split(',')
  const columnMappings: TColumnMappings = {
    headers: headers,
    rowValues: {},
    rowIndexByFieldValue: {},
  }
  headers.forEach((header: string) => {
    columnMappings.rowIndexByFieldValue[header] = {}
  })
  rows.slice(1).forEach((row: string, rowIndex: number) => {
    columnMappings.rowValues[rowIndex] = row.split(',')
    columnMappings.rowValues[rowIndex].forEach(
      (fieldValue: TFieldValue, columnIndex: number) => {
        columnMappings.rowIndexByFieldValue[headers[columnIndex]][fieldValue] =
          rowIndex
      },
    )
  })

  return columnMappings
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
