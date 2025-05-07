import {
  extractCsvMappings,
  getCsvMapping,
  Row,
  TMappedValues,
} from './csvMapping'

const csvText = 'old,new,ignore\noldV1,newV1,ignoreV1\noldV2,newV2,ignoreV2\n'

const mapping: TMappedValues = {
  oldToNew: {
    value: () => 'unused',
    lookup: (row: Row) => row['old'],
    replace: (row: Row) => row['new'],
  },
  newToOld: {
    value: () => 'unused',
    lookup: (row: Row) => row['new'],
    replace: (row: Row) => row['old'],
  },
}

describe('extractCsvMappings', () => {
  it('extracts column mappings from CSV text', () => {
    expect(extractCsvMappings(csvText, mapping)).toEqual({
      rows: [
        { old: 'oldV1', new: 'newV1', ignore: 'ignoreV1' },
        { old: 'oldV2', new: 'newV2', ignore: 'ignoreV2' },
      ],
      rowIndexByFieldValue: {
        oldToNew: { oldV1: 0, oldV2: 1 },
        newToOld: { newV1: 0, newV2: 1 },
      },
    })
  })

  it('gets the correct mapping for a given value', () => {
    const columnMappings = extractCsvMappings(csvText, mapping)

    expect(getCsvMapping(columnMappings, mapping, 'oldToNew', 'oldV1')).toEqual(
      'newV1',
    )

    expect(getCsvMapping(columnMappings, mapping, 'oldToNew', 'oldV2')).toEqual(
      'newV2',
    )

    expect(getCsvMapping(columnMappings, mapping, 'newToOld', 'newV1')).toEqual(
      'oldV1',
    )
  })
})
