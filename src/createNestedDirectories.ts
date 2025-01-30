export default async function createNestedDirectories(
  topLevelDirectoryHandle: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle | false> {
  const pathSegments = path.split('/').filter((segment) => segment !== '')

  let currentDirectoryHandle = topLevelDirectoryHandle

  for (const segment of pathSegments) {
    try {
      // Attempt to get the directory handle without creating it
      const entry = await currentDirectoryHandle.getDirectoryHandle(segment, {
        create: false,
      })
      currentDirectoryHandle = entry
    } catch (error) {
      // If the error is specifically about the directory not existing, create it
      if ((error as Error).name === 'NotFoundError') {
        const entry = await currentDirectoryHandle.getDirectoryHandle(segment, {
          create: true,
        })
        currentDirectoryHandle = entry
      } else {
        // Handle other potential errors (e.g., name conflicts)
        return false // Indicate failure
      }
    }
  }

  // Return the last directory handle
  return currentDirectoryHandle
}
