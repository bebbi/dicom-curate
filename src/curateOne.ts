import * as dcmjs from 'dcmjs'
import { createModel } from 'js-crc'
import createNestedDirectories from './createNestedDirectories'
import curateDict from './curateDict'
import type { TFileInfo, TMappingOptions, TMapResults } from './types'

export type TCurateOneArgs = {
  fileInfo: TFileInfo
  fileIndex?: number
  outputTarget: { url?: string; directory?: FileSystemDirectoryHandle | string; token?: string }
  mappingOptions: TMappingOptions
  previousFileInfo?: { size?: number; mtime?: string; preMappedHash?: string; postMappedHash?: string }
}

export async function curateOne({
  fileInfo,
  fileIndex = 0,
  outputTarget,
  mappingOptions,
  previousFileInfo,
}: TCurateOneArgs): Promise<
  // anomalies is minimally present.
  Omit<Partial<TMapResults>, 'anomalies'> & {
    anomalies: TMapResults['anomalies']
  }
> {
  const startTime = performance.now()

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

  // helper: compute crc32 hex (use js-crc). Accepts ArrayBuffer and returns
  // lowercase, zero-padded 8-character hex string.
  // Accept ArrayBuffer, Uint8Array or Node Buffer and always compute the CRC32
  // over a copied Uint8Array to avoid accidental mutations affecting the
  // previously-computed preMappedHash (some consumers may reuse or mutate
  // buffers exposed by libraries).
  function crc32Hex(input: ArrayBuffer | Uint8Array | Buffer) {
    let bytes: Uint8Array
    // Normalize and copy to ensure immutability
    if (input instanceof Uint8Array) {
      bytes = new Uint8Array(input) // copy
    } else if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input.slice(0)) // copy
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input as any)) {
      // Node Buffer -> copy
      bytes = new Uint8Array(Buffer.from(input as any))
    } else {
      // Fallback: try to coerce
      bytes = new Uint8Array(input as any)
    }

    const raw = crc32fn(bytes as any)
    let num: number
    if (typeof raw === 'number') {
      num = raw >>> 0
    } else {
      num = parseInt(String(raw), 16) >>> 0
      if (!Number.isFinite(num)) num = 0
    }
    return num.toString(16).padStart(8, '0')
  }

  // crc32 function using js-crc
  const crc32fn = createModel({
    width: 32,
    poly: 0x04c11db7,
    init: 0xffffffff,
    refin: true,
    refout: true,
    xorout: 0xffffffff,
  })

  // helper: compute crc64 hex (use js-crc if available). Returns lowercase,
  // zero-padded 16-character hex string. Accepts ArrayBuffer/Uint8Array/Buffer.
  function crc64Hex(input: ArrayBuffer | Uint8Array | Buffer) {
    let bytes: Uint8Array
    if (input instanceof Uint8Array) {
      bytes = new Uint8Array(input)
    } else if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input.slice(0))
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input as any)) {
      bytes = new Uint8Array(Buffer.from(input as any))
    } else {
      bytes = new Uint8Array(input as any)
    }

    // NVME model params: width=64, poly=0xAD93D23594C93659, init=0xFFFFFFFFFFFFFFFF, refin=true, refout=true, xorout=0xFFFFFFFFFFFFFFFF
    const crc64nvme = createModel({
      width: 64,
      poly: [0xad93d235, 0x94c93659], // 0xAD93D23594C93659
      init: [0xffffffff, 0xffffffff],
      refin: true,
      refout: true,
      xorout: [0xffffffff, 0xffffffff],
    })

    // js-crc returns a hex string, which is what we want.
    return crc64nvme(bytes)
  }

  let preMappedHash: string | undefined
  let postMappedHash: string | undefined

  // 4) decide if we can skip mapping based on compareMode and pre-compute hash if needed
  const compareMode = mappingOptions.compareMode || 'always' // if not specified, do the upload
  let canSkip = false

  if (compareMode === 'always') {
    canSkip = false
  } else if (compareMode === 'bucketMetadata') {
    // TODO: implement bucket metadata comparison logic
    // For now, we will not skip, which means files will always be processed.
    canSkip = false
  } else if (compareMode === 'localDeep') {
    if (previousFileInfo) {
      // choose hashing algorithm: default to crc64 (nvme-style) for compatibility
      const hashMethod = mappingOptions.hashMethod || 'crc64'
      try {
        if (hashMethod === 'sha256') {
          preMappedHash = await sha256Hex(fileArrayBuffer)
        } else if (hashMethod === 'crc64') {
          preMappedHash = crc64Hex(fileArrayBuffer)
        } else {
          preMappedHash = crc32Hex(fileArrayBuffer)
        }
      } catch (e) {
        console.warn(`Failed to compute preMappedHash for ${fileInfo.name}`, e)
        preMappedHash = undefined
      }

      canSkip =
        previousFileInfo.size === fileInfo.size &&
        previousFileInfo.mtime === mtime &&
        !!preMappedHash &&
        previousFileInfo.preMappedHash === preMappedHash
    }
  } else if (compareMode === 'localBasic') {
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
      mappingRequired: false,
      fileInfo: {
        name: fileInfo.name,
        size: fileInfo.size,
        path: fileInfo.path,
        mtime: previousFileInfo.mtime,
        preMappedHash: preMappedHash,
        postMappedHash: previousFileInfo.postMappedHash,
      },
      // include curationTime even when skipped to measure hashing/check time
      curationTime: performance.now() - startTime,
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
      curationTime: performance.now() - startTime,
    }

    return mapResults
  }

  // 6) perform mapping
  const { dicomData: mappedDicomData, mapResults: clonedMapResults } =
    curateDict(`${fileInfo.path}/${fileInfo.name}`, fileIndex, dicomData, mappingOptions)

  // Indicate that mapping was required (we didn't hit the early-skip branch above)
  // Previously mappingRequired was only set to false when skipping; ensure it's
  // explicitly set to true when mapping was performed so consumers can rely on
  // the flag being present in both cases.
  clonedMapResults.mappingRequired = true

  // 7) write output if requested
  if (!mappingOptions.skipWrite) {
    const dirPath = clonedMapResults.outputFilePath.split('/').slice(0, -1).join('/')
    const fileName = clonedMapResults.outputFilePath.split('/').slice(-1)[0]

    const modifiedArrayBuffer = mappedDicomData.write({ allowInvalidVRLength: true })

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
        const fileHandle = await subDirectoryHandle.getFileHandle(fileName, { create: true })
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
      clonedMapResults.mappedBlob = new Blob([modifiedArrayBuffer], { type: 'application/octet-stream' })
    }

    // If no directory or even if directory present, expose mappedBlob for consumers
    clonedMapResults.mappedBlob = new Blob([modifiedArrayBuffer], { type: 'application/octet-stream' })

    // If upload URL provided, perform an HTTP PUT upload to the server
    if (outputTarget?.url) {
      // compute postMappedHash if deep compare so headers can include source/mapped hashes
      if (compareMode === 'localDeep') {
        const hashMethod = mappingOptions.hashMethod || 'crc64'
        try {
          if (hashMethod === 'sha256') {
            postMappedHash = await sha256Hex(modifiedArrayBuffer)
          } else if (hashMethod === 'crc64') {
            postMappedHash = crc64Hex(modifiedArrayBuffer)
          } else {
            postMappedHash = crc32Hex(modifiedArrayBuffer)
          }
        } catch (e) {
          console.warn('Failed to compute postMappedHash', e)
          postMappedHash = undefined
        }
      }

      try {
        // Build upload URL: append the outputFilePath (url-escaped)
        const baseUrl = outputTarget.url.replace(/\/+$/g, '')
        // Encode each part of the path, but not the slashes
        const key = clonedMapResults.outputFilePath
          .split('/')
          .map(encodeURIComponent)
          .join('/')
        const uploadUrl = `${baseUrl}/upload/${key}`

        // Create headers per helper described by the user
        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': fileName,
          'X-File-Type': clonedMapResults.mappedBlob.type || 'application/octet-stream',
          'X-File-Size': String(modifiedArrayBuffer.byteLength),
          'X-Source-File-Modified-Time': mtime || '',
          'X-Source-File-Hash': preMappedHash || '',
        }
        if (outputTarget.token) headers.Authorization = `Bearer ${outputTarget.token}`

        const resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers,
          body: clonedMapResults.mappedBlob,
        })

        if (!resp.ok) {
          console.error(`Upload failed for ${uploadUrl}: ${resp.status} ${resp.statusText}`)
          clonedMapResults.errors = clonedMapResults.errors || []
          clonedMapResults.errors.push(`Upload failed: ${resp.status} ${resp.statusText}`)
        } else {
          // attach upload info if available
          clonedMapResults.outputUpload = clonedMapResults.outputUpload || { url: uploadUrl, status: resp.status }
        }
      } catch (e) {
        console.error('Upload error', e)
        clonedMapResults.errors = clonedMapResults.errors || []
        clonedMapResults.errors.push(`Upload error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (compareMode === 'localDeep') {
      const hashMethod = mappingOptions.hashMethod || 'crc64'
      try {
        if (hashMethod === 'sha256') {
          postMappedHash = await sha256Hex(modifiedArrayBuffer)
        } else if (hashMethod === 'crc64') {
          postMappedHash = crc64Hex(modifiedArrayBuffer)
        } else {
          postMappedHash = crc32Hex(modifiedArrayBuffer)
        }
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

  clonedMapResults.curationTime = performance.now() - startTime

  return clonedMapResults
}
