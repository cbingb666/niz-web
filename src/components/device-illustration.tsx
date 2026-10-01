import { useI18n } from '@/i18n/use-i18n';
import { Keyboard } from 'lucide-react';
import { defaultModel, type KeyboardModel } from '@/devices';
import keyboard from '@/assets/atom66-product-retouched.webp';
import atom68Keyboard from '@/assets/atom68-product.jpg';

export function DeviceIllustration({ model = defaultModel }: { model?: KeyboardModel }) {
  const { t } = useI18n();
  if (model.id === 'atom68') return <img className="device-illustration device-illustration-atom68" src={atom68Keyboard}
    width={1600} height={1600}
    alt={t('devices.atom68Illustration')}
    draggable={false} />;
  if (model.id !== 'atom66') return <Keyboard className="device-illustration device-illustration-symbol"
    role="img" aria-label={t('devices.modelIllustration', { model: model.name })} strokeWidth={.8} />;
  return <img className="device-illustration" src={keyboard}
    width={2014} height={780}
    alt={t('devices.keyboardIllustration')}
    draggable={false} />;
}
