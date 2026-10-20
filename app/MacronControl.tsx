'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { addDictionaryMacrons, validateMacronLexicon } from './macrons.mjs';
import receipt from '../corpus-source/macrons/receipt.json';

let cachedEntries: Record<string, number[]> | null = null;

export function useMacrons() {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<Record<string, number[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);

  const toggle = useCallback(async () => {
    if (loading) return;
    if (enabled) { setEnabled(false); return; }
    setError('');
    if (cachedEntries) { setEntries(cachedEntries); setEnabled(true); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    setLoading(true);
    try {
      const response = await fetch(receipt.lexicon.file, { signal: controller.signal });
      if (!response.ok) throw new Error('Macron lexicon unavailable.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== receipt.lexicon.bytes) throw new Error('Unexpected macron lexicon size.');
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== receipt.lexicon.sha256) throw new Error('Macron lexicon integrity check failed.');
      const parsed = validateMacronLexicon(JSON.parse(new TextDecoder().decode(bytes)));
      if (controller.signal.aborted) return;
      cachedEntries = parsed;
      setEntries(parsed);
      setEnabled(true);
    } catch {
      if (controllerRef.current === controller) setError('Macrons unavailable. Original Latin shown; try again.');
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) setLoading(false);
    }
  }, [enabled, loading]);

  const annotate = useCallback((text: string) => enabled ? addDictionaryMacrons(text, entries) : text, [enabled, entries]);
  return { enabled, loading, error, toggle, annotate };
}

export function MacronControl({ control, onToggle }: {
  control: ReturnType<typeof useMacrons>;
  onToggle?: () => void;
}) {
  const noteId = useId();
  return (
    <div className="macron-tools">
      <button type="button" className="macron-toggle" aria-pressed={control.enabled} aria-label={control.enabled ? 'Turn off Latin macrons' : 'Show Latin with dictionary macrons'} aria-describedby={noteId}
        disabled={control.loading} onClick={() => { onToggle?.(); void control.toggle(); }}>
        {control.loading ? 'Loading macrons…' : control.enabled ? 'Macrons on' : 'Macrons off'}
      </button>
      <span id={noteId} className="macron-note" role="status">
        {control.error || (control.enabled ? <>Partial dictionary aid; uncertain vowels unmarked. <a href="/edition#macrons">About</a></> : 'Optional Latin reading aid')}
      </span>
    </div>
  );
}
