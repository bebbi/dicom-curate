import { curateOne } from './curateOne'
import { deserializeMappingOptions } from './serializeMappingOptions'
import type {
  TFileInfo,
  TSerializedMappingOptions,
  THTTPOptions,
  TFileInfoIndex,
} from './types'
import { fixupNodeWorkerEnvironment } from './worker'

export type MappingRequest =
  | {
      request: 'apply'
      fileInfo: TFileInfo
      fileIndex: number
      outputTarget?: {
        http?: THTTPOptions
        directory?: FileSystemDirectoryHandle | string
      }
      previousFileInfo?: {
        size?: number
        mtime?: string
        preMappedHash?: string
      }
      serializedMappingOptions: TSerializedMappingOptions
    }
  | {
      request: 'fileInfoIndex'
      fileInfoIndex?: TFileInfoIndex
    }

let postMappedFileInfo: TFileInfoIndex | undefined

fixupNodeWorkerEnvironment().then(() => {
  globalThis.addEventListener(
    'message',
    (event: MessageEvent<MappingRequest>) => {
      switch (event.data.request) {
        case 'fileInfoIndex': {
          postMappedFileInfo = event.data.fileInfoIndex
          break
        }
        case 'apply': {
          const { serializedMappingOptions } = event.data
          const mappingOptions = deserializeMappingOptions(
            serializedMappingOptions,
          )

          try {
            curateOne({
              fileInfo: event.data.fileInfo,
              fileIndex: event.data.fileIndex,
              outputTarget: event.data.outputTarget || {},
              mappingOptions,
              previousSourceFileInfo: event.data.previousFileInfo,
              previousMappedFileInfo: (targetName) => {
                const hash = postMappedFileInfo?.[targetName]
                // console.log(`Lookup postMappedHash for ${targetName}: ${hash?.postMappedHash}`)
                return hash
              },
            })
              .then((mapResults) => {
                // Send finished message for completion
                globalThis.postMessage({
                  response: 'finished',
                  mapResults: mapResults,
                })
              })
              .catch((error) => {
                // also catch promise rejections
                globalThis.postMessage({ response: 'error', error })
              })
          } catch (error) {
            globalThis.postMessage({ response: 'error', error })
            // no need to throw here, it would terminate the worker
          }
          break
        }
        default:
          console.error(`Unknown request ${(event.data as any).request}`)
      }
    },
  )
})
