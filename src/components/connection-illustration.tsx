import { CheckCircle2, Globe2, Keyboard, Laptop, RotateCcw, Unplug } from 'lucide-react';
import { defaultModel, type KeyboardModel } from '@/devices';
import { useI18n } from '@/i18n/use-i18n';
import { DeviceIllustration } from './device-illustration';

/** Static instructions; only the final result reflects the actual connection. */
export function ConnectionIllustration({ step, connected, model }: { step: 'support' | 'cable' | 'permission' | 'complete'; connected: boolean; model?: KeyboardModel }) {
  const { t } = useI18n();
  if (step === 'support') return <figure className="support-preview" aria-label={t('guide.nameplateIllustration')}>
    <svg viewBox="0 0 440 320" fill="none" aria-hidden="true">
      <text x={220} y={30} textAnchor="middle" className="nameplate-caption">{t('guide.keyboardBack')}</text>
      <RotateCcw x={358} y={10} width={28} height={28} strokeWidth={1.5} className="nameplate-turn" />
      <rect x={40} y={54} width={360} height={142} rx={15} className="nameplate-body" />
      <g className="nameplate-feet">
        <rect x={62} y={73} width={40} height={9} rx={4.5} />
        <rect x={338} y={73} width={40} height={9} rx={4.5} />
        <rect x={62} y={168} width={40} height={9} rx={4.5} />
        <rect x={338} y={168} width={40} height={9} rx={4.5} />
      </g>
      <rect x={165} y={104} width={110} height={45} rx={4} className="nameplate-label" />
      <text x={220} y={121} textAnchor="middle" className="nameplate-field">MODEL</text>
      <text x={220} y={139} textAnchor="middle" className="nameplate-small-model">{defaultModel.name}</text>
      <path d="M176 150 140 224m124-74 36 74" className="nameplate-leaders" />
      <rect x={120} y={224} width={200} height={75} rx={10} className="nameplate-label" />
      <text x={220} y={246} textAnchor="middle" className="nameplate-caption">{t('connection.model')}</text>
      <text x={220} y={279} textAnchor="middle" className="nameplate-model">{defaultModel.name}</text>
    </svg>
    <figcaption>{t('guide.nameplateCaption')}</figcaption>
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
    </svg>
    <figcaption>{t('guide.connectionLabel')}</figcaption>
  </figure>;
  if (step === 'permission') return <figure className="permission-demo" aria-label={t('guide.pickerIllustration')}>
    <div className="permission-window" aria-hidden="true">
      <div className="permission-window-header"><Globe2 /><span>{t('guide.pickerWindow')}</span><span className="window-dots">•••</span></div>
      <div className="permission-window-content">
        <strong>{t('guide.pickerTitle')}</strong>
        <div className="permission-device-row"><span className="diagram-step-number">1</span><span className="permission-radio" /><Keyboard /><span>{defaultModel.name}</span></div>
        <div className="permission-window-actions"><span>{t('common.cancel')}</span><span className="diagram-step-number">2</span><span className="permission-confirm">{t('guide.pickerConnect')}</span></div>
      </div>
    </div>
    <figcaption>{t('guide.pickerCaption')}</figcaption>
  </figure>;
  return <div className="connection-result-art" data-connected={connected}>
    <DeviceIllustration model={model} />
    <span className="connection-result-mark" aria-hidden="true">{connected ? <CheckCircle2 /> : <Unplug />}</span>
  </div>;
}
