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
import type { Client, Task, TimeEntry } from '@/lib/types'

interface Props {
  date: ISODate
  clients: Client[]
  tasks: Task[]
  /** Entry being edited, or null for a new one. */
  entry: TimeEntry | null
  onDone: () => void
}

/** Remount with a `key` to reset between entries. */
export function EntryForm({ date, clients, tasks, entry, onDone }: Props) {
  const { t } = useTranslation()
  const save = useSaveEntry()
  const [clientId, setClientId] = useState(entry?.client_id ?? '')
  const [taskId, setTaskId] = useState(entry?.task_id ?? '')
  const [minutes, setMinutes] = useState<number | null>(entry?.minutes ?? null)
  const [comment, setComment] = useState(entry?.comment ?? '')
  const [submitted, setSubmitted] = useState(false)

  // Archived client/task stay selectable when editing an old entry that uses them.
  const clientOptions = useMemo(
    () => clients.filter((c) => c.active || c.id === entry?.client_id),
    [clients, entry?.client_id],
  )
  const taskOptions = useMemo(() => {
    const list = tasksForClient(tasks, clientId)
    const current = tasks.find((x) => x.id === entry?.task_id)
    const fitsClient = current && clientId && (current.client_id === null || current.client_id === clientId)
    return fitsClient && !list.includes(current) ? [...list, current] : list
  }, [tasks, clientId, entry?.task_id])

  const errors = {
    client: !clientId ? t('errors.required') : null,
    task: !taskId ? t('errors.required') : null,
    minutes:
      minutes === null
        ? t('errors.required')
        : minutes <= 0
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
        task_id: taskId,
        work_date: date,
        minutes: minutes!,
        comment,
      })
      toast.success(t('timesheet.saved'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t('timesheet.client')} error={submitted && errors.client}>
        <Select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value)
            const stillValid = tasksForClient(tasks, e.target.value).some((x) => x.id === taskId)
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

      <Field label={t('timesheet.task')} error={submitted && errors.task}>
        <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!clientId}>
          <option value="">{clientId ? t('timesheet.chooseTask') : t('timesheet.chooseClientFirst')}</option>
          {taskOptions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.client_id ? `${x.name} (${t('timesheet.clientSpecific')})` : x.name}
            </option>
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
