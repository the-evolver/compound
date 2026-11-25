/*
 * Saving and opening files. On phones, saving goes through the share sheet
 * ("Save to Files", Drive, WhatsApp…), which works in installed apps on
 * iPhone where plain downloads are unreliable. On computers it downloads.
 */

export type SaveResult = 'saved' | 'shared' | 'cancelled' | 'needs-tap'

function prefersShareSheet(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Saves a file. Returns "needs-tap" when the browser wants a fresh tap
 * before sharing (the work before it took too long); call again from a
 * button press.
 */
export async function saveFile(name: string, type: string, content: string): Promise<SaveResult> {
  const file = new File([content], name, { type })
  if (prefersShareSheet() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      const err = e as DOMException
      if (err.name === 'AbortError') return 'cancelled'
      if (err.name === 'NotAllowedError') return 'needs-tap'
      // Any other share failure: fall back to a download.
    }
  }
  download(file)
  return 'saved'
}

/** Opens the system file picker and reads the chosen text file. */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      resolve(file ? { name: file.name, text: await file.text() } : null)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
