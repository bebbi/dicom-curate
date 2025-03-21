export function UniqueNumbers(padding: number = 5) {
  // Internal state to hold counters for each grouping ID
  let groupCounters: { [groupingId: string]: number } = {}
  // Provide uniqueness within group
  function getUniqueNumberInGroup(groupingId: string): string {
    groupCounters[groupingId] = groupCounters[groupingId]
      ? groupCounters[groupingId] + 1
      : 1

    return groupCounters[groupingId].toString().padStart(padding, '0')
  }

  function clearUniqueNumberCache() {
    groupCounters = {}
  }

  return { getUniqueNumberInGroup, clearUniqueNumberCache }
}
