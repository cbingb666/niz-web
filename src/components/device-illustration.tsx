import { useI18n } from '@/i18n/use-i18n';
import keyboard from '@/assets/keyboard-concept.webp';
import connection from '@/assets/keyboard-connection-guide.webp';

export function DeviceIllustration({ variant, animated = false }: { variant: 'keyboard' | 'connection'; animated?: boolean }) {
  const { t } = useI18n();
  return <img className={`device-illustration${animated ? ' device-illustration-animated' : ''}`}
    src={variant === 'keyboard' ? keyboard : connection}
    width={1200} height={variant === 'keyboard' ? 800 : 900}
    alt={t(variant === 'keyboard' ? 'devices.keyboardIllustration' : 'guide.connectionIllustration')}
    draggable={false} />;
}
