import { extractCsvMappings, getCsvMapping } from './csvMapping'

const csvText = 'old,new,ignore\noldV1,newV1,ignoreV1\noldV2,newV2,ignoreV2\n'

describe('extractCsvMappings', () => {
  it('extracts column mappings from CSV text', () => {
    expect(extractCsvMappings(csvText)).toEqual({
      headers: ['old', 'new', 'ignore'],
      rowValues: [
        ['oldV1', 'newV1', 'ignoreV1'],
        ['oldV2', 'newV2', 'ignoreV2'],
      ],
      rowIndexByFieldValue: {
        old: { oldV1: 0, oldV2: 1 },
        new: { newV1: 0, newV2: 1 },
        ignore: { ignoreV1: 0, ignoreV2: 1 },
      },
    })
  })

  it('gets the correct mapping for a given value', () => {
    const columnMappings = extractCsvMappings(csvText)

    expect(getCsvMapping(columnMappings, 'oldV1', 'old', 'new')).toEqual(
      'newV1',
    )

    expect(getCsvMapping(columnMappings, 'oldV2', 'old', 'new')).toEqual(
      'newV2',
    )
  })
})
