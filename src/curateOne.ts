import * as dcmjs from 'dcmjs'
import createNestedDirectories from './createNestedDirectories'
import curateDict from './curateDict'
import type {
  TFileInfo,
  THashMethod,
  THTTPOptions,
  TMappingOptions,
  TMapResults,
} from './types'
import { hash } from './hash'

export type TCurateOneArgs = {
  fileInfo: TFileInfo
  fileIndex?: number
  outputTarget: {
    http?: THTTPOptions
    directory?: FileSystemDirectoryHandle | string
  }
  mappingOptions: TMappingOptions
  // hash algorithm to use when previousSourceFileInfo is provided. Defaults to 'crc64'.
  // Supported values: 'crc64' (NVMe-style / js-crc 64-bit), 'crc32', or 'sha256'.
  hashMethod?: THashMethod
  // If provided, curateOne() will skip processing the file if the passed values
  // match the current properties of the input file.
  previousSourceFileInfo?: {
    size?: number
    mtime?: string
    preMappedHash?: string
  }
  // The caller may not know the name of the mapped file in advance
  // so this callback can be used to provide previous mapped file info by mapped name
  // once it is known.
  // If this callback is provided and it returns a postMappedHash that matches
  // what curateOne generated, then the output file is not written again.
  previousMappedFileInfo?: (mappedFileName: string) =>
    | {
        postMappedHash?: string
      }
    | undefined
}

export async function curateOne({
  fileInfo,
  fileIndex = 0,
  outputTarget,
  mappingOptions,
  hashMethod,
  previousSourceFileInfo,
  previousMappedFileInfo,
}: TCurateOneArgs): Promise<
  // anomalies is minimally present.
  Omit<Partial<TMapResults>, 'anomalies'> & {
    anomalies: TMapResults['anomalies']
  }
> {
  const startTime = performance.now()
  let mtime: string | undefined

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
  } else if (fileInfo.kind === 'http') {
    const headers: Record<string, string> = {}
    if (fileInfo.headers) {
      Object.assign(headers, fileInfo.headers)
    }
    const resp = await fetch(fileInfo.url, { headers })
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch ${fileInfo.url}: ${resp.status} ${resp.statusText}`,
      )
    }
    file = await resp.blob()

    const lastModifiedHeader = resp.headers.get('last-modified') || undefined
    if (lastModifiedHeader) {
      mtime = new Date(lastModifiedHeader).toISOString()
    }
  } else {
    file = await fileInfo.fileHandle.getFile()
  }

  // 2) extract mtime if available
  if (!mtime) {
    try {
      const maybeFile = file as File
      if (maybeFile && typeof (maybeFile as any).lastModified === 'number') {
        mtime = new Date((maybeFile as any).lastModified).toISOString()
      }
    } catch (e) {
      // ignore
    }
  }

  // 3) read bytes (needed for deep hash)
  const fileArrayBuffer = await file.arrayBuffer()

  let preMappedHash: string | undefined
  let postMappedHash: string | undefined
  const postMappedHashHeader = 'x-source-file-hash'

  // 4) decide if we can skip mapping based on previousSourceFileInfo
  let canSkip = false

  if (previousSourceFileInfo?.preMappedHash !== undefined) {
    try {
      // choose hashing algorithm: default to crc64 (nvme-style) for compatibility
      preMappedHash = await hash(fileArrayBuffer, hashMethod || 'crc64')
    } catch (e) {
      console.warn(`Failed to compute preMappedHash for ${fileInfo.name}`, e)
    }

    if (preMappedHash !== undefined) {
      canSkip = previousSourceFileInfo.preMappedHash === preMappedHash
    }
  }

  if (!canSkip) {
    // basic: only size+mtime
    if (
      previousSourceFileInfo?.size !== undefined &&
      previousSourceFileInfo?.mtime !== undefined
    ) {
      canSkip =
        previousSourceFileInfo.size === fileInfo.size &&
        previousSourceFileInfo.mtime === mtime
    }
  }

  const noMapResult = () => {
    const retval: TMapResults = {
      sourceInstanceUID: `unchanged_${fileInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      outputFilePath: `${fileInfo.path}/${fileInfo.name}`,
      mappings: {},
      anomalies: [],
      errors: [],
      quarantine: {},
      mappingRequired: false,
      fileInfo: {
        name: fileInfo.name,
        size: fileInfo.size,
        path: fileInfo.path,
        mtime: previousSourceFileInfo?.mtime,
        preMappedHash: preMappedHash,
      },
      // include curationTime even when skipped to measure hashing/check time
      curationTime: performance.now() - startTime,
    }
    return retval
  }

  if (canSkip && previousSourceFileInfo) {
    return noMapResult()
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
    console.warn(
      `[dicom-curate] Could not parse ${fileInfo.name} as DICOM data:`,
      error,
    )
    const mapResults = {
      anomalies: [`Could not parse ${fileInfo.name} as DICOM data`],
      errors: [
        `File ${fileInfo.name} is not a valid DICOM file or is corrupted`,
      ],
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
      curationTime: performance.now() - startTime,
    }

    return mapResults
  }

  // 6) perform mapping
  const { dicomData: mappedDicomData, mapResults: clonedMapResults } =
    curateDict(
      `${fileInfo.path}/${fileInfo.name}`,
      fileIndex,
      dicomData,
      mappingOptions,
    )

  // Indicate that mapping was required (we didn't hit the early-skip branch above)
  // Previously mappingRequired was only set to false when skipping; ensure it's
  // explicitly set to true when mapping was performed so consumers can rely on
  // the flag being present in both cases.
  clonedMapResults.mappingRequired = true

  // If we didn't compute preMappedHash yet, do it now
  if (!preMappedHash) {
    try {
      // choose hashing algorithm: default to crc64 (nvme-style) for compatibility
      preMappedHash = await hash(fileArrayBuffer, hashMethod || 'crc64')
    } catch (e) {
      console.warn(`Failed to compute preMappedHash for ${fileInfo.name}`, e)
    }
  }

  // 7) write output if requested
  if (!mappingOptions.skipWrite) {
    const dirPath = clonedMapResults.outputFilePath
      .split('/')
      .slice(0, -1)
      .join('/')
    const fileName = clonedMapResults.outputFilePath.split('/').slice(-1)[0]

    const modifiedArrayBuffer = mappedDicomData.write({
      allowInvalidVRLength: true,
    })

    // Always calculate post-mapped hash even if deep compare is not requested
    postMappedHash = await hash(modifiedArrayBuffer, hashMethod || 'crc64')

    const previousPostMappedHash = previousMappedFileInfo
      ? previousMappedFileInfo(clonedMapResults.outputFilePath)?.postMappedHash
      : undefined

    if (
      previousPostMappedHash !== undefined &&
      previousPostMappedHash === postMappedHash
    ) {
      return noMapResult()
    }

    // Check if outputTarget.directory is a FileSystemDirectoryHandle (browser) or string (Node.js)
    if (
      typeof outputTarget?.directory === 'object' &&
      'getFileHandle' in outputTarget.directory
    ) {
      const subDirectoryHandle = await createNestedDirectories(
        outputTarget.directory,
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
    } else if (typeof outputTarget?.directory === 'string') {
      // Node.js environment - use fs module to write file
      const fs = await import('fs').then((mod) => mod.promises)
      const path = await import('path')
      const fullDirPath = path.resolve(outputTarget?.directory, dirPath)

      try {
        await fs.mkdir(fullDirPath, { recursive: true })
      } catch (error) {
        console.error(`Cannot create directory for ${fullDirPath}:`, error)
        return clonedMapResults
      }

      const fullFilePath = path.join(fullDirPath, fileName)
      await fs.writeFile(fullFilePath, new DataView(modifiedArrayBuffer))
    } else {
      clonedMapResults.mappedBlob = new Blob([modifiedArrayBuffer], {
        type: 'application/octet-stream',
      })
    }

    // If no directory or even if directory present, expose mappedBlob for consumers
    clonedMapResults.mappedBlob = new Blob([modifiedArrayBuffer], {
      type: 'application/octet-stream',
    })

    // If upload URL (bucket) is provided, perform an HTTP PUT upload to the server
    if (outputTarget?.http) {
      try {
        // Encode each part of the path, but not the slashes
        const key = clonedMapResults.outputFilePath
          .split('/')
          .map(encodeURIComponent)
          .join('/')

        // Combine the full upload URL by appending the bucket URL + optional prefix + file name (key)
        const uploadUrl = `${outputTarget.http.url}/${key}`

        // Create headers per helper described by the user
        const headers: Record<string, string> = {
          'Content-Type':
            clonedMapResults.mappedBlob.type || 'application/octet-stream',
          'X-File-Name': fileName,
          'X-File-Type':
            clonedMapResults.mappedBlob.type || 'application/octet-stream',
          'X-File-Size': String(modifiedArrayBuffer.byteLength),
          'X-Source-File-Size': String(clonedMapResults.fileInfo?.size || ''),
          'X-Source-File-Modified-Time': mtime || '',
          'X-Source-File-Hash': preMappedHash || '',
        }

        if (outputTarget.http.headers) {
          Object.assign(headers, outputTarget.http.headers)
        }

        if (postMappedHashHeader && postMappedHash)
          headers[postMappedHashHeader] = postMappedHash

        const resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers,
          body: clonedMapResults.mappedBlob,
        })

        if (!resp.ok) {
          console.error(
            `Upload failed for ${uploadUrl}: ${resp.status} ${resp.statusText}`,
          )
          clonedMapResults.errors = clonedMapResults.errors || []
          clonedMapResults.errors.push(
            `Upload failed: ${resp.status} ${resp.statusText}`,
          )
        } else {
          // attach upload info if available
          clonedMapResults.outputUpload = clonedMapResults.outputUpload || {
            url: uploadUrl,
            status: resp.status,
          }
        }
      } catch (e) {
        console.error('Upload error', e)
        clonedMapResults.errors = clonedMapResults.errors || []
        clonedMapResults.errors.push(
          `Upload error: ${e instanceof Error ? e.message : String(e)}`,
        )
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

  clonedMapResults.curationTime = performance.now() - startTime

  return clonedMapResults
}
