import { type Component, Show } from 'solid-js'
import { useRegisterSW } from 'virtual:pwa-register/solid'

const Updater: Component = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r) {
      console.info("[service-worker]: registered, starting the update checking interval.");

      // Check for updates every hours.
      // Useful when the app is always open.
      r && setInterval(() => {
        r.update()
      }, 60 * 60 * 1000) 
    },

    onRegisterError(error) {
      console.error("[service-worker]: an error was produced.", error);
    },
  })

  const close = () => setNeedRefresh(false);

  return (
    <Show when={needRefresh()}>
      <div class="flex flex-col gap-4">
        <div>
          <p>Une mise à jour est disponible.</p>
        </div>

        <Show when={needRefresh()}>
          <button onClick={() => updateServiceWorker(true)}>Reload</button>
        </Show>

        <button onClick={() => close()}>Close</button>
      </div>
    </Show>
  )
}

export default Updater;
