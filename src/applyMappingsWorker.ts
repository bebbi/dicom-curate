import { curateOne } from './curateOne'
import { deserializeMappingOptions } from './serializeMappingOptions'
import type { TFileInfo, TSerializedMappingOptions } from './types'
import { fixupNodeWorkerEnvironment } from './worker'

export type MappingRequest = {
  request: 'apply'
  fileInfo: TFileInfo
  fileIndex: number
  outputDirectory?: FileSystemDirectoryHandle | string
  serializedMappingOptions: TSerializedMappingOptions
}

fixupNodeWorkerEnvironment().then(() => {
  globalThis.addEventListener(
    'message',
    (event: MessageEvent<MappingRequest>) => {
      switch (event.data.request) {
        case 'apply': {
          const { serializedMappingOptions } = event.data
          const mappingOptions = deserializeMappingOptions(
            serializedMappingOptions,
          )

          try {
            curateOne({
              fileInfo: event.data.fileInfo,
              fileIndex: event.data.fileIndex,
              outputDirectory: event.data.outputDirectory,
              mappingOptions,
            }).then((mapResults) => {
              // Send finished message for completion
              globalThis.postMessage({
                response: 'finished',
                mapResults: mapResults,
              })
            })
          } catch (error) {
            globalThis.postMessage({ response: 'error', error })
            throw new Error('ERROR')
          }
          break
        }
        default:
          console.error(`Unknown request ${event.data.request}`)
      }
    },
  )
})
