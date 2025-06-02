import * as dcmjs from 'dcmjs'
import createNestedDirectories from './createNestedDirectories'
import curateDict from './curateDict'
import type { TFileInfo, TMappingOptions, TMapResults } from './types'

export async function curateFile(
  fileInfo: TFileInfo,
  outputDirectory: FileSystemDirectoryHandle | undefined,
  mappingOptions: TMappingOptions,
): Promise<
  // anomalies is minimally present.
  Omit<Partial<TMapResults>, 'anomalies'> & {
    anomalies: TMapResults['anomalies']
  }
> {
  //
  // First, read the dicom instance data from the file handle or blob
  //
  let file
  if (fileInfo.kind === 'blob') {
    file = fileInfo.blob
  } else {
    file = await fileInfo.fileHandle.getFile()
  }
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

  const { dicomData: mappedDicomData, mapResults: clonedMapResults } =
    curateDict(`${fileInfo.path}/${fileInfo.name}`, dicomData, mappingOptions)

  if (!mappingOptions.skipWrite) {
    // Finally, write the results
    const dirPath = clonedMapResults.outputFilePath
      .split('/')
      .slice(0, -1)
      .join('/')
    const fileName = clonedMapResults.outputFilePath.split('/').slice(-1)[0]

    // note that dcmjs creates a 128 preamble of all zeros, so any PHI in previous preamble is gone
    const modifiedArrayBuffer = mappedDicomData.write()

    if (outputDirectory) {
      const subDirectoryHandle = await createNestedDirectories(
        outputDirectory,
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
    } else {
      clonedMapResults.mappedBlob = new Blob([modifiedArrayBuffer], {
        type: 'application/octet-stream',
      })
    }
  }

  return clonedMapResults
}
