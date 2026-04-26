import { useEffect, useCallback, useRef, useState } from 'react'

interface SWState {
  /** A new version is waiting to activate */
  updateAvailable: boolean
  /** Apply the waiting update and reload */
  applyUpdate: () => void
}

export function useServiceWorker(): SWState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const reloadOnControllerChangeRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      registration = reg

      // If there's already a waiting worker on load
      if (reg.waiting) {
        setWaitingWorker(reg.waiting)
      }

      // Detect new update installed
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available — prompt user
            setWaitingWorker(newWorker)
          }
        })
      })
    })

    // When the new SW activates (after skipWaiting), reload the page
    let refreshing = false
    const onControllerChange = () => {
      if (!reloadOnControllerChangeRef.current) return
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Check for updates every 60 minutes
    const interval = setInterval(
      () => {
        registration?.update()
      },
      60 * 60 * 1000,
    )

    return () => {
      clearInterval(interval)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    reloadOnControllerChangeRef.current = true
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingWorker])

  return {
    updateAvailable: waitingWorker !== null,
    applyUpdate,
  }
}
