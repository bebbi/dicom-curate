import * as dcmjs from 'dcmjs'
import * as mapdefaults from './mapdefaults'
import mapMetaheader from './mapMetaheader'
import createNestedDirectories from './createNestedDirectories'

import { set as _set, unset as _unset, cloneDeep as _cloneDeep } from 'lodash'
import collectMappings from './collectMappings.js'
// import mapHeaders from './mapHeaders'

self.addEventListener('message', (event) => {
  switch (event.data.request) {
    case 'apply':
      try {
        applyMappings(event.data.fileInfo, event.data.mappingOptions).then(
          (mapResults) => {
            self.postMessage({
              response: 'finished',
              mapResults: mapResults,
            })
          },
        )
      } catch (error) {
        self.postMessage({ response: 'error', error })
        throw new Error('ERROR')
      }
      break
    default:
      console.error(`Unknown request ${event.data.request}`)
  }
})

async function applyMappings(fileInfo, mappingOptions) {
  //
  // First, read the dicom instance data from the file handle
  //
  const file = await fileInfo.fileHandle.getFile()
  const fileArrayBuffer = await file.arrayBuffer()
  // TODO: capture validation data in object and save as part of results object
  dcmjs.log.setLevel(dcmjs.log.levels.ERROR)
  dcmjs.log.getLogger('validation.dcmjs').setLevel(dcmjs.log.levels.SILENT)
  let dicomData
  try {
    dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer)
  } catch (error) {
    const mapResults = {
      anomalies: [`Could not parse ${fileInfo.name} as dicom data`],
    }
    return mapResults
  }

  //
  // then collect the mappings and apply them to the data
  //
  const [naturalData, mapResults] = collectMappings(
    fileInfo,
    dicomData,
    mappingOptions,
  )
  for (let tagPath in mapResults.mappings) {
    const [_, operation, mappedValue] = mapResults.mappings[tagPath]
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
  dicomData.meta = mapMetaheader(mapdefaults, dicomData.meta)

  // Finally, write the results
  const dirPath = mapResults.filePath.split('/').slice(0, -1).join('/')
  const fileName = mapResults.filePath.split('/').slice(-1)
  dicomData.dict =
    dcmjs.data.DicomMetaDictionary.denaturalizeDataset(naturalData)
  // note that dcmjs creates a 128 preamble of all zeros, so any PHI in previous preamble is gone
  const modifiedArrayBuffer = dicomData.write()
  const subDirectoryHandle = await createNestedDirectories(
    mappingOptions.outputDirectory,
    dirPath,
  )
  if (subDirectoryHandle == false) {
    console.error(`Cannot create directory for ${dirPath}`)
  } else {
    const fileHandle = await subDirectoryHandle.getFileHandle(fileName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(modifiedArrayBuffer)
    await writable.close()
  }

  const clonedMapResults = _cloneDeep(mapResults)
  return clonedMapResults
}
