import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}

/** Native <dialog>: focus trap, Esc and backdrop for free. */
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${width} rounded-2xl border border-rule bg-card p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-cover/40 backdrop:backdrop-blur-[2px] open:animate-rise`}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
            <h2 className="font-display text-xl font-medium">{title}</h2>
            <IconButton label={t('common.close')} icon={<X className="size-4" />} onClick={onClose} />
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-rule bg-paper/50 px-6 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmModal({
  open,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
  loading?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={confirmLabel ?? t('common.delete')}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="bg-stamp hover:bg-stamp/90" loading={loading} onClick={onConfirm}>
            {confirmLabel ?? t('common.delete')}
          </Button>
        </>
      }
    >
      <p className="text-ink-2">{message}</p>
    </Modal>
  )
}
