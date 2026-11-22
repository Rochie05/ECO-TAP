import { useEffect, useRef, useSyncExternalStore } from 'react';
import { KioskController } from './controller';

/** One controller for the life of the app (the Kotlin `remember { EcoTapViewModel() }`). Returns [state, controller]. */
export function useKiosk() {
  const ref = useRef(null);
  if (!ref.current) ref.current = new KioskController();
  const controller = ref.current;
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => () => controller.dispose(), [controller]);
  return [state, controller];
}
