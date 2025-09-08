import * as dcmjs from 'dcmjs'
import createNestedDirectories from './createNestedDirectories'
import curateDict from './curateDict'
import type { TFileInfo, TMappingOptions, TMapResults } from './types'

export type TCurateOneArgs = {
  fileInfo: TFileInfo
  fileIndex?: number
  outputDirectory: FileSystemDirectoryHandle | undefined
  mappingOptions: TMappingOptions
}

export async function curateOne({
  fileInfo,
  fileIndex = 0,
  outputDirectory,
  mappingOptions,
}: TCurateOneArgs): Promise<
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
    // Allow processing DICOM files with DICOM violations (e.g., CS values > 16 chars)
    dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer, {
      ignoreErrors: true,
    })
  } catch (error) {
    console.warn(
      `[dicom-curate] Could not parse ${fileInfo.name} as DICOM data:`,
      error,
    )

    // Create a more informative error result
    const mapResults = {
      anomalies: [`Could not parse ${fileInfo.name} as DICOM data`],
      errors: [
        `File ${fileInfo.name} is not a valid DICOM file or is corrupted`,
      ],
      sourceInstanceUID: `invalid_${fileInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      outputFilePath: `${fileInfo.path}/${fileInfo.name}`,
      // Add metadata about the failed file
      fileInfo: {
        name: fileInfo.name,
        size: fileInfo.size,
        path: fileInfo.path,
        parseError: error instanceof Error ? error.message : String(error),
      },
    }

    return mapResults
  }

  const { dicomData: mappedDicomData, mapResults: clonedMapResults } =
    curateDict(
      `${fileInfo.path}/${fileInfo.name}`,
      fileIndex,
      dicomData,
      mappingOptions,
    )

  if (!mappingOptions.skipWrite) {
    // Finally, write the results
    const dirPath = clonedMapResults.outputFilePath
      .split('/')
      .slice(0, -1)
      .join('/')
    const fileName = clonedMapResults.outputFilePath.split('/').slice(-1)[0]

    // note that dcmjs creates a 128 preamble of all zeros, so any PHI in previous preamble is gone
    // Allow writing DICOM files with VR length violations
    const modifiedArrayBuffer = mappedDicomData.write({
      allowInvalidVRLength: true,
    })

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
