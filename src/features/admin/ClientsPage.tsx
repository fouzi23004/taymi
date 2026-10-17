import { clsx } from 'clsx'
import { Archive, ArchiveRestore, Briefcase, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { categoriesByClient, indexById, useCategories, useClientCategories, useClients, useDeleteClient, useSaveClient } from '@/api/reference'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { errorKey } from '@/lib/errors'
import type { Category, Client } from '@/lib/types'

export function ClientsPage() {
  const { t } = useTranslation()
  const clients = useClients()
  const categories = useCategories()
  const clientCategories = useClientCategories()
  const save = useSaveClient()
  const del = useDeleteClient()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const categoryById = useMemo(() => indexById(categories.data), [categories.data])
  const byClient = useMemo(() => categoriesByClient(clientCategories.data), [clientCategories.data])

  const q = query.trim().toLowerCase()
  const list = (clients.data ?? []).filter(
    (c) =>
      (showArchived || c.active) &&
      (!q || [c.name, c.reference, c.contact_name, c.contact_email].some((v) => v?.toLowerCase().includes(q))),
  )

  async function toggleActive(c: Client) {
    try {
      await save.mutateAsync({ id: c.id, name: c.name, active: !c.active })
      toast.success(t('clients.updated'))
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      toast.success(t('clients.deleted'))
    } catch (err) {
      const key = errorKey(err)
      toast.error(t(key === 'errors.inUse' ? 'clients.inUse' : key))
    }
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionSetup')}
        title={t('clients.title')}
        subtitle={t('clients.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('clients.add')}
          </Button>
        }
      />

      <Toolbar query={query} setQuery={setQuery} showArchived={showArchived} setShowArchived={setShowArchived} />

      <section className="sheet overflow-hidden animate-rise" style={{ animationDelay: '80ms' }}>
        {clients.isPending ? (
          <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={<Briefcase className="size-5" />} title={t('clients.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ledger">
              <thead>
                <tr>
                  <th>{t('clients.name')}</th>
                  <th>{t('clients.reference')}</th>
                  <th>{t('clients.categories')}</th>
                  <th>{t('clients.contactName')}</th>
                  <th>{t('team.status')}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className={clsx(!c.active && 'opacity-60')}>
                    <td>
                      <p className="font-medium">{c.name}</p>
                    </td>
                    <td className="num text-xs text-ink-2">{c.reference ?? '—'}</td>
                    <td>
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {[...(byClient.get(c.id) ?? [])]
                          .map((id) => categoryById.get(id))
                          .filter((x): x is Category => Boolean(x))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((cat) => (
                            <Badge key={cat.id} tone="brass">{cat.name}</Badge>
                          ))}
                        {!byClient.get(c.id)?.size && <span className="text-xs text-stamp">{t('clients.noCategories')}</span>}
                      </div>
                    </td>
                    <td className="text-sm">
                      <p>{c.contact_name ?? '—'}</p>
                      {c.contact_email && <p className="text-xs text-ink-3">{c.contact_email}</p>}
                    </td>
                    <td>{c.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}</td>
                    <td>
                      <RowActions
                        active={c.active}
                        onEdit={() => setEditing(c)}
                        onToggle={() => toggleActive(c)}
                        onDelete={() => setDeleting(c)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ClientModal
        client={editing}
        categories={categories.data ?? []}
        assigned={editing && editing !== 'new' ? byClient.get(editing.id) : undefined}
        onClose={() => setEditing(null)}
      />
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

export function Toolbar({
  query,
  setQuery,
  showArchived,
  setShowArchived,
}: {
  query: string
  setQuery: (v: string) => void
  showArchived: boolean
  setShowArchived: (v: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 animate-rise" style={{ animationDelay: '40ms' }}>
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <Input className="pl-9" placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('common.search')} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2 select-none">
        <input type="checkbox" className="size-4 accent-ledger" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        {t('common.showArchived')}
      </label>
    </div>
  )
}

export function RowActions({
  active,
  onEdit,
  onToggle,
  onDelete,
}: {
  active: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end gap-0.5">
      <IconButton label={t('common.edit')} icon={<Pencil className="size-3.5" />} onClick={onEdit} />
      <IconButton
        label={active ? t('common.archive') : t('common.restore')}
        icon={active ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
        onClick={onToggle}
      />
      {onDelete && (
        <IconButton label={t('common.delete')} icon={<Trash2 className="size-3.5" />} onClick={onDelete} className="hover:bg-stamp-soft hover:text-stamp" />
      )}
    </div>
  )
}

function ClientModal({
  client,
  categories,
  assigned,
  onClose,
}: {
  client: Client | 'new' | null
  categories: Category[]
  assigned: Set<string> | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const existing = client && client !== 'new' ? client : null
  return (
    <Modal open={client !== null} onClose={onClose} title={existing ? t('clients.edit') : t('clients.add')}>
      {client !== null && (
        <ClientForm key={existing?.id ?? 'new'} client={existing} categories={categories} assigned={assigned} onDone={onClose} />
      )}
    </Modal>
  )
}

function ClientForm({
  client,
  categories,
  assigned,
  onDone,
}: {
  client: Client | null
  categories: Category[]
  assigned: Set<string> | undefined
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveClient()
  const [categoryIds, setCategoryIds] = useState<string[]>(() => [...(assigned ?? [])])
  // Archived categories stay visible if the client still has them.
  const options = categories.filter((c) => c.active || categoryIds.includes(c.id))
  const toggle = (id: string) =>
    setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const [form, setForm] = useState({
    name: client?.name ?? '',
    reference: client?.reference ?? '',
    contact_name: client?.contact_name ?? '',
    contact_email: client?.contact_email ?? '',
    notes: client?.notes ?? '',
  })
  const [submitted, setSubmitted] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const nameError = submitted && !form.name.trim() ? t('errors.required') : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!form.name.trim()) return
    try {
      await save.mutateAsync({ id: client?.id, ...form, categoryIds })
      toast.success(client ? t('clients.updated') : t('clients.created'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label={t('clients.name')} error={nameError}>
          <Input value={form.name} onChange={set('name')} autoFocus maxLength={200} />
        </Field>
        <Field label={t('clients.reference')} optional={t('common.optional')}>
          <Input className="num" value={form.reference} onChange={set('reference')} maxLength={50} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('clients.contactName')} optional={t('common.optional')}>
          <Input value={form.contact_name} onChange={set('contact_name')} />
        </Field>
        <Field label={t('clients.contactEmail')} optional={t('common.optional')}>
          <Input type="email" value={form.contact_email} onChange={set('contact_email')} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-[13px] font-medium text-ink-2">{t('clients.categories')}</legend>
        <p className="mb-2 text-xs text-ink-3">{t('clients.categoriesHint')}</p>
        {options.length === 0 ? (
          <p className="rounded-lg bg-brass-soft p-3 text-sm text-[#7a5410]">{t('clients.noCategoriesYet')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((c) => (
              <label
                key={c.id}
                className={clsx(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
                  categoryIds.includes(c.id) ? 'border-ledger bg-ledger-soft' : 'border-rule-2 hover:border-ink-3',
                )}
              >
                <input type="checkbox" className="size-4 accent-ledger" checked={categoryIds.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <Field label={t('clients.notes')} optional={t('common.optional')}>
        <Textarea rows={3} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  )
}
