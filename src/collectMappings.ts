import * as dcmjs from 'dcmjs'
import deidentifyPS315E, { defaultPs315Options } from './deidentifyPS315E'
import getParser from './getParser'
import { specVersion } from './config/specVersion'
import { get as _get } from 'lodash'

import type {
  TMappingOptions,
  TMapResults,
  TCurationSpecification,
} from './types'
import type { TDicomData, TNaturalData } from 'dcmjs'

export default function collectMappings(
  inputFilePath: string,
  inputFileIndex: number,
  dicomData: TDicomData,
  mappingOptions: TMappingOptions,
): [TNaturalData, TMapResults] {
  const mapResults: TMapResults = {
    // original UID for this dicomData
    sourceInstanceUID: '',
    // assembled string of path components
    outputFilePath: '',
    mappings: {},
    // a list of text strings describing any unexpected contents of the data
    anomalies: [],
    errors: [],
    quarantine: {},
  }

  // Make make the naturalized data so parser code operates on with tags not hex
  const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
    dicomData.dict,
  )
  mapResults.sourceInstanceUID = naturalData.SOPInstanceUID

  let finalSpec: Omit<TCurationSpecification, 'hostProps' | 'version'> = {
    dicomPS315EOptions: defaultPs315Options,
    inputPathPattern: '',
    modifyDicomHeader: () => ({}),
    outputFilePathComponents: (parser) => [
      parser.protectUid(parser.getDicom('SeriesInstanceUID')),
      parser.getFilePathComp(parser.FILENAME),
    ],
    errors: () => [],
  }

  const { modifyDicomHeader, errors, ...restSpec } =
    mappingOptions.curationSpec()

  if (restSpec.version !== specVersion) {
    throw new Error(
      `Only version ${specVersion} supported in curationSpecification`,
    )
  }

  // curationSpecification was populated by eval, load it into mappingSpec
  Object.assign(finalSpec, restSpec)

  if (!mappingOptions.skipModifications) {
    finalSpec.modifyDicomHeader = modifyDicomHeader
  }

  if (!mappingOptions.skipValidation) {
    finalSpec.errors = errors
  }

  // protect filename if we de-identify
  const finalFilePath =
    finalSpec.dicomPS315EOptions === 'Off'
      ? inputFilePath
      : inputFilePath.slice(0, inputFilePath.lastIndexOf('/') + 1) +
        `${String(inputFileIndex + 1).padStart(5, '0')}.dcm`

  // create a parser object to be used in the eval'ed mappingFunctions
  const parser = getParser(
    finalSpec.inputPathPattern,
    finalFilePath,
    naturalData,
    finalSpec.dicomPS315EOptions,
    mappingOptions.columnMappings,
    finalSpec.additionalData,
  )

  // List all validation errors
  mapResults.errors = finalSpec
    .errors(parser)
    .filter(([, failure]) => failure)
    .map(([message]) => message)

  // Return listing for the "two-pass add mapping" scenario
  if (finalSpec.additionalData?.type === 'listing') {
    const { lookups, info, collect } = finalSpec.additionalData.collect(parser)
    const collectByValue = collect.map((item) => {
      const [, , lookupField] = item
      const lookupValue = lookups[lookupField]
      return [...item, lookupValue] as [...typeof item, typeof lookupValue]
    })

    // FIXME: Bug in dcmjs
    const cleanedInfo = info.map((item) => {
      if (
        Array.isArray(item[1]) &&
        item[1].length === 1 &&
        typeof item[1][0] === 'object' &&
        'Alphabetic' in item[1][0] &&
        /^\d+$/.test(item[1][0].Alphabetic)
      ) {
        return [item[0], item[1][0].Alphabetic] as typeof item
      } else {
        return item
      }
    })

    mapResults.listing = { info: cleanedInfo, collectByValue }
  }

  if (!mappingOptions.skipModifications) {
    mapResults.outputFilePath = finalSpec
      .outputFilePathComponents(parser)
      .join('/')
  }

  if (finalSpec.dicomPS315EOptions !== 'Off') {
    deidentifyPS315E({
      naturalData,
      dicomPS315EOptions: finalSpec.dicomPS315EOptions,
      dateOffset: mappingOptions.dateOffset,
      mapResults,
      originalDicomDict: dicomData.dict,
    })
  }

  // Moving this after collectMappingsInData as this should take precedence.
  // collect the tag mappings before assigning them into dicomData
  // - Note the mappingFunctions return a dictionary called 'dicomModifications' of functions to call
  //   for each tag they want to map
  const dicomMap = finalSpec.modifyDicomHeader(parser)
  for (let attrPath in dicomMap) {
    // This overrides any default action if attrPath is the same
    mapResults.mappings[attrPath] = [
      _get(naturalData, attrPath),
      'replace',
      'mappingFunction',
      dicomMap[attrPath],
    ]
  }

  return [naturalData, mapResults]
}
