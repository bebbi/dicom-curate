import * as dcmjs from 'dcmjs'
import collectMappings from './collectMappings'
import mapMetaheader from './mapMetaheader'
import type { TDicomData } from 'dcmjs'
import type { TMappingOptions } from './types'

import { set as _set, unset as _unset, cloneDeep as _cloneDeep } from 'lodash'

export default function dcmOrganize(
  inputFilePath: string,
  dicomData: TDicomData,
  mappingOptions: TMappingOptions,
) {
  //
  // Collect the mappings and apply them to the data
  //
  const [naturalData, mapResults] = collectMappings(
    inputFilePath,
    dicomData,
    mappingOptions,
  )
  for (let tagPath in mapResults.mappings) {
    const [, operation, , mappedValue] = mapResults.mappings[tagPath]
    switch (operation) {
      case 'delete':
        _unset(naturalData, tagPath)
        break
      case 'replace':
        _set(naturalData, tagPath, mappedValue)
        break
      default:
        console.error(`Bad operation ${operation} in mappings`)
    }
  }

  // apply a hard-coded mapping to the metaheader data since
  // it is of a highly constrained format
  const mappedDicomData = new dcmjs.data.DicomDict(
    // Depending on PS315E UID option, mapped uid or not.
    mapMetaheader(dicomData.meta, naturalData.SOPInstanceUID),
  )
  mappedDicomData.dict =
    dcmjs.data.DicomMetaDictionary.denaturalizeDataset(naturalData)

  return { dicomData: mappedDicomData, mapResults: _cloneDeep(mapResults) }
}
