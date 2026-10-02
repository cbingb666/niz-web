import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { defaultModel, supportedModels } from '@/devices';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { DeviceIllustration } from './device-illustration';
import { Button } from './ui/button';
import { Label } from './ui/label';

export function DemoPicker() {
  const { t } = useI18n();
  const currentModel = useAppStore(state => state.model);
  const selectedModelId = useAppStore(state => state.demoModelId);
  const returnPage = useAppStore(state => state.demoReturnPage);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const selected = supportedModels.find(model => model.id === selectedModelId)
    ?? supportedModels.find(model => model.id === currentModel.id) ?? defaultModel;
  return <section className="device-page demo-picker" aria-labelledby="page-title">
    <Button className="page-back" variant="ghost" disabled={locked} onClick={() => actions.navigate(returnPage)}>
      <ArrowLeft />{t(returnPage === 'connect' ? 'demo.backToConnection' : 'devices.back')}
    </Button>
    <h2 id="page-title" tabIndex={-1}>{t('demo.title')}</h2>
    <div className="demo-models" role="radiogroup" aria-label={t('keyboard.demoModel')}>
      {supportedModels.map(model => <Label key={model.id} className="demo-model-card" data-selected={selected.id === model.id}>
        <div className="demo-model-art"><DeviceIllustration model={model} /></div>
        <div className="demo-model-details">
          <input type="radio" className="demo-model-radio" name="demo-keyboard" value={model.id}
            checked={selected.id === model.id} disabled={locked}
            aria-labelledby={`demo-name-${model.id}`} aria-describedby={`demo-specification-${model.id}`}
            onChange={() => actions.setDemoModel(model.id)} />
          <div>
            <strong id={`demo-name-${model.id}`}>{model.name}</strong>
            <p id={`demo-specification-${model.id}`}>{t('keyboard.dimensions', { keys: model.keyCount, layers: model.layers.length })}</p>
          </div>
        </div>
      </Label>)}
    </div>
    <div className="demo-picker-actions">
      <Button disabled={locked} onClick={() => actions.demo(selected.id)}><Play />{t('demo.start')}<ArrowRight /></Button>
    </div>
  </section>;
}
