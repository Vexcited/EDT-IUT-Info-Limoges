import { TextField } from "@kobalte/core";
import { DateTime } from "luxon";
import { type Component, createSignal, Show, createMemo } from "solid-js";
import { Modal } from "~/components/modals";
import { getPersonalNotesForID, setPersonalNotesForID } from "~/stores/notes";
import { ITimetableLesson } from "~/types/api";
import { getLessonDescription, getLessonContentType, getFullLessonContentType, makeLessonUniqueID } from "~/utils/lessons";

import MdiClock from '~icons/mdi/clock'
import MdiInformation from '~icons/mdi/information'
import MdiTextBoxEdit from '~icons/mdi/text-box-edit'

const [lessonModalData, setLessonModalData] = createSignal<ITimetableLesson | null>(null);
export { setLessonModalData };

const Field: Component<{ title: string, value: string }> = (props) => (
  <div class="flex items-center gap-4 justify-between py-3 px-5">
    <p class="text-[rgb(210,210,210)]">
      {props.title}
    </p>
    <p class="text-[rgb(230,230,230)] truncate">
      {props.value}
    </p>
  </div>
);

const LessonModal: Component = () => {
  const startDate = createMemo(() => DateTime.fromISO(lessonModalData()?.start_date ?? "").setLocale("fr-FR"));
  const endDate = createMemo(() => DateTime.fromISO(lessonModalData()?.end_date ?? "").setLocale("fr-FR"));
  const lessonID = createMemo(() => lessonModalData() ? makeLessonUniqueID(lessonModalData()!) : null);

  return (
    <Modal
      open={lessonModalData() !== null}
      onClose={() => setLessonModalData(null)}
      modal={true}
      title="Cours"
    >
      <Show when={lessonModalData()}
        fallback={
          <div>
            <p>Fermeture en cours...</p>
          </div>
        }
      >
        {lesson => (
          <>
            <div class="p-4 pt-2 flex flex-col gap-6">
              <section>
                <div class="flex gap-2 items-center mb-2">
                  <MdiInformation class="text-lg text-red" />
                  <h2 class="text-[rgb(240,240,240)] text-xl">
                    Informations
                  </h2>
                </div>

                <div class="flex flex-col divide-y divide-[rgb(69,69,69)] bg-[rgb(38,38,38)] rounded-lg">
                  <Field
                    title="Description"
                    value={getLessonDescription(lesson())}
                  />
                  <Field
                    title="Type de cours"
                    value={getFullLessonContentType(lesson())}
                  />
                  <Field
                    title="Ressource"
                    value={getLessonContentType(lesson())}
                  />
                  <Field
                    title="Enseignant(e)"
                    value={lesson().content.teacher}
                  />
                  <Field
                    title="Salle"
                    value={lesson().content.room}
                  />
                </div>
              </section>
              <section>
                <div class="flex gap-2 items-center mb-2">
                  <MdiClock class="text-lg text-red" />
                  <h2 class="text-[rgb(240,240,240)] text-xl">
                    Horaires
                  </h2>
                </div>

                <div class="flex flex-col divide-y divide-[rgb(69,69,69)] bg-[rgb(38,38,38)] rounded-lg">
                  <Field
                    title="Heure de début"
                    value={startDate().toLocaleString(DateTime.TIME_24_SIMPLE)}
                  />
                  <Field
                    title="Heure de fin"
                    value={endDate().toLocaleString(DateTime.TIME_24_SIMPLE)}
                  />
                  <Field
                    title="Durée (temps)"
                    value={endDate().diff(startDate(), ["hours", "minutes"]).toFormat("h'h'mm")}
                  />
                  <Field
                    title="Durée (en % de la journée)"
                    value={Math.round(endDate().diff(startDate(), "minutes").minutes / 1440 * 100) + "%"}
                  />
                </div>
              </section>
              <section>
                <TextField.Root class="flex flex-col gap-2">
                  <div class="flex gap-2 items-center">
                    <MdiTextBoxEdit class="text-lg text-red" />
                    <h2 class="text-[rgb(240,240,240)] text-xl">
                      Notes personnelles
                    </h2>
                  </div>
                  <TextField.TextArea
                    class="inline-flex w-full rounded-lg px-5 py-3 bg-[rgb(38,38,38)] text-[rgb(210,210,210)] outline-none focus:outline-red"
                    value={getPersonalNotesForID(lessonID()!)}
                    onInput={e => setPersonalNotesForID(lessonID()!, e.currentTarget.value)}
                    autoResize
                  />
                  <TextField.Description class="text-[rgb(120,120,120)] text-xs">
                    Les notes sont sauvegardées localement et ne sont pas synchronisées.
                    Si vous supprimez vos données de navigation, les notes personnelles seront supprimées.
                  </TextField.Description>
                </TextField.Root>

              </section>
            </div>
          </>
        )}
      </Show>
    </Modal>
  );
};

export default LessonModal;
