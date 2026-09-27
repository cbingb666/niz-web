import { CheckCircle2, Globe2, Keyboard, Laptop, MousePointer2, Unplug } from 'lucide-react';
import { defaultModel } from '@/devices';
import { useI18n } from '@/i18n/use-i18n';
import { DeviceIllustration } from './device-illustration';

/** Instructional diagrams: the animation explains an action, never device status. */
export function ConnectionIllustration({ step, connected }: { step: 'support' | 'cable' | 'permission' | 'complete'; connected: boolean }) {
  const { t } = useI18n();
  if (step === 'support') return <figure className="support-preview">
    <DeviceIllustration />
    <figcaption>{defaultModel.name}</figcaption>
  </figure>;
  if (step === 'cable') return <figure className="cable-demo" aria-label={t('guide.cableIllustration')}>
    <svg viewBox="0 0 440 320" fill="none" aria-hidden="true">
      <Laptop x={124} y={4} width={192} height={128} strokeWidth={.75} className="diagram-computer" />
      <path d="M220 185v25" className="diagram-wire" />
      <rect x={210} y={127} width={20} height={8} rx={2} className="diagram-usb-port" />
      <g className="diagram-plug" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round">
        <rect x={212} y={132} width={16} height={19} rx={1} />
        <path d="M216 137v4m8-4v4" />
        <rect x={207} y={151} width={26} height={22} rx={4} fill="var(--background)" />
        <path d="M215 158h10m-10 5h10M220 173v12" />
      </g>
      <Keyboard x={104} y={200} width={232} height={108} strokeWidth={.8} className="diagram-keyboard" />
      <circle cx={220} cy={139} r={10} className="diagram-contact" />
    </svg>
    <figcaption>{t('guide.connectionLabel')}</figcaption>
  </figure>;
  if (step === 'permission') return <figure className="permission-demo" aria-label={t('guide.pickerIllustration')}>
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
