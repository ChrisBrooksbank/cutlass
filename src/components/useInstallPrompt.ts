import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallPromptState {
  /** Whether the browser supports install and the user hasn't dismissed/installed yet */
  canInstall: boolean
  /** Trigger the browser install prompt */
  promptInstall: () => void
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Clear if user installs via external means
    window.addEventListener('appinstalled', () => setDeferredPrompt(null))

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const promptInstall = useCallback(() => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    })
  }, [deferredPrompt])

  return {
    canInstall: deferredPrompt !== null,
    promptInstall,
  }
}
