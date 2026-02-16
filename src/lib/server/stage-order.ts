export function reorderStageIds(stageIds: string[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= stageIds.length) {
    return stageIds;
  }
  if (toIndex < 0 || toIndex >= stageIds.length) {
    return stageIds;
  }
  const clone = [...stageIds];
  const [moved] = clone.splice(fromIndex, 1);
  if (!moved) {
    return stageIds;
  }
  clone.splice(toIndex, 0, moved);
  return clone;
}
