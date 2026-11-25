export type PersistState = 'persisted' | 'not-persisted' | 'unsupported'

/** Whether the browser has promised not to evict this app's data. */
export async function storagePersistState(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported'
  return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted'
}

/**
 * Asks the browser to keep this app's data under storage pressure. Chrome
 * decides silently (installed apps usually get it); Safari does not support
 * a guarantee, which is why the backup nudge exists.
 */
export async function requestPersistence(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported'
  return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted'
}
