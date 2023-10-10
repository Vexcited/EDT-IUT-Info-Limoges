import type { Component, Setter } from "solid-js";
import { Dialog, Select } from "@kobalte/core";

import MdiClose from '~icons/mdi/close'
import MdiCheck from '~icons/mdi/check'
import MdiChevronDown from '~icons/mdi/chevron-down'

import { preferences, setMainGroup, setSubGroup, setYear } from "~/stores/preferences";
import { changeTheme, theme } from "~/stores/theme";
import { deleteAllStores } from "~/utils/timetables";

export const SettingsModal: Component<{ open: boolean, setOpen: Setter<boolean> }> = (props) => {
  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => props.setOpen(open)} modal={true}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-overlay opacity-40" />

        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content class="bg-white border-2 border-gray p-4 max-w-[450px] w-full m-4">
            <div class="relative flex item justify-between items-center mb-2">
              <Dialog.Title class="text-[20px] font-medium text-gray border-b-2 border-gray">
                Paramètres
              </Dialog.Title>
              <Dialog.CloseButton class="flex items-center justify-center hover:bg-gray hover:text-white p-2">
                <MdiClose class="h-[16px] w-[16px]" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-[16px] text-subgray">
              Personnalisez votre emploi du temps.
            </Dialog.Description>

            <section class="mt-4">
              <h3 class="text-gray text-[18px] mb-1">
                Année
              </h3>
              <Select.Root
                value={preferences.year}
                onChange={(year) => setYear(year)}
                options={[1, 2, 3]}
                placeholder="Sélectionner une année…"
                itemComponent={props => (
                  <Select.Item item={props.item}
                    class="cursor-pointer text-[16px] flex items-center justify-between h-[32px] py-0 px-2 relative user-select-none outline-none"
                  >
                    <Select.ItemLabel class="text-subgray">
                      A{props.item.rawValue}
                    </Select.ItemLabel>
                    <Select.ItemIndicator>
                      <MdiCheck class="h-[20px] h-[20px]" />
                    </Select.ItemIndicator>
                  </Select.Item>
                )}
              >
                <Select.Trigger aria-label="Année"
                  class="w-full flex gap-4 items-center justify-between border border-gray text-gray px-3 py-1"
                >
                  <Select.Value<number>>
                    {state => "A" + state.selectedOption()}
                  </Select.Value>
                  <Select.Icon>
                    <MdiChevronDown />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Description class="text-subgray text-xs mt-1">
                  Choisissez l'année dans laquelle vous êtes.
                </Select.Description>

                <Select.Portal>
                  <Select.Content class="bg-white z-50 border-gray border shadow">
                    <Select.Listbox class="overflow-y-auto max-h-[360px] p-2" />
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </section>

            <section class="mt-4">
              <h3 class="text-gray text-[18px] mb-1">
                Groupe principal
              </h3>
              <div class="flex gap-2">
                <button type="button"
                  disabled={preferences.main_group <= 1}
                  class="text-center border border-gray text-gray bg-white px-4 py-1 disabled:opacity-50"
                  onClick={() => {
                    const value = preferences.main_group - 1;
                    if (value < 1) return;
                    setMainGroup(value)
                  }}
                >
                  -1
                </button>
                <div
                  aria-label="Groupe principal"
                  class="w-full text-center border border-gray text-white bg-gray px-3 py-1 font-medium text-lg"
                >
                  G{preferences.main_group}
                </div>
                <button type="button"
                  disabled={preferences.main_group >= 8}
                  class="text-center border border-gray text-gray bg-white px-4 py-1 disabled:opacity-50"
                  onClick={() => {
                    const value = preferences.main_group + 1;
                    if (value > 8) return;
                    setMainGroup(value);
                  }}
                >
                  +1
                </button>
              </div>

              <p class="text-subgray text-xs mt-1">
                Ajustez le groupe dans lequel vous êtes (ex.: G1, G2, …)
              </p>
            </section>

            <section class="mt-4">
              <h3 class="text-gray text-[18px] mb-1">
                Sous-groupe
              </h3>
              <div class="flex gap-2">
                <button type="button"
                  class="w-full text-center border border-gray px-4 py-1"
                  onClick={() => setSubGroup(0)}
                  classList={{
                    "text-gray bg-white": preferences.sub_group !== 0,
                    "text-white bg-gray": preferences.sub_group === 0,
                  }}
                >
                  A
                </button>
                <button type="button"
                  class="w-full text-center border border-gray px-4 py-1"
                  onClick={() => setSubGroup(1)}
                  classList={{
                    "text-gray bg-white": preferences.sub_group !== 1,
                    "text-white bg-gray": preferences.sub_group === 1,
                  }}
                >
                  B
                </button>
              </div>

              <p class="text-subgray text-xs mt-1">
                Ajustez le sous-groupe dans lequel vous êtes (ex.: G{preferences.main_group}A ou G{preferences.main_group}B)
              </p>
            </section>

            <section class="mt-4">
              <h3 class="text-gray text-[18px] mb-1">
                Thème
              </h3>
              <Select.Root
                value={theme()}
                onChange={(theme) => changeTheme(theme)}
                options={[
                  "catppuccin-latte",
                  "catppuccin-macchiato",
                  "nord-dark", "nord-light",
                  "rose-pine",
                  "rose-pine-dawn-iris",
                ]}
                placeholder="Sélectionner un thème…"
                itemComponent={props => (
                  <Select.Item item={props.item}
                    class="cursor-pointer text-[16px] flex items-center justify-between h-[32px] py-0 px-2 relative user-select-none outline-none"
                  >
                    <Select.ItemLabel class="text-subgray">
                      {props.item.rawValue}
                    </Select.ItemLabel>
                    <Select.ItemIndicator>
                      <MdiCheck class="h-[20px] h-[20px]" />
                    </Select.ItemIndicator>
                  </Select.Item>
                )}
              >
                <Select.Trigger aria-label="Année"
                  class="w-full flex gap-4 items-center justify-between border border-gray text-gray px-3 py-1"
                >
                  <Select.Value<string>>
                    {state => state.selectedOption()}
                  </Select.Value>
                  <Select.Icon>
                    <MdiChevronDown />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Description class="text-subgray text-xs mt-1">
                  Choisissez un thème.
                </Select.Description>

                <Select.Portal>
                  <Select.Content class="bg-white z-50 border-gray border shadow">
                    <Select.Listbox class="overflow-y-auto max-h-[360px] p-2" />
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </section>

            <section class="mt-4">
              <h3 class="text-gray text-[18px] mb-1">
                Données
              </h3>
              <button class="w-full text-center border border-gray px-4 py-2 text-gray bg-white hover:text-white hover:bg-gray"
                type="button"
                onClick={async () => {
                  await deleteAllStores();
                  window.location.reload();
                }}
              >
                Effacer le cache
              </button>
              <p class="text-subgray text-xs mt-1">
                Supprime les EDTs stockés dans le navigateur.
              </p>
            </section>

          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}