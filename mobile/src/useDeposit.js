import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

const POLL_MS = 2000;
const FALLBACK_WINDOW_MS = 3 * 60_000; // matches DEPOSIT_SESSION_MS on the server

/**
 * Deposit session lifecycle. The resident only picks a category; the machine's scale and sensor report the
 * weight and material, and the server awards the points. This hook opens the session and watches for the result.
 * phase: idle | starting | waiting | done | failed
 */
export function useDeposit({ onCompleted }) {
  const [state, setState] = useState({ phase: 'idle', session: null, deadline: 0, result: null, message: '' });
  const stateRef = useRef(state);
  stateRef.current = state;
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const misses = useRef(0);

  const start = useCallback(async (categoryId) => {
    setState({ phase: 'starting', session: null, deadline: 0, result: null, message: '' });
    try {
      const session = await api.startDeposit(categoryId);
      const remaining = Number(session.expiresAt) - Date.now();
      const deadline = Date.now() + (remaining > 0 && remaining <= 10 * 60_000 ? remaining : FALLBACK_WINDOW_MS);
      misses.current = 0;
      setState({ phase: 'waiting', session, deadline, result: null, message: '' });
    } catch (error) {
      setState({ phase: 'failed', session: null, deadline: 0, result: null, message: error.message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ phase: 'idle', session: null, deadline: 0, result: null, message: '' });
  }, []);

  const cancel = useCallback(async () => {
    const { session } = stateRef.current;
    reset();
    if (session) { try { await api.cancelDeposit(session.sessionId); } catch { /* it expires by itself */ } }
  }, [reset]);

  useEffect(() => {
    if (state.phase !== 'waiting') return undefined;
    const sessionId = state.session.sessionId;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const status = await api.depositStatus(sessionId);
        if (stopped) return;
        misses.current = 0;
        if (status.status === 'completed') {
          setState((s) => ({ ...s, phase: 'done', result: status.deposit, message: '' }));
          onCompletedRef.current?.(status);
        } else if (status.status === 'expired') {
          setState((s) => ({ ...s, phase: 'failed', message: 'The session timed out before the machine measured anything.' }));
        } else if (status.status === 'cancelled') {
          setState((s) => ({ ...s, phase: 'idle' }));
        }
      } catch (error) {
        if (stopped) return;
        misses.current += 1;
        // A dropped connection should not end a deposit; give up after about 20 seconds without an answer.
        if (error.status || misses.current >= 10) {
          setState((s) => ({ ...s, phase: 'failed', message: error.message }));
        }
      }
    }, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [state.phase, state.session]);

  return { ...state, start, cancel, reset };
}
