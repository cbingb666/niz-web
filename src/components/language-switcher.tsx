import { Languages } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { isLocale, localeNames, locales } from '@/i18n/core';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem } from './ui/select';

export function LanguageSwitcher() {
  const { t, locale } = useI18n();
  const setLocale = useAppStore((state) => state.actions.setLocale);
  const operating = useAppStore((state) => state.hardwareOperation !== null);
  return (
    <Select
      value={locale}
      disabled={operating}
      onValueChange={(value) => {
        if (isLocale(value)) setLocale(value);
      }}
    >
      <SelectPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground"
          aria-label={t('language.label')} title={`${t('language.label')}: ${localeNames[locale]}`}>
          <Languages aria-hidden="true" />
        </Button>
      </SelectPrimitive.Trigger>
      <SelectContent align="end">
        {locales.map((value) => (
          <SelectItem key={value} value={value}>
            <span lang={value}>{localeNames[value]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
