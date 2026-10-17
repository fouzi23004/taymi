import { clsx } from 'clsx'
import { CalendarRange, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useDeleteExercise, useExercises, useSaveExercise } from '@/api/reference'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { errorKey } from '@/lib/errors'
import type { Exercise } from '@/lib/types'
import { RowActions, Toolbar } from './ClientsPage'

export function ExercisesPage() {
  const { t } = useTranslation()
  const exercises = useExercises()
  const save = useSaveExercise()
  const del = useDeleteExercise()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Exercise | null>(null)

  const q = query.trim().toLowerCase()
  const list = (exercises.data ?? []).filter((x) => (showArchived || x.active) && (!q || x.name.toLowerCase().includes(q)))

  async function toggleActive(x: Exercise) {
    try {
      await save.mutateAsync({ id: x.id, name: x.name, active: !x.active })
      toast.success(t('exercises.updated'))
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      toast.success(t('exercises.deleted'))
    } catch (err) {
      const key = errorKey(err)
      toast.error(t(key === 'errors.inUse' ? 'exercises.inUse' : key))
    }
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionSetup')}
        title={t('exercises.title')}
        subtitle={t('exercises.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('exercises.add')}
          </Button>
        }
      />

      <Toolbar query={query} setQuery={setQuery} showArchived={showArchived} setShowArchived={setShowArchived} />

      <section className="sheet max-w-2xl overflow-hidden animate-rise" style={{ animationDelay: '80ms' }}>
        {exercises.isPending ? (
          <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={<CalendarRange className="size-5" />} title={t('exercises.empty')} />
        ) : (
          <table className="table-ledger">
            <thead>
              <tr>
                <th>{t('exercises.name')}</th>
                <th>{t('team.status')}</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className={clsx(!x.active && 'opacity-60')}>
                  <td className="num text-base font-medium">{x.name}</td>
                  <td>{x.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}</td>
                  <td>
                    <RowActions active={x.active} onEdit={() => setEditing(x)} onToggle={() => toggleActive(x)} onDelete={() => setDeleting(x)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== 'new' ? t('exercises.edit') : t('exercises.add')}
        width="max-w-sm"
      >
        {editing !== null && (
          <ExerciseForm key={editing === 'new' ? 'new' : editing.id} exercise={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
      <ConfirmModal
        open={Boolean(deleting)}
        message={<><strong className="text-ink">{deleting?.name}</strong> — {t('common.confirmDelete')}</>}
        loading={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function ExerciseForm({ exercise, onDone }: { exercise: Exercise | null; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveExercise()
  const [name, setName] = useState(exercise?.name ?? String(new Date().getFullYear()))
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!name.trim()) return
    try {
      await save.mutateAsync({ id: exercise?.id, name })
      toast.success(exercise ? t('exercises.updated') : t('exercises.created'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t('exercises.name')} hint={t('exercises.nameHint')} error={submitted && !name.trim() ? t('errors.required') : null}>
        <Input className="num" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={50} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  )
}
