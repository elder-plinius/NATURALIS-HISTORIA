'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addDictionaryMacrons, validateMacronLexicon } from './macrons.mjs';
import receipt from '../corpus-source/macrons/receipt.json';

let cachedEntries: Record<string, number[]> | null = null;

export function useMacrons() {
  const [requested, setRequested] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<Record<string, number[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);

  const select = useCallback(async (requested: boolean) => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRequested(requested);
    setLoading(false);
    setEnabled(false);
    if (!requested) { setError(''); return; }
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
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      cachedEntries = parsed;
      setEntries(parsed);
      setEnabled(true);
    } catch {
      if (controllerRef.current === controller) setError('Macrons unavailable. Original Latin shown; try again.');
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) setLoading(false);
    }
  }, []);

  const annotate = useCallback((text: string) => enabled ? addDictionaryMacrons(text, entries) : text, [enabled, entries]);
  return { requested, enabled, loading, error, select, annotate };
}
