import * as dcmjs from 'dcmjs'
import { getCsvMapping, TCsvMappings } from './csvMapping'
import type { TNaturalData } from 'dcmjs'

export default function getParser(
  inputPathPattern: string,
  inputFilePath: string,
  naturalData: TNaturalData,
  fieldMappings: TCsvMappings,
) {
  function getDicom(tagName: string) {
    if (tagName in dcmjs.data.DicomMetaDictionary.dictionary) {
      // if in hex like "(0008,0100)", convert to text key
      tagName = dcmjs.data.DicomMetaDictionary.dictionary[tagName].name
    }
    return naturalData[tagName]
  }

  function getFilePathComp(component: string) {
    const pathComponents = inputPathPattern.split('/')
    const componentIndex = pathComponents.indexOf(component)
    const filePathComponents = inputFilePath.split('/')
    return filePathComponents[componentIndex]
  }

  return {
    getFrom(source: string, identifier: string) {
      return source === 'dicom'
        ? getDicom(identifier)
        : getFilePathComp(identifier)
    },
    getFilePathComp,
    getMapping: getCsvMapping.bind(null, fieldMappings),
    getDicom,
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
