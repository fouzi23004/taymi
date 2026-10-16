import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ledger text-paper shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:bg-ledger-2 active:translate-y-px disabled:bg-ledger/50',
  secondary: 'border border-rule-2 bg-card text-ink hover:border-ink-3 hover:bg-white active:translate-y-px',
  ghost: 'text-ink-2 hover:bg-paper-2 hover:text-ink',
  danger: 'text-stamp hover:bg-stamp-soft',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition select-none disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ label, className, ...rest }: Omit<Props, 'children'> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      className={clsx('size-8 px-0', className)}
      {...rest}
    />
  )
}
