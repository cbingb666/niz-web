import { useI18n } from '@/i18n/use-i18n';
import keyboard from '@/assets/atom66-product-retouched.webp';

export function DeviceIllustration() {
  const { t } = useI18n();
  return <img className="device-illustration" src={keyboard}
    width={2014} height={780}
    alt={t('devices.keyboardIllustration')}
    draggable={false} />;
}
