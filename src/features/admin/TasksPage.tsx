import { clsx } from 'clsx'
import { ClipboardList, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { indexById, useCategories, useDeleteTask, useSaveTask, useTasks } from '@/api/reference'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { errorKey } from '@/lib/errors'
import type { Category, Task } from '@/lib/types'
import { RowActions, Toolbar } from './ClientsPage'

export function TasksPage() {
  const { t } = useTranslation()
  const tasks = useTasks()
  const categories = useCategories()
  const save = useSaveTask()
  const del = useDeleteTask()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const categoryById = useMemo(() => indexById(categories.data), [categories.data])

  const q = query.trim().toLowerCase()
  const list = (tasks.data ?? []).filter(
    (x) =>
      (showArchived || x.active) &&
      (!q || [x.name, x.description, categoryById.get(x.category_id)?.name].some((v) => v && v.toLowerCase().includes(q))),
  )

  async function toggleActive(x: Task) {
    try {
      await save.mutateAsync({ id: x.id, name: x.name, category_id: x.category_id, active: !x.active })
      toast.success(t('tasks.updated'))
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      toast.success(t('tasks.deleted'))
    } catch (err) {
      const key = errorKey(err)
      toast.error(t(key === 'errors.inUse' ? 'tasks.inUse' : key))
    }
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionSetup')}
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('tasks.add')}
          </Button>
        }
      />

      <Toolbar query={query} setQuery={setQuery} showArchived={showArchived} setShowArchived={setShowArchived} />

      <section className="sheet overflow-hidden animate-rise" style={{ animationDelay: '80ms' }}>
        {tasks.isPending ? (
          <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title={t('tasks.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ledger">
              <thead>
                <tr>
                  <th>{t('tasks.name')}</th>
                  <th>{t('tasks.category')}</th>
                  <th>{t('team.status')}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className={clsx(!x.active && 'opacity-60')}>
                    <td>
                      <p className="font-medium">{x.name}</p>
                      {x.description && <p className="text-xs text-ink-3">{x.description}</p>}
                    </td>
                    <td>
                      <Badge tone="brass">{categoryById.get(x.category_id)?.name ?? t('common.unknown')}</Badge>
                    </td>
                    <td>{x.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}</td>
                    <td>
                      <RowActions active={x.active} onEdit={() => setEditing(x)} onToggle={() => toggleActive(x)} onDelete={() => setDeleting(x)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== 'new' ? t('tasks.edit') : t('tasks.add')}>
        {editing !== null && (
          <TaskForm
            key={editing === 'new' ? 'new' : editing.id}
            task={editing === 'new' ? null : editing}
            categories={(categories.data ?? []).filter((c) => c.active || (editing !== 'new' && c.id === editing.category_id))}
            onDone={() => setEditing(null)}
          />
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

function TaskForm({ task, categories, onDone }: { task: Task | null; categories: Category[]; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveTask()
  const [name, setName] = useState(task?.name ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [categoryId, setCategoryId] = useState(task?.category_id ?? (categories.length === 1 ? categories[0].id : ''))
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!name.trim() || !categoryId) return
    try {
      await save.mutateAsync({ id: task?.id, name, description, category_id: categoryId })
      toast.success(task ? t('tasks.updated') : t('tasks.created'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t('tasks.name')} error={submitted && !name.trim() ? t('errors.required') : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={200} />
      </Field>
      <Field
        label={t('tasks.category')}
        hint={categories.length === 0 ? t('tasks.noCategoriesYet') : undefined}
        error={submitted && !categoryId ? t('errors.required') : null}
      >
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t('tasks.chooseCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('tasks.description')} optional={t('common.optional')}>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  )
}
