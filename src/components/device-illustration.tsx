import { useI18n } from '@/i18n/use-i18n';
import { Keyboard } from 'lucide-react';
import { defaultModel, type KeyboardModel } from '@/devices';
import keyboard from '@/assets/atom66-product-retouched.webp';
import atom68Keyboard from '@/assets/atom68-product-retouched.webp';
import micro82Keyboard from '@/assets/micro82-product-retouched.webp';
import micro84Keyboard from '@/assets/micro84-product-retouched.webp';

export function DeviceIllustration({ model = defaultModel }: { model?: KeyboardModel }) {
  const { t } = useI18n();
  if (model.id === 'micro82') return <img className="device-illustration" src={micro82Keyboard}
    width={1942} height={809}
    alt={t('devices.micro82Illustration')}
    draggable={false} />;
  if (model.id === 'micro84') return <img className="device-illustration" src={micro84Keyboard}
    width={1938} height={811}
    alt={t('devices.micro84Illustration')}
    draggable={false} />;
  if (model.id === 'atom68') return <img className="device-illustration" src={atom68Keyboard}
    width={2151} height={731}
    alt={t('devices.atom68Illustration')}
    draggable={false} />;
  if (model.id !== 'atom66') return <Keyboard className="device-illustration device-illustration-symbol"
    role="img" aria-label={t('devices.modelIllustration', { model: model.name })} strokeWidth={.8} />;
  return <img className="device-illustration" src={keyboard}
    width={2014} height={780}
    alt={t('devices.keyboardIllustration')}
    draggable={false} />;
}
