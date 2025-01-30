import * as dcmjs from 'dcmjs'
import { getCsvMapping } from './csvMapping'
import type { TMappingOptions, TFileInfo } from './types'
import type { TNaturalData } from 'dcmjs'

type TParserOptions = Pick<TMappingOptions, 'folderMappings' | 'fieldMappings'>

export default function getParser(
  { folderMappings, fieldMappings }: TParserOptions,
  fileInfo: TFileInfo,
  naturalData: TNaturalData,
) {
  return {
    getFilePathComp: (component: string) => {
      const pathComponents = folderMappings.split('/')
      const componentIndex = pathComponents.indexOf(component)
      const filePathComponents = fileInfo.path.split('/')
      return filePathComponents[componentIndex]
    },
    getMapping: getCsvMapping.bind(null, fieldMappings),
    getDicom(tagName: string) {
      if (tagName in dcmjs.data.DicomMetaDictionary.dictionary) {
        // if in hex like "(0008,0100)", convert to text key
        tagName = dcmjs.data.DicomMetaDictionary.dictionary[tagName].name
      }
      return naturalData[tagName]
    },
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
