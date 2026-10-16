'use client';
import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCafe } from '@/components/cafe-provider';
import { RecipeArt } from '@/components/art';
import { generateCafeItem, validateRecipe, type BaristaStatus } from '@/lib/ai/generate-item';
import { categories, type Recipe } from '@/lib/types';
import { errorMessage } from '@/lib/stellar/errors';
import { transactionUrl } from '@/lib/stellar/config';
import type { TransactionState } from '@/lib/stellar/transaction';
import { registrationBlock } from '@/lib/cafe/action-readiness';
import { categoryLabels, recipeArtVariant } from '@/lib/cafe/recipe-kind';
import initial from '@/config/my_item.json';
export default function Create() { const { t } = useLanguage(); 
    const { register, connected, connect, transaction, blocked, cafes, wallet, selectedCafeId, ready, loading, error: directoryError, refresh: refreshCafes } = useCafe();
    const [barista, setBarista] = useState<BaristaStatus | null>(null);
    const [generated, setGenerated] = useState(false);
    const generation = useRef<AbortController | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void fetch('/api/barista', { cache: 'no-store', signal: controller.signal })
            .then(async (response) => { if (!response.ok)
            throw new Error('Status unavailable'); return response.json(); })
            .then((status: BaristaStatus) => { if (!controller.signal.aborted)
            setBarista(status); })
            .catch(() => { if (!controller.signal.aborted)
            setBarista({ provider: 'openai', ready: false }); });
        return () => { controller.abort(); generation.current?.abort(); };
    }, []);
    const [prompt, setPrompt] = useState('');
    const [recipe, setRecipe] = useState<Recipe>(initial as Recipe);
    const [busy, setBusy] = useState('');
    const [targetId, setTargetId] = useState('');
    const registrationReason = registrationBlock({ connected, ready, loading, error: directoryError, cafes, eligibleCount: cafes.filter(c => !c.owner || c.owner === wallet).length, targetId });
    const selection = useRef({ cafe: selectedCafeId, wallet });
    const eligible = cafes.filter(c => !c.owner || c.owner === wallet);
    useEffect(() => {
        if (blocked || busy)
            return;
        const available = cafes.filter(c => !c.owner || c.owner === wallet);
        const changed = selection.current.cafe !== selectedCafeId || selection.current.wallet !== wallet;
        selection.current = { cafe: selectedCafeId, wallet };
        setTargetId(current => changed ? available.find(c => c.contractId === selectedCafeId)?.contractId ?? available.find(c => c.owner === wallet)?.contractId ?? (available.some(c => c.contractId === current) ? current : available[0]?.contractId ?? '') : available.some(c => c.contractId === current) ? current : available.find(c => c.contractId === selectedCafeId)?.contractId ?? available.find(c => c.owner === wallet)?.contractId ?? available[0]?.contractId ?? '');
    }, [cafes, wallet, selectedCafeId, blocked, busy]);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [operationId, setOperationId] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<TransactionState | null>(null);
    const ownPending = operationId === transaction.operationId && blocked;
    useEffect(() => {
        if (operationId && transaction.operationId === operationId && transaction.stage === 'confirmed') {
            setDone(true);
            setReceipt(transaction);
        }
    }, [operationId, transaction]);
    function change<K extends keyof Recipe>(key: K, value: Recipe[K]) { setRecipe(current => ({ ...current, [key]: value })); setGenerated(false); setDone(false); setReceipt(null); setOperationId(null); }
    async function generate() {
        if (generation.current || busy || !barista?.ready)
            return;
        const controller = new AbortController();
        generation.current = controller;
        setBusy(t("Dreaming up your recipe…"));
        setError('');
        setGenerated(false);
        try {
            const result = await generateCafeItem(prompt, AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), recipe.category);
            if (!controller.signal.aborted) {
                setRecipe(result);
                setGenerated(true);
                setDone(false);
                setReceipt(null);
                setOperationId(null);
            }
        }
        catch (failure) {
            if (!controller.signal.aborted)
                setError(failure instanceof Error && failure.name === 'TimeoutError' ? 'The AI Barista took too long. Your recipe is unchanged; try again or edit manually.' : errorMessage(failure));
        }
        finally {
            generation.current = null;
            if (!controller.signal.aborted)
                setBusy('');
        }
    }
    async function save() {
        if (busy)
            return;
        setError('');
        let valid: Recipe;
        try {
            valid = validateRecipe(recipe);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Check your recipe.');
            return;
        }
        setBusy(t("Preparing your recipe…"));
        try {
            const id = await register(valid, targetId);
            setOperationId(id);
        }
        catch (failure) {
            setError(errorMessage(failure));
        }
        finally {
            setBusy('');
        }
    }
    return <section className="page-section"><div className="page-heading"><p className="eyebrow">{t("YOUR IMAGINATION, FRESHLY BREWED")}</p><h1>{t("What’s your flavor of cosmic?")}</h1><p>{t("Bring a little idea. Our AI Barista will bring the inspiration.")}</p></div><div className="create-grid"><fieldset className="editor editor-fields" disabled={!!busy || ownPending}>
    <section className="panel"><p className="eyebrow">{t("01 / DESCRIBE YOUR VIBE")}</p><h2>{t("Meet your AI Barista")} <span>✧</span></h2><p>{t("A Peruvian dessert? A matcha for moonwalks? Dream out loud.")}</p><div className="recipe-kind-selector" role="group" aria-label={t('What would you like to create?')}><span>{t('What would you like to create?')}</span><div className="filters"><button type="button" aria-pressed={recipe.category !== 'dessert'} className={recipe.category !== 'dessert' ? 'selected' : ''} onClick={() => change('category', 'coffee')}>{t('Drink')}</button><button type="button" aria-pressed={recipe.category === 'dessert'} className={recipe.category === 'dessert' ? 'selected' : ''} onClick={() => change('category', 'dessert')}>{t('Dessert')}</button></div></div>{recipe.category !== 'dessert' && <label>{t('Drink style')}<select value={recipe.category} onChange={e => change('category', e.target.value as Recipe['category'])}>{categories.filter(c => c !== 'dessert').map(c => <option key={c} value={c}>{t(categoryLabels[c])}</option>)}</select></label>}<label htmlFor="prompt">{t("Your creative idea")}</label><textarea id="prompt" maxLength={600} rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t(recipe.category === 'dessert' ? 'A lúcuma cake with a cosmic touch…' : (recipe.category === 'cold' ? 'An iced latte with vanilla and a cosmic touch…' : 'A warm latte with vanilla and a cosmic touch…'))}/><div className="prompt-suggestions">{(recipe.category === 'dessert' ? ['Lúcuma cake among the stars', 'Moonlight chocolate brownie', 'Stellar vanilla ice cream'] : ['Latte among the stars', 'Matcha for a slow morning', 'Cold brew after midnight']).map(s => <button key={s} onClick={() => { setPrompt(t(s)); if (s === 'Cold brew after midnight') change('category', 'cold'); }}>{t(s)} ↗</button>)}</div><button className="button primary full" disabled={!!busy || !prompt.trim() || !barista?.ready} onClick={() => { void generate(); }}>{busy || t("✧ Dream up my recipe")}</button><p className="hint">{!barista ? t("Checking the barista…") : !barista.ready ? t("AI Barista unavailable · You can still edit your recipe below.") : t(barista.provider === "anthropic" ? "AI Barista · Your idea is sent to Anthropic to create a fictional recipe." : "AI Barista · Your idea is sent to OpenAI to create a fictional recipe.")}</p><p className="hint">{t("Recipes are fictional. Always review before registering.")}</p>{generated && <p className="success" role="status">{t("Recipe ready. Make it yours below, then register when you’re happy.")}</p>}</section>
    <section className="panel"><p className="eyebrow">{t("02 / MAKE IT YOURS")}</p><h2>{t("A recipe with your signature")}</h2><div className="form-grid"><label>{t("Drink or dessert name")}<input maxLength={60} value={recipe.name} onChange={e => change('name', e.target.value)}/></label><label>{t("Category")}<select value={recipe.category} onChange={e => change('category', e.target.value as Recipe['category'])}>{categories.map(c => <option key={c} value={c}>{t(categoryLabels[c])}</option>)}</select></label><label className="full-field">{t("Description")}<textarea rows={2} maxLength={240} value={recipe.description} onChange={e => change('description', e.target.value)}/></label><label className="full-field">{t("Ingredients")} <small>{t("One per line · Up to 8")}</small><textarea rows={4} value={recipe.ingredients.join('\n')} onChange={e => change('ingredients', e.target.value.split('\n'))}/></label><label>Vibe<input maxLength={80} value={recipe.vibe} onChange={e => change('vibe', e.target.value)}/></label><label>{t("Price in Testnet XLM")}<input type="number" min={1} max={5} step="0.0000001" value={recipe.price_xlm} onChange={e => change('price_xlm', Number(e.target.value))}/></label></div><p className="hint">{t("Names: 60 UTF-8 bytes · Vibe: 80 · Description: 240 · Ingredients: 60 each. Accented characters may use more than one byte.")}</p></section>
  </fieldset><aside><div className="panel preview"><p className="eyebrow">{t("03 / YOUR RECIPE DRAFT · NOT ON-CHAIN")}</p><label className="create-cafe-label">{t("Register in your café")}<select value={targetId} disabled={!!busy || blocked} onChange={e => { setTargetId(e.target.value); setDone(false); setReceipt(null); }}><option value="" disabled>{t("Choose your café")}</option>{eligible.map(c => <option key={c.contractId} value={c.contractId}>{c.name}</option>)}</select></label>{!eligible.length && <p className="hint">{connected ? t("Your café is not listed yet. Share your deployment manifest with the event host.") : t("Connect the wallet that owns your café to create here.")} <Link className="text-link" href="/cafes">{t("Meet the cafés ↗")}</Link></p>}<div className="preview-art"><RecipeArt category={recipe.category} variant={recipeArtVariant(recipe.name)}/></div><span className="category">{t(categoryLabels[recipe.category])}</span><h2>{recipe.name || t("Your cosmic creation")}</h2><p className="vibe">{recipe.vibe}</p><p>{recipe.description}</p><div className="ingredients">{recipe.ingredients.filter(Boolean).map((i, n) => <span key={n}>{i}</span>)}</div>{registrationReason && <div id="registration-reason" role="status"><p className="hint">{t(registrationReason)}</p>{!cafes.length && <button className="text-link" disabled={loading} onClick={() => { void refreshCafes(); }}>{t('Refresh café directory ↻')}</button>}</div>}<div className="preview-price">{recipe.price_xlm} <small>XLM</small></div>{error && <p className="error" role="alert">{error}</p>}{done ? <div role="status" className="success">✓ {t("Recipe registered on Stellar!")}<p>{t("Your creation is on the community menu.")}</p>{receipt?.cafeName && <p>{receipt.cafeName}</p>}{receipt?.entityId && <p>Item #{receipt.entityId}</p>}{receipt?.hash && <a className="text-link" href={transactionUrl(receipt.hash)} target="_blank" rel="noreferrer">{t("View registration ↗")}</a>}<Link className="button primary full" href={`/menu?cafe=${encodeURIComponent(receipt?.contractId ?? targetId)}`}>{t("Meet your creation ↗")}</Link></div> : blocked ? <button className="button primary full" onClick={connect}>{t("Review current transaction ↗")}</button> : <button className="button primary full" disabled={!!busy || !!registrationReason} aria-busy={!!busy} aria-describedby={registrationReason ? "registration-reason" : undefined} onClick={connected ? () => { void save(); } : connect}>{busy || (!connected ? t("Connect Freighter") : t("Register on Stellar ↗"))}</button>}<p className="hint">{t("Testnet registration · Review the recipe and network fee before signing. The item appears after confirmation.")}</p></div></aside></div></section>;
}
