import * as dcmjs from 'dcmjs'
import createNestedDirectories from './createNestedDirectories'
import dcmOrganize from './dcmOrganize'
import type { TFileInfo, TMappingOptions } from './types'

declare var self: Window & typeof globalThis

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

async function applyMappings(
  fileInfo: TFileInfo,
  mappingOptions: TMappingOptions,
) {
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

  const {
    dicomData: mappedDicomData,
    dirPath,
    fileName,
    mapResults: clonedMapResults,
  } = dcmOrganize(fileInfo, dicomData, mappingOptions)

  // note that dcmjs creates a 128 preamble of all zeros, so any PHI in previous preamble is gone
  const modifiedArrayBuffer = mappedDicomData.write()
  const subDirectoryHandle = await createNestedDirectories(
    mappingOptions.outputDirectory,
    dirPath,
  )
  if (subDirectoryHandle === false) {
    console.error(`Cannot create directory for ${dirPath}`)
  } else {
    const fileHandle = await subDirectoryHandle.getFileHandle(fileName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(modifiedArrayBuffer)
    await writable.close()
  }

  return clonedMapResults
}
