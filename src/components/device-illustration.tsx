import { useI18n } from '@/i18n/use-i18n';
import keyboard from '@/assets/keyboard-concept.webp';

export function DeviceIllustration() {
  const { t } = useI18n();
  return <img className="device-illustration" src={keyboard}
    width={1200} height={800}
    alt={t('devices.keyboardIllustration')}
    draggable={false} />;
}
