import { useEffect, useLayoutEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { applyTheme, browserTheme, isTheme, saveTheme, themes } from '@/lib/theme';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem } from './ui/select';

const icons = { light: Sun, dark: Moon, system: Monitor };

export function ThemeSwitcher() {
  const { t } = useI18n();
  const operating = useAppStore(state => state.hardwareOperation !== null);
  const [theme, setTheme] = useState(browserTheme);
  const Icon = icons[theme];
  useLayoutEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => applyTheme('system');
    media?.addEventListener('change', update);
    update();
    return () => media?.removeEventListener('change', update);
  }, [theme]);
  return <Select value={theme} disabled={operating} onValueChange={value => {
    if (!isTheme(value)) return;
    saveTheme(value);
    setTheme(value);
  }}>
    <SelectPrimitive.Trigger asChild>
      <Button variant="ghost" size="icon" className="text-muted-foreground"
        aria-label={t('theme.label')} title={`${t('theme.label')}: ${t(`theme.${theme}`)}`}>
        <Icon aria-hidden="true" />
      </Button>
    </SelectPrimitive.Trigger>
    <SelectContent align="end">
      {themes.map(value => {
        const OptionIcon = icons[value];
        return <SelectItem key={value} value={value}>
          <span className="flex items-center gap-2"><OptionIcon className="size-4" aria-hidden="true" />{t(`theme.${value}`)}</span>
        </SelectItem>;
      })}
    </SelectContent>
  </Select>;
}
