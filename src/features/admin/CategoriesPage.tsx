import { clsx } from 'clsx'
import { Plus, Tags } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCategories, useClientCategories, useDeleteCategory, useSaveCategory, useTasks } from '@/api/reference'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { errorKey } from '@/lib/errors'
import type { Category } from '@/lib/types'
import { RowActions, Toolbar } from './ClientsPage'

export function CategoriesPage() {
  const { t } = useTranslation()
  const categories = useCategories()
  const tasks = useTasks()
  const clientCategories = useClientCategories()
  const save = useSaveCategory()
  const del = useDeleteCategory()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const counts = useMemo(() => {
    const tasksBy = new Map<string, number>()
    for (const x of tasks.data ?? []) tasksBy.set(x.category_id, (tasksBy.get(x.category_id) ?? 0) + 1)
    const clientsBy = new Map<string, number>()
    for (const cc of clientCategories.data ?? []) clientsBy.set(cc.category_id, (clientsBy.get(cc.category_id) ?? 0) + 1)
    return { tasksBy, clientsBy }
  }, [tasks.data, clientCategories.data])

  const q = query.trim().toLowerCase()
  const list = (categories.data ?? []).filter(
    (c) => (showArchived || c.active) && (!q || [c.name, c.description].some((v) => v?.toLowerCase().includes(q))),
  )

  async function toggleActive(c: Category) {
    try {
      await save.mutateAsync({ id: c.id, name: c.name, active: !c.active })
      toast.success(t('categories.updated'))
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      toast.success(t('categories.deleted'))
    } catch (err) {
      const key = errorKey(err)
      toast.error(t(key === 'errors.inUse' ? 'categories.inUse' : key))
    }
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionSetup')}
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('categories.add')}
          </Button>
        }
      />

      <Toolbar query={query} setQuery={setQuery} showArchived={showArchived} setShowArchived={setShowArchived} />

      <section className="sheet overflow-hidden animate-rise" style={{ animationDelay: '80ms' }}>
        {categories.isPending ? (
          <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={<Tags className="size-5" />} title={t('categories.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ledger">
              <thead>
                <tr>
                  <th>{t('categories.name')}</th>
                  <th className="text-right">{t('categories.tasks')}</th>
                  <th className="text-right">{t('categories.clients')}</th>
                  <th>{t('team.status')}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className={clsx(!c.active && 'opacity-60')}>
                    <td>
                      <p className="font-medium">{c.name}</p>
                      {c.description && <p className="text-xs text-ink-3">{c.description}</p>}
                    </td>
                    <td className="num text-right text-ink-2">{counts.tasksBy.get(c.id) ?? 0}</td>
                    <td className="num text-right text-ink-2">{counts.clientsBy.get(c.id) ?? 0}</td>
                    <td>{c.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}</td>
                    <td>
                      <RowActions active={c.active} onEdit={() => setEditing(c)} onToggle={() => toggleActive(c)} onDelete={() => setDeleting(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== 'new' ? t('categories.edit') : t('categories.add')}>
        {editing !== null && (
          <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
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

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveCategory()
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!name.trim()) return
    try {
      await save.mutateAsync({ id: category?.id, name, description })
      toast.success(category ? t('categories.updated') : t('categories.created'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t('categories.name')} error={submitted && !name.trim() ? t('errors.required') : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={200} />
      </Field>
      <Field label={t('categories.description')} optional={t('common.optional')}>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  )
}
