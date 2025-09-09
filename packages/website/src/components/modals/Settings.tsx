import type { Component, Setter } from "solid-js";
import { Modal } from "~/components/modals";
import { Switch } from "@kobalte/core";

import { DEFAULT_USER_CUSTOMIZATION, getUserCustomizationKey, preferences, setMainGroup, setSubGroup, setUserCustomization, textColorOnBG } from "~/stores/preferences";
import { resetAppCache } from "~/stores/timetables";
import { DefaultColorPicker } from '@thednp/solid-color-picker'
import "@thednp/solid-color-picker/style.css";
import "~/styles/overwrite-color-picker.css";

const SelectionButton: Component<{
  active: boolean,
  onClick: () => void,
  content: string
}> = (props) => (
  <button type="button"
    class="w-full text-center rounded-lg px-4 py-1"
    onClick={() => props.onClick()}
    classList={{
      "text-[rgb(120,120,120)] bg-[rgb(50,50,50)]": !props.active,
      "bg-red font-medium": props.active,
    }}
    style={props.active ? { color: textColorOnBG() } : void 0}
  >
    {props.content}
  </button>
);

export const SettingsModal: Component<{ open: boolean, setOpen: Setter<boolean> }> = (props) => {
  const userPrimaryColor = () => preferences.customization.primary_color ?? DEFAULT_USER_CUSTOMIZATION.primary_color;
  let pastColor: string = userPrimaryColor();

  return (
    <Modal title="Paramètres"
      modal={true}
      open={props.open}
      setOpen={props.setOpen}
    >
      <div class="p-4 flex flex-col gap-6">
        <section>
          <h3 class="text-[rgb(240,240,240)] text-[18px] mb-2">
            Groupe principal
          </h3>
          <div class="flex">
            <button type="button"
              disabled={preferences.main_group <= 1}
              class="text-center border-2 border-red text-[rgb(220,220,220)] disabled:(bg-red text-transparent) px-4 py-1 border-r-none rounded-l-lg"
              onClick={() => {
                let value = preferences.main_group - 1;
                if (value === 6) value--;
                if (value < 1) return;

                setMainGroup(value);
              }}
            >
              -1
            </button>
            <p
              aria-label="Groupe principal"
              class="w-full text-center bg-red px-3 py-1 font-medium text-lg"
              style={{ color: textColorOnBG() }}
            >
              G{preferences.main_group}
            </p>
            <button type="button"
              disabled={preferences.main_group >= 8}
              class="text-center border-2 border-red text-[rgb(220,220,220)] disabled:(bg-red text-transparent) px-4 py-1 border-l-none rounded-r-lg"
              onClick={() => {
                let value = preferences.main_group + 1;
                if (value === 6) value++;
                if (value > 8) return;

                setMainGroup(value);
              }}
            >
              +1
            </button>
          </div>

          <p class="text-[rgb(190,190,190)] text-xs mt-1.5">
            Ajustez le groupe dans lequel vous êtes (ex.: G1, G2, …) <br />
            C'est avec le groupe qu'est déterminée l'année.
          </p>
        </section>

        <section>
          <h3 class="text-[rgb(240,240,240)] text-[18px] mb-2">
            Sous-groupe
          </h3>

          <div class="flex gap-2">
            <SelectionButton
              content="A"
              active={preferences.sub_group === 0}
              onClick={() => setSubGroup(0)}
            />
            <SelectionButton
              content="B"
              active={preferences.sub_group === 1}
              onClick={() => setSubGroup(1)}
            />
          </div>

          <p class="text-[rgb(190,190,190)] text-xs mt-1.5">
            Ajustez le sous-groupe dans lequel vous êtes (ex.: G{preferences.main_group}A ou G{preferences.main_group}B)
          </p>
        </section>

        <section>
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-[rgb(240,240,240)] text-[18px] flex">
              Couleur de l'interface
            </h3>
            <div
              class="w-4 h-4 rounded-full"
              style={{ "background-color": `rgb(${userPrimaryColor()})` }}
            ></div>
          </div>

          <DefaultColorPicker format="rgb" value={"rgb(" + userPrimaryColor() + ")"} onChange={color => {
            if (color === pastColor) return;

            pastColor = color;
            color = color.replace("rgb(", "").replace(")", "");
            setUserCustomization({
              ...preferences.customization,
              primary_color: color
            });
          }} lang="fr" />

        </section>

        <section>
          <h3 class="text-[rgb(240,240,240)] text-[18px]">
            Vue de l'EDT
          </h3>

          <Switch.Root
            class="flex items-center justify-between mt-2"
            checked={getUserCustomizationKey("use_fixed_height")}
            onChange={value => setUserCustomization({
              ...preferences.customization,
              use_fixed_height: value
            })}
          >
            <Switch.Label class="mr-1.5 text-[rgb(220,220,220)] select-none">
              Alignement sur les heures
            </Switch.Label>
            <Switch.Input />
            <Switch.Control class="inline-flex items-center h-6 w-11 rounded-full px-.5 bg-[rgb(48,48,48)] ui-checked:bg-red transition-colors">
              <Switch.Thumb class="h-5 w-5 rounded-full bg-white ui-checked:(transform translate-x-[calc(100%-1px)]) transition-transform" />
            </Switch.Control>
          </Switch.Root>

          <p class="text-[rgb(190,190,190)] text-xs mt-1.5">
            Le positionnement des cours sur l'emploi du temps sera aligné sur les heures.
          </p>

          {/* <Switch.Root class="flex items-center justify-between mt-4">
            <Switch.Label class="mr-1.5 text-[rgb(220,220,220)] select-none">
              Vue semaine (PC uniquement)
            </Switch.Label>
            <Switch.Input />
            <Switch.Control class="inline-flex items-center h-6 w-11 rounded-full px-.5 bg-[rgb(48,48,48)] ui-checked:bg-red transition-colors">
              <Switch.Thumb class="h-5 w-5 rounded-full bg-white ui-checked:(transform translate-x-[calc(100%-1px)]) transition-transform" />
            </Switch.Control>
          </Switch.Root>

          <p class="text-[rgb(190,190,190)] text-xs mt-1.5">
            Désactive la navigation en "slide" et affiche l'emploi du temps sur une semaine entière.
          </p> */}
        </section>
      </div>

      <div class="h-[1px] w-full border-b border-b-[rgb(90,90,90)]" />

      <section class="p-4">
        <h3 class="text-[rgb(240,240,240)] text-[18px] mb-2">
          Zone dangereuse
        </h3>

        <button class="w-full text-center border border-red text-red hover:bg-red/10 active:bg-red/20 px-3 py-1 rounded-lg"
          type="button"
          onClick={async () => {
            await resetAppCache();
            window.location.reload();
          }}
        >
          Effacer le cache
        </button>
        <p class="text-[rgb(190,190,190)] text-xs mt-1.5">
          Supprime le cache stocké par l'application dans le navigateur.
        </p>
      </section>
    </Modal>
  )
}
