import { Play } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';

export function DemoLauncher() {
  const { t } = useI18n();
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  return <Button variant="ghost" className="demo-launch" disabled={locked} onClick={() => actions.navigate('demo')}>
    <Play />{t('keyboard.demo')}
  </Button>;
}
