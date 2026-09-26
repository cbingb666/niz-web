import { CheckCircle2, Globe2, Keyboard, Laptop, MousePointer2, Plug2, Unplug } from 'lucide-react';
import { defaultModel } from '@/devices';
import { useI18n } from '@/i18n/use-i18n';
import { DeviceIllustration } from './device-illustration';

/** Instructional diagrams: the animation explains an action, never device status. */
export function ConnectionIllustration({ step, connected }: { step: 0 | 1 | 2; connected: boolean }) {
  const { t } = useI18n();
  if (step === 0) return <figure className="cable-demo" aria-label={t('guide.cableIllustration')}>
    <svg viewBox="0 0 440 320" fill="none" aria-hidden="true">
      <Laptop x={124} y={4} width={192} height={128} strokeWidth={.75} className="diagram-computer" />
      <path d="M220 132v16m0 42v20" className="diagram-wire" />
      <g className="diagram-plug"><Plug2 x={204} y={151} width={32} height={40} strokeWidth={1.6} /></g>
      <Keyboard x={104} y={200} width={232} height={108} strokeWidth={.8} className="diagram-keyboard" />
      <circle cx={220} cy={139} r={10} className="diagram-contact" />
    </svg>
    <figcaption>{t('guide.connectionLabel')}</figcaption>
  </figure>;
  if (step === 1) return <figure className="permission-demo" aria-label={t('guide.pickerIllustration')}>
    <div className="permission-window" aria-hidden="true">
      <div className="permission-window-header"><Globe2 /><span>{t('guide.pickerWindow')}</span><span className="window-dots">•••</span></div>
      <div className="permission-window-content">
        <strong>{t('guide.pickerTitle')}</strong>
        <div className="permission-device-row"><span className="permission-radio" /><Keyboard /><span>{defaultModel.name}</span></div>
        <div className="permission-window-actions"><span>{t('common.cancel')}</span><span className="permission-confirm">{t('guide.pickerConnect')}</span></div>
      </div>
      <MousePointer2 className="permission-pointer" />
    </div>
    <figcaption>{t('guide.pickerCaption')}</figcaption>
  </figure>;
  return <div className="connection-result-art" data-connected={connected}>
    <DeviceIllustration />
    <span className="connection-result-mark" aria-hidden="true">{connected ? <CheckCircle2 /> : <Unplug />}</span>
  </div>;
}
