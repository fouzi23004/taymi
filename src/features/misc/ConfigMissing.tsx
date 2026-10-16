import { useTranslation } from 'react-i18next'

export function ConfigMissing() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="sheet max-w-md p-8">
        <p className="eyebrow mb-3 text-stamp">TimeLedger</p>
        <p className="font-display text-xl">{t('errors.config')}</p>
        <pre className="num mt-5 rounded-lg bg-paper-2 p-4 text-xs text-ink-2">
          cp .env.example .env{'\n'}npm run dev
        </pre>
      </div>
    </div>
  )
}
