import type { ParentComponent, Setter } from "solid-js";
import { Dialog } from "@kobalte/core";

import MdiClose from '~icons/mdi/close'

export const Modal: ParentComponent<{ title: string, open: boolean, setOpen?: Setter<boolean>, onClose?: () => unknown, modal: boolean }> = (props) => {
  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => {
      if (typeof props.setOpen === "undefined") {
        if (!open) props.onClose?.()
      }
      else {
        props.setOpen?.(open)
      }
    }} modal={props.modal}>
      <Dialog.Portal>
        <Dialog.Overlay class="animate-fade-out ui-expanded:animate-fade-in animate-duration-150 ui-expanded:animate-duration-150 fixed inset-0 z-50 bg-[rgba(21,21,21,.6)] laptop-sm:backdrop-blur-md" />

        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto">
          <Dialog.Content class="animate-scale-out ui-expanded:animate-scale-in animate-duration-200 ui-expanded:animate-duration-200 bg-[rgb(32,32,32)] rounded-lg max-w-[450px] w-full my-auto">
            <div class="relative flex item justify-between items-center mb-2 border-b border-b-[rgb(90,90,90)] p-4 text-[rgb(220,220,220)]">
              <Dialog.Title class="text-[20px] font-medium">
                {props.title}
              </Dialog.Title>
              <Dialog.CloseButton class="flex items-center justify-center p-1" onClick={() => props.onClose?.()}>
                <MdiClose class="text-lg" />
              </Dialog.CloseButton>
            </div>

            {props.children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
