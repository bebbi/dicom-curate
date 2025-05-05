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

  let curationSpecification: () => Partial<TCurationSpecification> = () => ({})
  let finalSpec: Omit<
    TCurationSpecification,
    'identifiers' | 'mappingCsvHeaders' | 'version'
  > = {
    dicomPS315EOptions: defaultPs315Options,
    inputPathPattern: '',
    modifications: () => ({
      dicomHeader: {},
      outputFilePathComponents: [
        parser.getDicom('SeriesInstanceUID'),
        parser.getFilePathComp(parser.FILENAME),
      ],
    }),
    validation: () => ({ errors: [] }),
  }

  // TODO: try/except with useful error hinting at curationSpec
  eval(mappingOptions.curationSpec)

  const spec = curationSpecification()

  if (spec.version !== specVersion) {
    throw new Error(
      `Only version ${specVersion} supported in curationSpecification`,
    )
  }

  // curationSpecification was populated by eval, load it into mappingSpec
  Object.assign(finalSpec, spec)

  // create a parser object to be used in the eval'ed mappingFunctions
  const parser = getParser(
    finalSpec.inputPathPattern,
    inputFilePath,
    naturalData,
    mappingOptions.columnMappings,
  )

  let modificationMap = finalSpec.modifications(parser)

  mapResults.errors = finalSpec
    .validation(parser)
    .errors.filter(([, failure]) => failure)
    .map(([message]) => message)

  mapResults.outputFilePath = modificationMap.outputFilePathComponents.join('/')

  if (finalSpec.dicomPS315EOptions !== 'Off') {
    deidentifyPS315E({
      naturalData,
      columnMappings: mappingOptions.columnMappings,
      dicomPS315EOptions: finalSpec.dicomPS315EOptions,
      parser,
      mapResults,
    })
  }

  // Moving this after collectMappingsInData as this should take precedence.
  // collect the tag mappings before assigning them into dicomData
  // - Note the mappingFunctions return a dictionary called 'dicomModifications' of functions to call
  //   for each tag they want to map
  const dicomMap = modificationMap.dicomHeader
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
