/**
 * 组件权限同步 - 「增强 → 权限配置」与 permissionManager 资源之间的同步逻辑
 *
 * 资源定义统一存于 permissionStore.resources(单一物理存储);组件通过
 * componentMapping.componentPermissionId 标记"我拥有这些行"。
 *
 * "保存即 upsert" 已由 ResourcePanel 的 addResource/updateResource 现成提供,
 * 本 composable 只补齐另外三块缺口:回流对账 / 删除级联 / 改名。
 */

import { usePermissionStore } from './usePermissionStore.js'

export function useComponentPermissionSync() {
  const store = usePermissionStore()

  // store 未加载时从当前项目拉取一次(打开弹窗 / 删除节点等冷场景)
  function ensureLoaded() {
    if (!store.resources.length) {
      store.ensureProjectPermissions()
    }
  }

  // 组件拥有的资源行(权威来源:按 componentPermissionId 查 store)
  function getOwnedResources(componentPermissionId) {
    if (!componentPermissionId) return []
    return store.resources.filter(
      (r) => r.componentMapping?.componentPermissionId === componentPermissionId
    )
  }

  // 回流对账:用 store 现状重建组件侧 ownedRows,自动丢弃 store 已不存在的引用。
  // 返回 true 表示组件侧摘要发生了变化。
  function reconcileComponent(permissionConfig) {
    if (!permissionConfig?.id) return false

    const next = getOwnedResources(permissionConfig.id).map((r) => ({
      resourceId: r.id,
      type: r.type,
      name: r.name,
      identifier: r.identifier,
    }))

    const prev = permissionConfig.ownedRows || []
    const changed =
      prev.length !== next.length ||
      next.some((row, i) => row.resourceId !== prev[i]?.resourceId || row.name !== prev[i]?.name)

    permissionConfig.ownedRows = next
    return changed
  }

  // 级联删除:组件被删时移除其拥有的全部资源行
  function removeComponentResources(componentPermissionId) {
    if (!componentPermissionId) return 0
    ensureLoaded()

    const owned = getOwnedResources(componentPermissionId)
    if (!owned.length) return 0

    owned.forEach((r) => store.removeResource(r.id))
    store.syncProjectPermissions()
    return owned.length
  }

  // 改名:组件 label 变更时同步各行 componentMapping.componentName
  function renameComponent(componentPermissionId, newName) {
    if (!componentPermissionId || !newName) return 0

    const owned = getOwnedResources(componentPermissionId)
    owned.forEach((r) => {
      store.updateResource(r.id, {
        componentMapping: { ...r.componentMapping, componentName: newName },
      })
    })
    if (owned.length) store.syncProjectPermissions()
    return owned.length
  }

  return {
    ensureLoaded,
    getOwnedResources,
    reconcileComponent,
    removeComponentResources,
    renameComponent,
  }
}
