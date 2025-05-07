import * as dcmjs from 'dcmjs'
import { getCsvMapping, TColumnMappings } from './csvMapping'
import { UniqueNumbers } from './UniqueNumbers'
import type { TNaturalData } from 'dcmjs'
import type { TParser, TCurationSpecification } from './types'
import { add } from 'lodash'

export const FILEBASENAME: symbol = Symbol('fileBasename')
export const FILENAME: symbol = Symbol('filename')

const { getUniqueNumberInGroup, clearUniqueNumberCache } = UniqueNumbers(6)

const { isUniqueInGroup, clearUniqueInGroupCache } = (function () {
  let cache = new Set()
  let lastGroupId: string = ''
  return {
    isUniqueInGroup(value: string | number, groupId: string) {
      if (groupId !== lastGroupId) {
        cache = new Set()
        lastGroupId = groupId
      }

      if (cache.has(value)) {
        return false
      }

      cache.add(value)
      return true
    },
    clearUniqueInGroupCache() {
      cache = new Set()
    },
  }
})()

export { clearUniqueNumberCache, clearUniqueInGroupCache }

export default function getParser(
  inputPathPattern: string,
  inputFilePath: string,
  naturalData: TNaturalData,
  columnMappings?: TColumnMappings,
  additionalData?: TCurationSpecification['additionalData'],
): TParser {
  function getDicom(attrName: string) {
    if (attrName in dcmjs.data.DicomMetaDictionary.dictionary) {
      // if in hex like "(0008,0100)", convert to text key
      attrName = dcmjs.data.DicomMetaDictionary.dictionary[attrName].name
    }
    return naturalData[attrName]
  }

  function getFilePathComp(
    component: string | number | typeof FILENAME | typeof FILEBASENAME,
  ) {
    const patternParts = inputPathPattern.split('/')
    const fileParts = inputFilePath.split('/')

    let idx
    if (typeof component === 'number') {
      // numeric indexing (supports negatives)
      idx =
        component < 0
          ? fileParts.length + component // -1 → last, -2 → second-to-last, etc.
          : component
    } else if (typeof component === 'symbol') {
      // force last‐segment lookup on FILENAME or FILEBASENAME
      idx = fileParts.length - 1
    } else {
      // string lookup against pattern
      idx = patternParts.indexOf(component)
    }

    // return the segment if in range, else empty string
    const segment = fileParts[idx] ?? ''

    // Return last component without a suffix
    if (component === FILEBASENAME) {
      return segment.replace(/\.[^/.]+$/, '')
    }

    return segment
  }

  function getFrom(source: string, identifier: string) {
    return source === 'dicom'
      ? getDicom(identifier)
      : getFilePathComp(identifier)
  }

  const getMapping =
    !additionalData || !columnMappings
      ? undefined
      // key: one of the keys defined in the `mapping` object
      : function getMapping(key: string) {
          const { mapping } = additionalData
          const { value: valueFn } = mapping[key]
          const value = valueFn({ getDicom, getFilePathComp, getFrom })

          return getCsvMapping(columnMappings, mapping, 'blindedId', value)
        }

  function missingDicom(attrName: string) {
    const value = getDicom(attrName)
    return typeof value === 'undefined' || value === ''
  }

  return {
    // This function enables errors like:
    // [
    //   'Duplicate Instance Number(s)',
    //   !parser.isUniqueInGroup(instanceNumber, seriesUid),
    // ],
    isUniqueInGroup,
    getUniqueNumberInGroup,
    getFrom,
    getFilePathComp,
    getMapping,
    getDicom,
    missingDicom,
    // TODO: Phase this out in favor of ISO8601 duration handling.
    // Example of this logic:
    // ContentDate:
    //   parser.addDays(parser.getDicom('StudyDate'), parser.getMapping(
    //     parser.getDicom('PatientID'), 'CURR_ID', 'DATE_OFFSET')),
    addDays: (dicomDateString: string, offsetDays: number) => {
      const year = Number(dicomDateString.slice(0, 4))
      const monthIndex = Number(dicomDateString.slice(4, 6)) - 1
      const day = Number(dicomDateString.slice(6, 8))
      const date = new Date(year, monthIndex, day)
      let time = date.getTime()
      const millisecondsPerDay = 1000 * 60 * 60 * 24
      time += offsetDays * millisecondsPerDay
      date.setTime(time)
      const yearString = date.getFullYear()
      const monthString = (date.getMonth() + 1).toString().padStart(2, '0')
      const dayString = date.getDate().toString().padStart(2, '0')
      return yearString + monthString + dayString
    },
    FILENAME,
    FILEBASENAME,
  }
}
