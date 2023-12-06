import { type Component, createEffect, on, createSignal, Show, For } from 'solid-js'
import { useRegisterSW } from 'virtual:pwa-register/solid'
import { Modal } from "~/components/modals";

import MdiClose from '~icons/mdi/close'
import MdiUpdate from '~icons/mdi/update'
import MdiLoading from '~icons/mdi/loading'

import { GitHubCommitCompareResponse, getGitHubCommitCompare } from "~/utils/github";

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
  });

  const [commitDetails, setCommitDetails] = createSignal<GitHubCommitCompareResponse | null>(null);
  createEffect(on(needRefresh, async (needRefresh) => {
    if (!needRefresh) return;

    const response = await getGitHubCommitCompare(__APP_COMMIT_SHA__);
    setCommitDetails(response);
  }));

  const closeNoReload = () => {
    updateServiceWorker(false);
    setNeedRefresh(false);
  };

  return (
    <Modal title="Mise à jour"
      modal={true}
      open={needRefresh()}
      onClose={() => closeNoReload()}
    >
      <div class="p-4 flex flex-col gap-4">
        <div class="flex items-center justify-center gap-2">
          <MdiUpdate class="text-red" />
          <p class="text-[rgb(230,230,230)]">
            Une nouvelle mise à jour est disponible !
          </p>
        </div>

        <Show when={commitDetails()}
          fallback={
            <div class="py-2 px-4 bg-[rgb(40,40,40)] animate-pulse rounded-lg flex justify-center gap-4 text-[rgb(220,220,220)]">
              <MdiLoading class="animate-spin" />
              <p class="animate-pulse text-sm">
                Chargement des modifications...
              </p>
            </div>
          }
        >
          {compare => (
            <div class="bg-[rgb(40,40,40)] rounded-lg">
              <div class="p-4">
                <p class="text-[rgb(240,240,240)]">
                  Il y a eu {compare().total_commits} modification(s).
                </p>
                <a class="text-red text-sm hover:underline" href={compare().permalink_url}>
                  Voir les commits sur GitHub
                </a>
              </div>

              <div class="h-[1px] w-full border-b border-b-[rgb(60,60,60)]" />

              <div class="p-4">
                <For each={compare().commits}>
                  {(detail, index) => (
                    <div class="flex flex-col gap-2">
                      <Show when={index() === 0 || index() && compare().commits[index() - 1].author.login !== detail.author.login}>
                        <div class="flex items-center gap-2">
                          <img src={detail.author.avatar_url} class="w-8 h-8 rounded-full" />
                          <p class="text-[rgb(230,230,230)] font-medium">
                            {detail.author.login}
                          </p>
                        </div>
                      </Show>

                      <p class="text-sm text-[rgb(230,230,230)] mb-1">
                        {detail.commit.message} <span class="text-[rgb(150,150,150)]">({detail.sha.slice(0,8)})</span>
                      </p>
                    </div>
                  )}
                </For>
              </div>

            </div>
          )}
        </Show>
      </div>

      <div class="h-[1px] w-full border-b border-b-[rgb(90,90,90)]" />

      <div class="p-4 flex justify-end gap-6">
        <button type="button" onClick={() => closeNoReload()}
          class="px-4 py-2 rounded-lg hover:bg-[rgb(36,36,36)] active:bg-[rgb(42,42,42)] text-[rgb(220,220,220)] active:text-[rgb(230,230,230)] transition-colors duration-200"
        >
          Plus tard
        </button>
        <button type="button" onClick={() => updateServiceWorker(true)}
          class="px-4 py-2 rounded-lg bg-red text-[rgb(18,18,18)] font-medium"
        >
          Redémarrer
        </button>
      </div>
    </Modal>
  )
}

export default Updater;
