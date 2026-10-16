import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="py-24 text-center">
      <p className="num text-6xl text-rule-2">404</p>
      <p className="mt-4 font-display text-2xl">{t('errors.notFound')}</p>
      <Link to="/" className="mt-6 inline-block text-sm text-ledger underline underline-offset-4">
        {t('errors.backHome')}
      </Link>
    </div>
  )
}
