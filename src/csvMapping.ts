type TFieldValue = number | string

export type TCsvMappings = {
  headers: string[]
  rowValues: { [rowIdx: number]: TFieldValue[] }
  rowIndexByFieldValue: {
    [header: string]: {
      [fieldValue: TFieldValue]: number
    }
  }
}

export async function extractCsvMappings(csvFile: File) {
  const csvText = await csvFile.text()
  const rows = csvText.trim().split('\n')
  const headers = rows.slice(0, 1)[0].split(',')
  const fieldMappings: TCsvMappings = {
    headers: headers,
    rowValues: {},
    rowIndexByFieldValue: {},
  }
  headers.forEach((header: string) => {
    fieldMappings.rowIndexByFieldValue[header] = {}
  })
  rows.slice(1).forEach((row: string, rowIndex: number) => {
    fieldMappings.rowValues[rowIndex] = row.split(',')
    fieldMappings.rowValues[rowIndex].forEach(
      (fieldValue: TFieldValue, columnIndex: number) => {
        fieldMappings.rowIndexByFieldValue[headers[columnIndex]][fieldValue] =
          rowIndex
      },
    )
  })

  return fieldMappings
}

export function getCsvMapping(
  fieldMappings: TCsvMappings,
  value: TFieldValue,
  fromColumn: string,
  toColumn: string,
) {
  const rowIndex = fieldMappings.rowIndexByFieldValue[fromColumn][value]
  const columnIndex = fieldMappings.headers.indexOf(toColumn)
  return fieldMappings.rowValues[rowIndex][columnIndex]
}
