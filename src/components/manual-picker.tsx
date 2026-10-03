import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { keyboardManuals } from '@/lib/manuals';
import { localeNames } from '@/i18n/core';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function ManualPicker() {
  const { t } = useI18n();
  const currentModel = useAppStore(state => state.model.id);
  const [modelId, setModelId] = useState(() => keyboardManuals.find(model => model.modelId === currentModel)?.modelId ?? keyboardManuals[0].modelId);

  return <>
    <DialogHeader>
      <DialogTitle>{t('manual.title')}</DialogTitle>
      <DialogDescription>{t('manual.description')}</DialogDescription>
    </DialogHeader>
    <Tabs value={modelId} onValueChange={setModelId}>
      <TabsList className="manual-models" aria-label={t('manual.chooseModel')}>
        {keyboardManuals.map(model => <TabsTrigger key={model.modelId} value={model.modelId}>{model.name}</TabsTrigger>)}
      </TabsList>
      {keyboardManuals.map(model => <TabsContent key={model.modelId} value={model.modelId} className="manual-variants">
        {model.variants.map(variant => <section className="manual-variant" key={variant.id}>
          <h3>{t(`manual.${variant.kind}`)} <span>{variant.id}</span></h3>
          <div className="manual-files">
            {variant.files.map(file => {
              const pdf = file.format === 'pdf';
              const path = file.path.split('/').map(encodeURIComponent).join('/');
              const href = `https://github.com/cbingb666/niz-web/${pdf ? 'blob/main' : 'raw/refs/heads/main'}/${path}`;
              return <Button asChild variant="link" key={file.path} className="manual-file">
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {pdf ? <ExternalLink aria-hidden="true" /> : <Download aria-hidden="true" />}
                  <span>{t(pdf ? 'manual.pdf' : 'manual.word', { language: localeNames[file.language] })}</span>
                  <span className="sr-only">{t('manual.newTab')}</span>
                </a>
              </Button>;
            })}
          </div>
        </section>)}
      </TabsContent>)}
    </Tabs>
    <p className="field-hint">{t('manual.versionNote')}</p>
  </>;
}
