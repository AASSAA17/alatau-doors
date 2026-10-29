'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSessionState } from '@/store/session';
import { addToSelection } from '@/lib/selection-client';
import { formatPrice } from '@/lib/utils';
import { Feedback } from '@/features/workspace/shared';
import type { AdminProduct } from '@/types/workspace';
import type { Category } from '@/types/product';

export type FinderAnswers = {step:number; category:Category; quantity:number; budget:number|null};
export function DoorFinder({products, initial}: {products:AdminProduct[]; initial:FinderAnswers}) {
  const t = useTranslations('Finder');
  const w = useTranslations('Workspace');
  const router = useRouter();
  const [answers, setAnswers] = useState(initial);
  function go(step:number) {
    const query = new URLSearchParams({step:String(step), type:answers.category, quantity:String(answers.quantity), budget:answers.budget === null ? 'any' : String(answers.budget)});
    router.push(`/door-finder?${query}`);
  }
  const matches = products.filter(p => p.category === answers.category).map(p => ({...p, variants:p.variants.filter(v => v.active && v.stock !== 'DEMO_UNAVAILABLE' && (answers.budget === null || v.price <= answers.budget))})).filter(p=>p.variants.length);
  return <div className="shell finder-page">
    <div className="page-heading"><p className="eyebrow">ALATAU DOORS</p><h1>{t('title')}</h1><p>{t('intro')}</p></div>
    <ol className="finder-steps" aria-label={t('steps')}>{['type','quantity','budget','results'].map((key,i)=><li key={key} aria-current={initial.step===i+1?'step':undefined}><span>{i+1}</span>{t(key)}</li>)}</ol>
    <form className="panel workspace-form finder-form" onSubmit={e=>{e.preventDefault();go(Math.min(4,initial.step+1));}}>
      <h2 tabIndex={-1}>{t(['typeTitle','quantityTitle','budgetTitle','resultsTitle'][initial.step-1])}</h2>
      {initial.step===1 && <fieldset className="finder-choices"><legend className="sr-only">{t('type')}</legend>{(['interior','entrance'] as const).map(type=><label key={type}><input type="radio" name="door-type" value={type} checked={answers.category===type} onChange={()=>setAnswers({...answers,category:type})}/><strong>{w(type)}</strong><span>{t(`${type}Hint`)}</span></label>)}</fieldset>}
      {initial.step===2 && <label>{t('quantity')}<input name="quantity" type="number" min={1} max={20} required value={answers.quantity} onChange={e=>setAnswers({...answers,quantity:Number(e.target.value)})}/><small>{t('quantityHint')}</small></label>}
      {initial.step===3 && <><p>{t('budgetNote')}</p><label className="check-label"><input type="checkbox" checked={answers.budget===null} onChange={e=>setAnswers({...answers,budget:e.target.checked?null:150000})}/>{t('undecided')}</label>{answers.budget!==null && <label>{t('maxBudget')}<input name="budget" type="number" min={1} max={10000000} required value={answers.budget} onChange={e=>setAnswers({...answers,budget:Number(e.target.value)})}/></label>}</>}
      {initial.step===4 && <><p data-testid="finder-summary">{w(answers.category)} · {answers.quantity} {t('pieces')} · {answers.budget===null ? t('undecided') : `${t('upTo')} ${formatPrice(answers.budget)} ${t('perLeaf')}`}</p><p className="workspace-note">{t('resultsNote')}</p></>}
      <div className="form-actions">
        {initial.step>1 && <button type="button" className="secondary-button" onClick={()=>go(initial.step-1)}>{t('back')}</button>}
        {initial.step<4 && <button className="primary-button">{t(initial.step===3?'show':'next')} →</button>}
        <Link className="text-link" href="/door-finder" onClick={()=>setAnswers({step:1,category:'interior',quantity:1,budget:null})}>{t('reset')}</Link>
      </div>
    </form>
    {initial.step===4 && (matches.length ? <div className="finder-results">{matches.map(product=><FinderResult key={product.id} product={product} quantity={answers.quantity}/>)}</div> : <section className="panel finder-empty"><h2>{t('emptyTitle')}</h2><p>{t('emptyText')}</p><button className="secondary-button" onClick={()=>go(3)}>{t('change')}</button></section>)}
  </div>;
}
function FinderResult({product,quantity}: {product:AdminProduct; quantity:number}) {
  const t=useTranslations('Finder'), w=useTranslations('Workspace');
  const locale=useLocale();
  const actor=useSessionState(s=>s.actor), loading=useSessionState(s=>s.loading);
  const [variantId,setVariantId]=useState(product.variants[0].id);
  const [busy,setBusy]=useState(false), [added,setAdded]=useState(false), [error,setError]=useState('');
  return <article className="finder-result" data-testid="finder-result" data-category={product.category}>
    <div className="finder-image"><Image src={product.image} alt={product.name} fill sizes="(max-width:760px) 90vw, 30vw"/><span>{t('illustration')}</span></div>
    <div><h2><Link href={`/product/${product.slug}`}>{product.name}</Link></h2><p>{product.finish[locale==='kk'?'kk':'ru']}</p>
      <label>{t('size')}<select value={variantId} onChange={e=>{setVariantId(e.target.value);setAdded(false);}}>{product.variants.map(v=><option key={v.id} value={v.id}>{v.width} × {v.height} · {formatPrice(v.price,locale)} {t('perLeaf')}</option>)}</select></label>
      <p>{t('addQuantity',{quantity})}</p>
      <button className="primary-button" disabled={busy||loading||added||Boolean(actor&&actor.role!=='BUYER')} onClick={async()=>{
        setBusy(true);setError('');try{await addToSelection(actor,{variantId,quantity,frame:false,hardware:false,installation:false});setAdded(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
      }}>{w(added?'addedToSelection':'addToSelection')}</button>
      {added && <Link className="text-link" href="/selection">{w('selection')} ↗</Link>}
      {actor && actor.role!=='BUYER' && <p>{w('buyerOnly')}</p>}
      <Feedback error={error}/>
    </div>
  </article>;
}
