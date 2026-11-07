import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_COMMANDS, AdminResult } from '../game/admin';

interface LogEntry {
  id: number;
  text: string;
  kind: 'user' | 'ok' | 'err' | 'sys';
}

interface AdminConsoleProps {
  unlocked: boolean;
  onSubmitPassword: (password: string) => AdminResult;
  onExecute: (command: string) => AdminResult;
  onLock: () => void;
  onClose: () => void;
}

let entryId = 0;

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  unlocked,
  onSubmitPassword,
  onExecute,
  onLock,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [denied, setDenied] = useState(false);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<LogEntry[]>([
    {
      id: entryId++,
      text: 'SULFURED CAVES // RIG OVERRIDE TERMINAL v2.1',
      kind: 'sys',
    },
    {
      id: entryId++,
      text: 'ENTER OVERRIDE KEY TO UNLOCK ADMIN COMMANDS',
      kind: 'sys',
    },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const push = (text: string, kind: LogEntry['kind']) => {
    setEntries((prev) => [...prev.slice(-140), { id: entryId++, text, kind }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [unlocked]);

  const suggestions = useMemo(() => {
    const token = input.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (!token) return [];
    return ADMIN_COMMANDS.filter(
      (c) => c.name.startsWith(token) && c.name !== token
    ).slice(0, 4);
  }, [input]);

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSubmitPassword(password);
    setPassword('');
    if (result.ok) {
      setDenied(false);
      push(result.message, 'ok');
      push('TYPE "help" FOR THE FULL COMMAND LIST', 'sys');
    } else {
      setDenied(true);
      push(result.message, 'err');
      window.setTimeout(() => setDenied(false), 420);
    }
  };

  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    push(`> ${cmd}`, 'user');
    setHistory((prev) => [cmd, ...prev].slice(0, 40));
    setHistoryIndex(-1);
    setInput('');

    const result = onExecute(cmd);
    result.message.split('\n').forEach((line) => push(line, result.ok ? 'ok' : 'err'));
    if (cmd.toLowerCase().startsWith('lock')) {
      push('TERMINAL SECURED', 'sys');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = Math.min(history.length - 1, historyIndex + 1);
      setHistoryIndex(next);
      setInput(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyIndex - 1;
      if (next < 0) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      setInput(suggestions[0].name + ' ');
    }
  };

  const quickCommands = unlocked
    ? ['max', 'credits 50000', 'give all 25', 'upgrade all max', 'god on', 'depth 180', 'reveal', 'status']
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        className={`crt-shell pixel-panel relative flex w-full max-w-3xl flex-col overflow-hidden transition-transform duration-150 ${
          denied ? 'animate-shake' : ''
        }`}
        style={{ maxHeight: 'calc(100dvh - 1rem)' }}
      >
        {/* Scanline + flicker overlay */}
        <div className="crt-scanlines pointer-events-none absolute inset-0 z-30" />
        <div className="crt-vignette pointer-events-none absolute inset-0 z-30" />

        {/* Header */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 border-b-4 border-[#09070d] bg-[#100d16] px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span
                className={`h-2.5 w-2.5 border border-black ${
                  unlocked ? 'bg-[#4ade80] animate-pulse-fast' : 'bg-[#7f1d1d]'
                }`}
              />
              <span
                className={`h-2.5 w-2.5 border border-black ${
                  unlocked ? 'bg-[#fde047]' : 'bg-[#3f1d1d]'
                }`}
              />
            </div>
            <div>
              <div className="font-pixel text-[10px] leading-tight text-[#fde047] sm:text-xs">
                RIG OVERRIDE CONSOLE
              </div>
              <div className="font-retro text-sm leading-tight text-[#7d8a6a]">
                {unlocked ? 'ADMIN PRIVILEGES: ACTIVE' : 'ADMIN PRIVILEGES: LOCKED'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unlocked && (
              <button
                type="button"
                onClick={() => {
                  onLock();
                  push('CONSOLE LOCKED BY OPERATOR', 'sys');
                }}
                className="pixel-btn bg-[#3f3220] px-2 py-1 font-pixel text-[9px] text-[#fde047]"
              >
                LOCK
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="pixel-btn bg-[#991b1b] px-2.5 py-1 font-pixel text-[10px] text-white"
            >
              X
            </button>
          </div>
        </div>

        {/* Hazard stripe */}
        <div className="hazard-stripe h-2 w-full" />

        {/* Log */}
        <div
          ref={logRef}
          className="pixel-scroll relative z-10 min-h-[120px] flex-1 overflow-y-auto overscroll-contain bg-[#080d08] px-2.5 py-2 sm:px-3 sm:py-2.5"
        >
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`font-retro text-base leading-snug sm:text-lg ${
                entry.kind === 'user'
                  ? 'text-[#fde047]'
                  : entry.kind === 'ok'
                  ? 'text-[#7dff9b]'
                  : entry.kind === 'err'
                  ? 'text-[#ff7a8a]'
                  : 'text-[#5f8f6a]'
              }`}
              style={{ textShadow: '0 0 6px rgba(80,255,140,0.22)' }}
            >
              {entry.kind === 'user' ? entry.text : `  ${entry.text}`}
            </div>
          ))}
        </div>

        {/* Quick command chips */}
        {unlocked && (
          <div className="pixel-scroll relative z-10 flex gap-1.5 overflow-x-auto border-t-2 border-[#16241a] bg-[#0b120c] px-2.5 py-1.5">
            {quickCommands.map((qc) => (
              <button
                key={qc}
                type="button"
                onClick={() => {
                  push(`> ${qc}`, 'user');
                  setHistory((prev) => [qc, ...prev].slice(0, 40));
                  const result = onExecute(qc);
                  result.message.split('\n').forEach((line) => push(line, result.ok ? 'ok' : 'err'));
                }}
                className="shrink-0 whitespace-nowrap border-2 border-[#1f3a26] bg-[#122116] px-2 py-1 font-retro text-sm text-[#8ce8a4] transition-colors duration-100 hover:border-[#4ade80] hover:bg-[#1a3320] hover:text-[#d6ffdf] active:translate-y-px"
              >
                {qc}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="relative z-10 border-t-4 border-[#09070d] bg-[#0d1410] px-3 py-2.5">
          {unlocked ? (
            <form onSubmit={handleSubmitCommand} className="flex items-center gap-2">
              <span className="font-retro text-xl text-[#4ade80]">admin@rig:~$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoComplete="off"
                placeholder="type a command…  (help)"
                className="font-retro min-w-0 flex-1 border-2 border-[#1f3a26] bg-[#080d08] px-2 py-1.5 text-base text-[#d6ffdf] caret-[#4ade80] outline-none placeholder:text-[#3f5c46] focus:border-[#4ade80] sm:text-lg"
              />
              <button
                type="submit"
                className="pixel-btn bg-[#166534] px-3 py-2 font-pixel text-[10px] text-[#dcfce7]"
              >
                RUN
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitPassword} className="flex items-center gap-2">
              <span className="font-pixel hidden text-[10px] text-[#fca5a5] sm:inline">KEY</span>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="ENTER OVERRIDE PASSWORD"
                className={`font-retro flex-1 border-2 bg-[#080d08] px-2.5 py-1.5 text-lg tracking-[0.3em] text-[#fde047] caret-[#fde047] outline-none placeholder:tracking-normal placeholder:text-[#4a3a3a] ${
                  denied ? 'border-[#ef4444]' : 'border-[#3a2f1f] focus:border-[#fde047]'
                }`}
              />
              <button
                type="submit"
                className="pixel-btn bg-[#b45309] px-3 py-2 font-pixel text-[10px] text-[#fef08a]"
              >
                UNLOCK
              </button>
            </form>
          )}

          {unlocked && suggestions.length > 0 && (
            <div className="font-retro mt-1.5 flex flex-wrap items-center gap-2 text-base text-[#4d7a58]">
              <span>TAB →</span>
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setInput(s.name + ' ')}
                  className="border-b-2 border-dotted border-[#2f4d38] hover:text-[#8ce8a4]"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
