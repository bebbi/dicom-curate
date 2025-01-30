import * as dcmjs from 'dcmjs'
import uidToV5BasedUID from './uidToV5BasedUID'
import type { TMappingOptions, TMapResults } from './types'
import type { TDicomData, TNaturalData } from 'dcmjs'

import getParser from './getParser'
import * as mapdefaults from './mapdefaults'
import { get as _get } from 'lodash'

export default function collectMappings(
  inputFilePath: string,
  dicomData: TDicomData,
  mappingOptions: TMappingOptions,
): [TNaturalData, TMapResults] {
  // Returns [naturalData, mapResults]
  // sourceInstanceUID : original UID for this dicomData
  // filePath : assembled string of path components
  // mappings are object of the form:
  // key:
  //   "path" : string compatible with lodash get/set
  // value list elements:
  //   "originalValue" : value from the dicomData
  //   "mapOperation" : one of "replace", "delete"
  //   "mappedValue" : replacement for "replace" operation
  // "anomalies" : a list of text strings describing any unexpected contents of the data
  const mapResults: TMapResults = {
    sourceInstanceUID: '',
    filePath: '',
    mappings: {},
    anomalies: [],
  }

  //
  // collect private tags and mark them for delete
  // TODO: put this in recursive function to find nested private tags
  // TODO: add option for `allowlist` of private tags taken from 3.15E and TCIA table
  for (let hexTag in dicomData.dict) {
    if (Number(hexTag[3]) % 2 === 1) {
      mapResults.mappings['x' + hexTag] = [
        String(dicomData.dict[hexTag].Value),
        'delete',
        undefined,
      ]
    }
  }

  // Make make the naturalized data so parser code operates on with tags not hex
  const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
    dicomData.dict,
  )
  mapResults.sourceInstanceUID = naturalData.SOPInstanceUID

  // create a parser object to be used in the eval'ed mappingFunctions
  const parser = getParser(
    mappingOptions.inputPathPattern,
    inputFilePath,
    naturalData,
    mappingOptions.fieldMappings,
  )

  // run the mapping functions that set the following two variables
  let dicom: { [keyword: string]: () => string } = {}
  let filePath: string[] = []
  // TODO: try/except with useful error hinting at mappingFns
  eval(mappingOptions.mappingFunctions)
  mapResults.filePath = filePath.join('/')

  // collect the tag mappings before assigning them into dicomData
  // - Note the mappingFunctions return a dictionary called 'dicom' of functions to call
  //   for each tag they want to map
  for (let tagPath in dicom) {
    mapResults.mappings[tagPath] = [
      _get(naturalData, tagPath),
      'replace',
      dicom[tagPath](),
    ]
  }

  // Now collect the standard mappings with a
  // recursive function to handle sequences (naturalData is a top-level instance of data).
  // Calls modify mapResults in the outer function scope.
  const nameMap = dcmjs.data.DicomMetaDictionary.nameMap
  function collectMappingsInData(data: TNaturalData, path = '') {
    for (let tag in data) {
      if (/_.*/.test(tag)) {
        continue // ignore tags marked internal with leading underscore
      }
      const tagPath = path + tag
      if (tag in nameMap) {
        // means it's a known tag
        let vr = nameMap[tag].vr
        if (vr === 'SQ') {
          let subDataIndex = 0
          for (let subData of Object.values(data[tag]) as TNaturalData[]) {
            let subPath = `${path}${tag}[${subDataIndex}].`
            collectMappingsInData(subData, subPath)
            subDataIndex += 1
          }
        } else {
          if (vr === 'UI') {
            if (mapdefaults.instanceUIDs.indexOf(tag) !== -1) {
              // UIDs that need to be mapped
              const uid = data[tag]
              const mappedUID = uidToV5BasedUID(uid)
              mapResults.mappings[tagPath] = [uid, 'replace', mappedUID]
            }
          } else {
            // other tags are handled according to mapdefaults rules
            if (tag in mapdefaults.tagNamesToEmpty) {
              mapResults.mappings[tagPath] = [data[tag], 'delete', undefined]
            } else {
              if (!(tag in mapdefaults.tagNamesToAlwaysKeep)) {
                mapResults.anomalies.push(
                  `instance contains tag ${tag} that is not defined in mapdefaults.  Marking it for deletion.`,
                )
                mapResults.mappings[tagPath] = [data[tag], 'delete', undefined]
              }
            }
          }
        }
      } else {
        mapResults.anomalies.push(
          `instance contains tag ${tag} that is not in dictionary.  Marking it for deletion.`,
        )
        mapResults.mappings[tagPath] = [data[tag], 'delete', undefined]
      }
    }
  }
  collectMappingsInData(naturalData)

  return [naturalData, mapResults]
}
