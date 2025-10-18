import { curateOne } from './curateOne'
import { deserializeMappingOptions } from './serializeMappingOptions'
import { setSharedUidMappings } from './replaceUid'
import type { TFileInfo, TSerializedMappingOptions } from './types'

declare var self: Window & typeof globalThis

export type MappingRequest = {
  request: 'apply'
  fileInfo: TFileInfo
  fileIndex: number
  outputDirectory?: FileSystemDirectoryHandle
  serializedMappingOptions: TSerializedMappingOptions
}

self.addEventListener('message', (event: MessageEvent<MappingRequest>) => {
  switch (event.data.request) {
    case 'apply': {
      const { serializedMappingOptions } = event.data
      const mappingOptions = deserializeMappingOptions(serializedMappingOptions)

      // Set shared UID mappings if provided
      setSharedUidMappings(mappingOptions.uidMappings)

      curateOne({
        fileInfo: event.data.fileInfo,
        fileIndex: event.data.fileIndex,
        outputDirectory: event.data.outputDirectory,
        mappingOptions,
      })
        .then((mapResults) => {
          // Send finished message for completion
          self.postMessage({
            response: 'finished',
            mapResults: mapResults,
          })
        })
        .catch((error) => {
          console.error('Error processing file:', error)
          self.postMessage({ response: 'error', error })
        })
      break
    }
    default:
      console.error(`Unknown request ${event.data.request}`)
  }
})
