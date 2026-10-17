import { Plus, Save } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSaveEntry } from '@/api/entries'
import { tasksForClient } from '@/api/reference'
import { DurationInput } from '@/components/DurationInput'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import type { ISODate } from '@/lib/dates'
import { errorKey } from '@/lib/errors'
import type { Category, Client, Exercise, Task, TimeEntry } from '@/lib/types'

interface Props {
  date: ISODate
  clients: Client[]
  categories: Category[]
  /** client id → its category ids */
  clientCategories: Map<string, Set<string>>
  exercises: Exercise[]
  tasks: Task[]
  /** Entry being edited, or null for a new one. */
  entry: TimeEntry | null
  onDone: () => void
}

const LAST_EXERCISE = 'tl.lastExercise'
const readLastExercise = () => {
  try {
    return localStorage.getItem(LAST_EXERCISE)
  } catch {
    return null
  }
}

/** Remount with a `key` to reset between entries. */
export function EntryForm({ date, clients, categories, clientCategories, exercises, tasks, entry, onDone }: Props) {
  const { t } = useTranslation()
  const save = useSaveEntry()

  // Archived items stay selectable when editing an old entry that uses them.
  const clientOptions = useMemo(() => clients.filter((c) => c.active || c.id === entry?.client_id), [clients, entry?.client_id])
  const exerciseOptions = useMemo(
    () => exercises.filter((x) => x.active || x.id === entry?.exercise_id),
    [exercises, entry?.exercise_id],
  )

  const [clientId, setClientId] = useState(entry?.client_id ?? '')
  // New entries start on the exercise used last time, else the most recent one.
  const [exerciseId, setExerciseId] = useState(() => {
    if (entry) return entry.exercise_id
    const last = readLastExercise()
    return exerciseOptions.find((x) => x.id === last)?.id ?? exerciseOptions[0]?.id ?? ''
  })
  const [taskId, setTaskId] = useState(entry?.task_id ?? '')
  const [minutes, setMinutes] = useState<number | null>(entry?.minutes ?? null)
  const [comment, setComment] = useState(entry?.comment ?? '')
  const [submitted, setSubmitted] = useState(false)

  const taskOptions = useMemo(() => {
    const list = tasksForClient(tasks, clientCategories.get(clientId))
    const current = tasks.find((x) => x.id === entry?.task_id)
    return current && clientId === entry?.client_id && !list.includes(current) ? [...list, current] : list
  }, [tasks, clientCategories, clientId, entry?.task_id, entry?.client_id])

  // Tasks grouped by category, categories in alphabetical order.
  const taskGroups = useMemo(() => {
    const byCategory = new Map<string, Task[]>()
    for (const x of taskOptions) byCategory.set(x.category_id, [...(byCategory.get(x.category_id) ?? []), x])
    return categories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({ category: c, tasks: byCategory.get(c.id)! }))
  }, [taskOptions, categories])

  const errors = {
    client: !clientId ? t('errors.required') : null,
    exercise: !exerciseId ? t('errors.required') : null,
    task: !taskId ? t('errors.required') : null,
    minutes:
      minutes === null || minutes === 0
        ? t('errors.required')
        : minutes < 0
          ? t('errors.invalidDuration')
          : minutes > 1440
            ? t('errors.durationTooLong')
            : null,
  }
  const invalid = Object.values(errors).some(Boolean)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (invalid) return
    try {
      await save.mutateAsync({
        id: entry?.id,
        client_id: clientId,
        exercise_id: exerciseId,
        task_id: taskId,
        work_date: date,
        minutes: minutes!,
        comment,
      })
      try {
        localStorage.setItem(LAST_EXERCISE, exerciseId)
      } catch {
        // remembering the exercise is only a convenience
      }
      toast.success(t('timesheet.saved'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  if (exerciseOptions.length === 0) {
    return <p className="rounded-lg bg-brass-soft p-4 text-sm text-[#7a5410]">{t('timesheet.noExercises')}</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px] lg:grid-cols-1 xl:grid-cols-[1fr_120px]">
        <Field label={t('timesheet.client')} error={submitted && errors.client}>
          <Select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              const stillValid = tasksForClient(tasks, clientCategories.get(e.target.value)).some((x) => x.id === taskId)
              if (!stillValid) setTaskId('')
            }}
          >
            <option value="">{t('timesheet.chooseClient')}</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference ? `${c.name} · ${c.reference}` : c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('timesheet.exercise')} error={submitted && errors.exercise}>
          <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="num">
            <option value="">{t('timesheet.chooseExercise')}</option>
            {exerciseOptions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label={t('timesheet.task')}
        error={submitted && errors.task}
        hint={clientId && taskOptions.length === 0 ? t('timesheet.noTasksForClient') : undefined}
      >
        <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!clientId || taskOptions.length === 0}>
          <option value="">{clientId ? t('timesheet.chooseTask') : t('timesheet.chooseClientFirst')}</option>
          {taskGroups.map((g) => (
            <optgroup key={g.category.id} label={g.category.name}>
              {g.tasks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <Field label={t('timesheet.duration')} hint={t('timesheet.durationHint')} error={submitted && errors.minutes}>
        <DurationInput value={minutes} onChange={setMinutes} />
      </Field>

      <Field label={t('timesheet.comment')} optional={t('common.optional')}>
        <Textarea
          rows={3}
          maxLength={2000}
          placeholder={t('timesheet.commentPlaceholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" loading={save.isPending} icon={entry ? <Save className="size-4" /> : <Plus className="size-4" />}>
          {entry ? t('timesheet.update') : t('timesheet.add')}
        </Button>
        {entry && (
          <Button variant="secondary" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
