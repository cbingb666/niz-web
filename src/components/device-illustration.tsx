import { useI18n } from '@/i18n/use-i18n';
import keyboard from '@/assets/atom66-product.webp';

export function DeviceIllustration() {
  const { t } = useI18n();
  return <img className="device-illustration" src={keyboard}
    width={3000} height={1159}
    alt={t('devices.keyboardIllustration')}
    draggable={false} />;
}
