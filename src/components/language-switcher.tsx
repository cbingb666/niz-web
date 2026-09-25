import { Languages } from 'lucide-react';
import { isLocale, localeNames, locales } from '@/i18n/core';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function LanguageSwitcher() {
  const { t, locale } = useI18n();
  const setLocale = useAppStore((state) => state.actions.setLocale);
  return (
    <Select
      value={locale}
      onValueChange={(value) => {
        if (isLocale(value)) setLocale(value);
      }}
    >
      <SelectTrigger className="language-select" aria-label={t('language.label')}>
        <Languages className="size-4 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((value) => (
          <SelectItem key={value} value={value}>
            <span lang={value}>{localeNames[value]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
