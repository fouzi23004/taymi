import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import {
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  cloneElement,
} from 'react'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: string
  className?: string
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId()
  const describedBy = error || hint ? `${id}-desc` : undefined
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-[13px] font-medium text-ink-2">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">({optional})</span>}
      </label>
      {cloneElement(children, { id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {(error || hint) && (
        <p id={describedBy} className={clsx('text-xs', error ? 'text-stamp' : 'text-ink-3')}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input min-h-20 resize-y', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select className="input appearance-none pr-9" {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" />
    </div>
  )
}
