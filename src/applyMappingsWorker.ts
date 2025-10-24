import { curateOne } from './curateOne'
import { deserializeMappingOptions } from './serializeMappingOptions'
import type { TFileInfo, TSerializedMappingOptions } from './types'

declare var self: Window & typeof globalThis

export type MappingRequest = {
  request: 'apply'
  fileInfo: TFileInfo
  fileIndex: number
  outputTarget?: { url?: string; directory?: FileSystemDirectoryHandle }
  previousFileInfo?: { size?: number; mtime?: string; preMappedHash?: string }
  serializedMappingOptions: TSerializedMappingOptions
}

self.addEventListener('message', (event: MessageEvent<MappingRequest>) => {
  switch (event.data.request) {
    case 'apply': {
      const { serializedMappingOptions } = event.data
      const mappingOptions = deserializeMappingOptions(serializedMappingOptions)

      try {
        curateOne({
          fileInfo: event.data.fileInfo,
          fileIndex: event.data.fileIndex,
          outputTarget: event.data.outputTarget || {},
          mappingOptions,
          previousFileInfo: event.data.previousFileInfo,
        }).then((mapResults) => {
          // Send finished message for completion
          self.postMessage({
            response: 'finished',
            mapResults: mapResults,
          })
        }).catch((error) => {
          // also catch promise rejections
          self.postMessage({ response: 'error', error })
        })
      } catch (error) {
        self.postMessage({ response: 'error', error })
        // no need to throw here, it would terminate the worker
      }
      break
    }
    default:
      console.error(`Unknown request ${event.data.request}`)
  }
})
