import * as dcmjs from 'dcmjs'
import { getCsvMapping, TColumnMappings } from './csvMapping'
import type { TNaturalData } from 'dcmjs'

const isUniqueInGroup = (function () {
  let cache = new Set()
  let lastGroupId: string = ''
  return function (value: string | number, groupId: string) {
    if (groupId !== lastGroupId) {
      cache = new Set()
      lastGroupId = groupId
    }

    if (cache.has(value)) {
      return false
    }

    cache.add(value)
    return true
  }
})()

export default function getParser(
  inputPathPattern: string,
  inputFilePath: string,
  naturalData: TNaturalData,
  columnMappings?: TColumnMappings,
) {
  function getDicom(attrName: string) {
    if (attrName in dcmjs.data.DicomMetaDictionary.dictionary) {
      // if in hex like "(0008,0100)", convert to text key
      attrName = dcmjs.data.DicomMetaDictionary.dictionary[attrName].name
    }
    return naturalData[attrName]
  }

  function getFilePathComp(component: string) {
    const pathComponents = inputPathPattern.split('/')
    const componentIndex = pathComponents.indexOf(component)
    const filePathComponents = inputFilePath.split('/')
    return filePathComponents[componentIndex]
  }

  function missingDicom(attrName: string) {
    const value = getDicom(attrName)
    return typeof value === 'undefined' || value === ''
  }

  return {
    isUniqueInGroup,
    getFrom(source: string, identifier: string) {
      return source === 'dicom'
        ? getDicom(identifier)
        : getFilePathComp(identifier)
    },
    getFilePathComp,
    getMapping: columnMappings
      ? getCsvMapping.bind(null, columnMappings)
      : undefined,
    getDicom,
    missingDicom,
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
  }
}
