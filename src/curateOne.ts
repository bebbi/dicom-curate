import * as dcmjs from 'dcmjs'
import createNestedDirectories from './createNestedDirectories'
import curateDict from './curateDict'
import type { TFileInfo, TMappingOptions, TMapResults } from './types'

export type TCurateOneArgs = {
  fileInfo: TFileInfo
  fileIndex?: number
  outputDirectory: FileSystemDirectoryHandle | string | undefined
  mappingOptions: TMappingOptions
  previousFileInfo?: { size?: number; mtime?: string; preMappedHash?: string }
}

export async function curateOne({
  fileInfo,
  fileIndex = 0,
  outputDirectory,
  mappingOptions,
  previousFileInfo,
}: TCurateOneArgs): Promise<
  // anomalies is minimally present.
  Omit<Partial<TMapResults>, 'anomalies'> & {
    anomalies: TMapResults['anomalies']
  }
> {
  // 1) Read the file (from handle or blob)
  let file
  if (fileInfo.kind === 'blob') {
    file = fileInfo.blob
  } else if (fileInfo.kind === 'path') {
    // Node.js environment - use fs module to read file
    const fs = await import('fs').then((mod) => mod.promises)
    const fileBuffer = await fs.readFile(fileInfo.fullPath)

    // Casting trick is here to overcome type mismatches between the web declaration of Blob
    // and that of Node.js
    file = new Blob([fileBuffer as unknown as ArrayBuffer], {
      type: 'application/octet-stream',
    })
  } else {
    file = await fileInfo.fileHandle.getFile()
  }

  // 2) extract mtime if available
  let mtime: string | undefined
  try {
    const maybeFile = file as File
    if (maybeFile && typeof (maybeFile as any).lastModified === 'number') {
      mtime = new Date((maybeFile as any).lastModified).toISOString()
    }
  } catch (e) {
    // ignore
  }

  // 3) read bytes (needed for deep hash)
  const fileArrayBuffer = await file.arrayBuffer()

  // helper: compute sha256 hex
  async function sha256Hex(buffer: ArrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  let preMappedHash: string | undefined
  let postMappedHash: string | undefined

  // 4) decide if we can skip mapping based on compareMode and pre-compute hash if needed
  const compareMode = mappingOptions.compareMode || 'deep'
  let canSkip = false

  if (compareMode === 'deep') {
    try {
      preMappedHash = await sha256Hex(fileArrayBuffer)
    } catch (e) {
      console.warn(`Failed to compute preMappedHash for ${fileInfo.name}`, e)
      preMappedHash = undefined
    }

    canSkip =
      !!previousFileInfo &&
      previousFileInfo.size === fileInfo.size &&
      previousFileInfo.mtime === mtime &&
      !!preMappedHash &&
      previousFileInfo.preMappedHash === preMappedHash
  } else {
    // basic: only size+mtime
    canSkip = !!previousFileInfo && previousFileInfo.size === fileInfo.size && previousFileInfo.mtime === mtime
  }

  if (canSkip && previousFileInfo) {
    const noMapResult: Omit<Partial<TMapResults>, 'anomalies'> & {
      anomalies: TMapResults['anomalies']
    } = {
      sourceInstanceUID: `unchanged_${fileInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      outputFilePath: `${fileInfo.path}/${fileInfo.name}`,
      mappings: {},
      anomalies: [],
      errors: [],
      quarantine: {},
      noMappingRequired: true,
      fileInfo: {
        name: fileInfo.name,
        size: fileInfo.size,
        path: fileInfo.path,
        mtime: previousFileInfo.mtime,
        preMappedHash: preMappedHash,
        postMappedHash: preMappedHash, // If pre-hash matches, post-hash will too
      },
    }
    return noMapResult
  }

  // 5) parse DICOM
  dcmjs.log.setLevel(dcmjs.log.levels.ERROR)
  dcmjs.log.getLogger('validation.dcmjs').setLevel(dcmjs.log.levels.SILENT)
  let dicomData
  try {
    dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer, {
      ignoreErrors: true,
    })
  } catch (error) {
    console.warn(`[dicom-curate] Could not parse ${fileInfo.name} as DICOM data:`, error)
    const mapResults = {
      anomalies: [`Could not parse ${fileInfo.name} as DICOM data`],
      errors: [`File ${fileInfo.name} is not a valid DICOM file or is corrupted`],
      sourceInstanceUID: `invalid_${fileInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      outputFilePath: `${fileInfo.path}/${fileInfo.name}`,
      fileInfo: {
        name: fileInfo.name,
        size: fileInfo.size,
        path: fileInfo.path,
        mtime,
        preMappedHash,
        parseError: error instanceof Error ? error.message : String(error),
      },
    }

    return mapResults
  }

  // 6) perform mapping
  const { dicomData: mappedDicomData, mapResults: clonedMapResults } =
    curateDict(`${fileInfo.path}/${fileInfo.name}`, fileIndex, dicomData, mappingOptions)

  // 7) write output if requested
  if (!mappingOptions.skipWrite) {
    const dirPath = clonedMapResults.outputFilePath.split('/').slice(0, -1).join('/')
    const fileName = clonedMapResults.outputFilePath.split('/').slice(-1)[0]

    const modifiedArrayBuffer = mappedDicomData.write({ allowInvalidVRLength: true })

    // Check if outputDirectory is a FileSystemDirectoryHandle (browser) or string (Node.js)
    if (
      typeof outputDirectory === 'object' &&
      'getFileHandle' in outputDirectory
    ) {
      const subDirectoryHandle = await createNestedDirectories(
        outputDirectory,
        dirPath,
      )
      if (subDirectoryHandle === false) {
        console.error(`Cannot create directory for ${dirPath}`)
      } else {
        const fileHandle = await subDirectoryHandle.getFileHandle(fileName, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(modifiedArrayBuffer)
        await writable.close()
      }
    } else if (typeof outputDirectory === 'string') {
      // Node.js environment - use fs module to write file
      const fs = await import('fs').then((mod) => mod.promises)
      const path = await import('path')
      const fullDirPath = path.resolve(outputDirectory, dirPath)

      try {
        await fs.mkdir(fullDirPath, { recursive: true })
      } catch (error) {
        console.error(`Cannot create directory for ${fullDirPath}:`, error)
        return clonedMapResults
      }

      const fullFilePath = path.join(fullDirPath, fileName)
      await fs.writeFile(fullFilePath, new DataView(modifiedArrayBuffer))
    } else {
      clonedMapResults.mappedBlob = new Blob([modifiedArrayBuffer], { type: 'application/octet-stream' })
    }

    if (compareMode === 'deep') {
      try {
        postMappedHash = await sha256Hex(modifiedArrayBuffer)
      } catch (e) {
        console.warn('Failed to compute postMappedHash', e)
        postMappedHash = undefined
      }
    }
  }

  // 8) attach fileInfo and return
  clonedMapResults.fileInfo = {
    name: fileInfo.name,
    size: fileInfo.size,
    path: fileInfo.path,
    mtime,
    preMappedHash,
    postMappedHash,
  }

  return clonedMapResults
}
