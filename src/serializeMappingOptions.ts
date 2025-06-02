import { TMappingOptions } from './types'
import { assertNoClosure } from './checkClosure'

type TSerializedMappingOptions = Omit<TMappingOptions, 'curationSpec'> & {
  curationSpecStr: string
}

export function serializeMappingOptions(
  mappingOptions: TMappingOptions,
): TSerializedMappingOptions {
  // throw on invalid curation spec
  assertNoClosure(mappingOptions.curationSpec)

  const { curationSpec, ...rest } = mappingOptions
  const curationSpecStr = curationSpec.toString()

  return { ...rest, curationSpecStr }
}

export function deserializeMappingOptions(
  serializedMappingOptions: TSerializedMappingOptions,
): TMappingOptions {
  const { curationSpecStr, ...rest } = serializedMappingOptions
  const curationSpec = new Function(`return ${curationSpecStr}`)()

  return { ...rest, curationSpec }
}
