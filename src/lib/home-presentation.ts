import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Deliberately separate from evolve-dashboard-layout-v1: never overwrite the old layout.
const HOME_PRESENTATION_KEY = 'evolve-home-presentation-v1';

export function useHomePresentation() {
  const [simple, setSimple] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HOME_PRESENTATION_KEY).then(value => {
      if (active) setSimple(value !== 'complete');
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  async function change(simpleMode: boolean) {
    if (lock.current || !ready || simpleMode === simple) return false;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await AsyncStorage.setItem(HOME_PRESENTATION_KEY, simpleMode ? 'simple' : 'complete');
      setSimple(simpleMode);
      return true;
    } catch {
      setError('Le choix n’a pas pu être enregistré. Réessaie.');
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return { simple, ready, saving, error, change };
}
