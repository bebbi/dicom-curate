// Define the type for UniqueNumbers instance
type UniqueNumbersInstance = {
  getUniqueNumberInGroup: (groupingId: string) => string
  clearUniqueNumberCache: () => void
}

// Keep track of all instances for global reset capability
const uniqueNumberInstances: UniqueNumbersInstance[] = []

export function UniqueNumbers(padding: number = 5): UniqueNumbersInstance {
  // Internal state to hold counters for each grouping ID
  let groupCounters: { [groupingId: string]: number } = {}
  // Provide uniqueness within group
  function getUniqueNumberInGroup(groupingId: string): string {
    groupCounters[groupingId] = groupCounters[groupingId]
      ? groupCounters[groupingId] + 1
      : 1

    return groupCounters[groupingId].toString().padStart(padding, '0')
  }

  function clearUniqueNumberCache(): void {
    groupCounters = {}
  }

  // Create the instance and add to our registry
  const instance: UniqueNumbersInstance = {
    getUniqueNumberInGroup,
    clearUniqueNumberCache,
  }
  uniqueNumberInstances.push(instance)

  return instance
}

// Export a global function to reset counts across instances
export function resetCounts(): void {
  // Reset all registered instances
  uniqueNumberInstances.forEach((instance: UniqueNumbersInstance) => {
    instance.clearUniqueNumberCache()
  })
}
