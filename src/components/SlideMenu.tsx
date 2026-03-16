import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DayEntry } from '../types';

// ── 아이콘 ──────────────────────────────────────────
const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function navBtn(enabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: '1px solid ' + (enabled ? '#d0d0d0' : '#ebebeb'),
    borderRadius: '6px',
    padding: '5px 7px',
    cursor: enabled ? 'pointer' : 'default',
    color: enabled ? '#444' : '#ccc',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
    flexShrink: 0,
  };
}

const entryKey = (e: DayEntry) =>
  e.suffix ? `${e.date}-${e.suffix}.json` : `${e.date}.json`;

interface Props {
  open: boolean;
  onClose: () => void;
  entries: DayEntry[];
  selectedEntry: DayEntry | null;
  /** Called when user clicks an entry row — menu does NOT auto-close */
  onSelectEntry: (entry: DayEntry) => void;
  /** 관리자 모드일 때 true — 수정/삭제 버튼 표시 */
  isAdmin?: boolean;
  onEdit?: (entry: DayEntry) => void;
  onDelete?: (entry: DayEntry) => void;
  onDeleteMultiple?: (entries: DayEntry[]) => void;
}

export default function SlideMenu({ open, onClose, entries, selectedEntry, onSelectEntry, isAdmin, onEdit, onDelete, onDeleteMultiple }: Props) {
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [monthInput, setMonthInput] = useState('');
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const allCheckRef = useRef<HTMLInputElement>(null);

  // ── 연산 ──────────────────────────────────────────
  const years = useMemo(() => {
    const s = new Set(entries.map(e => e.date.slice(0, 4)));
    return Array.from(s).sort().reverse(); // newest first
  }, [entries]);

  const months = useMemo(() => {
    if (!selectedYear) return [];
    const s = new Set(
      entries.filter(e => e.date.slice(0, 4) === selectedYear).map(e => e.date.slice(5, 7))
    );
    return Array.from(s).sort();
  }, [entries, selectedYear]);

  const menuEntries = useMemo(() => {
    if (!selectedYear || !selectedMonth) return [];
    return entries.filter(e => e.date.startsWith(`${selectedYear}-${selectedMonth}`));
  }, [entries, selectedYear, selectedMonth]);

  // 체크 상태 계산
  const checkedInView = menuEntries.filter(e => checkedKeys.has(entryKey(e)));
  const allChecked = menuEntries.length > 0 && checkedInView.length === menuEntries.length;
  const someChecked = checkedInView.length > 0;

  // 전체 선택 체크박스 indeterminate 상태
  useEffect(() => {
    if (allCheckRef.current) {
      allCheckRef.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  // entries 변경 시 체크 초기화
  useEffect(() => {
    setCheckedKeys(new Set());
  }, [entries]);

  // ── 초기화 (selectedEntry 또는 entries 변경 시) ──
  useEffect(() => {
    const ref = selectedEntry ?? entries[0] ?? null;
    if (!ref) return;
    const y = ref.date.slice(0, 4);
    const m = ref.date.slice(5, 7);
    setSelectedYear(y);
    setSelectedMonth(m);
    setYearInput(y);
    setMonthInput(String(parseInt(m, 10)));
  }, [selectedEntry, entries]);

  // ── 연도 네비게이션 ────────────────────────────────
  const yearIdx = years.indexOf(selectedYear);
  const hasPrevYear = yearIdx < years.length - 1;
  const hasNextYear = yearIdx > 0;

  const applyYear = (y: string) => {
    if (!years.includes(y)) { setYearInput(selectedYear); return; }
    const firstM = entries.find(e => e.date.slice(0, 4) === y)?.date.slice(5, 7) ?? '';
    setSelectedYear(y);
    setSelectedMonth(firstM);
    setYearInput(y);
    setMonthInput(String(parseInt(firstM, 10)));
  };

  const goPrevYear = () => hasPrevYear && applyYear(years[yearIdx + 1]);
  const goNextYear = () => hasNextYear && applyYear(years[yearIdx - 1]);
  const commitYearInput = () => applyYear(yearInput.trim());

  // ── 월 네비게이션 ──────────────────────────────────
  const monthIdx = months.indexOf(selectedMonth);
  const hasPrevMonth = monthIdx > 0;
  const hasNextMonth = monthIdx < months.length - 1;

  const applyMonth = (m: string) => {
    const padded = m.padStart(2, '0');
    if (!months.includes(padded)) { setMonthInput(String(parseInt(selectedMonth, 10))); return; }
    setSelectedMonth(padded);
    setMonthInput(String(parseInt(padded, 10)));
  };

  const goPrevMonth = () => hasPrevMonth && applyMonth(months[monthIdx - 1]);
  const goNextMonth = () => hasNextMonth && applyMonth(months[monthIdx + 1]);
  const commitMonthInput = () => {
    const n = parseInt(monthInput, 10);
    if (isNaN(n) || n < 1 || n > 12) { setMonthInput(String(parseInt(selectedMonth, 10))); return; }
    applyMonth(String(n).padStart(2, '0'));
  };

  // ── 체크 토글 ──────────────────────────────────────
  const toggleCheck = (entry: DayEntry) => {
    const k = entryKey(entry);
    setCheckedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const toggleAll = () => {
    setCheckedKeys(prev => {
      const next = new Set(prev);
      if (allChecked) {
        menuEntries.forEach(e => next.delete(entryKey(e)));
      } else {
        menuEntries.forEach(e => next.add(entryKey(e)));
      }
      return next;
    });
  };

  // ── 렌더 ──────────────────────────────────────────
  return (
    <>
      {/* Overlay — overlay 클릭 시 닫힘 */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.3)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
        onClick={onClose}
      />

      {/* Slide panel */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 210,
          width: '300px', background: 'white',
          boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 헤더 + 닫기 버튼 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>파일 목록</span>
          <button
            onClick={onClose}
            style={{
              background: 'white', border: '1px solid #ddd', borderRadius: '6px',
              padding: '5px 7px', cursor: 'pointer', color: '#555',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="닫기"
          >
            <IconX />
          </button>
        </div>

        {/* 연도 행 */}
        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #f5f5f5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <button onClick={goPrevYear} disabled={!hasPrevYear} style={navBtn(hasPrevYear)} title="이전 연도">
              <IconChevronLeft />
            </button>
            <input
              value={yearInput}
              onChange={e => setYearInput(e.target.value)}
              onBlur={commitYearInput}
              onKeyDown={e => { if (e.key === 'Enter') { commitYearInput(); (e.target as HTMLInputElement).blur(); } }}
              style={{
                fontSize: '22px', fontWeight: 700, textAlign: 'center',
                border: '1px solid #e0e0e0', borderRadius: '8px',
                padding: '4px 6px', width: '88px', color: '#2c3e50',
                outline: 'none', background: 'white',
              }}
            />
            <button onClick={goNextYear} disabled={!hasNextYear} style={navBtn(hasNextYear)} title="다음 연도">
              <IconChevronRight />
            </button>
          </div>
        </div>

        {/* 월 행 */}
        <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <button onClick={goPrevMonth} disabled={!hasPrevMonth} style={navBtn(hasPrevMonth)} title="이전 월">
              <IconChevronLeft />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                value={monthInput}
                onChange={e => setMonthInput(e.target.value)}
                onBlur={commitMonthInput}
                onKeyDown={e => { if (e.key === 'Enter') { commitMonthInput(); (e.target as HTMLInputElement).blur(); } }}
                style={{
                  fontSize: '22px', fontWeight: 700, textAlign: 'center',
                  border: '1px solid #e0e0e0', borderRadius: '8px',
                  padding: '4px 6px', width: '62px', color: '#2c3e50',
                  outline: 'none', background: 'white',
                }}
              />
              <span style={{ fontSize: '16px', color: '#aaa', fontWeight: 500 }}>월</span>
            </div>
            <button onClick={goNextMonth} disabled={!hasNextMonth} style={navBtn(hasNextMonth)} title="다음 월">
              <IconChevronRight />
            </button>
          </div>
          {/* 파일 수 + 전체 선택 */}
          {isAdmin && menuEntries.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px', color: '#666' }}>
                <input
                  ref={allCheckRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                />
                전체 선택
              </label>
              <span style={{ fontSize: '11px', color: '#bbb' }}>{menuEntries.length}개 파일</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#bbb', marginTop: '4px' }}>
              {menuEntries.length}개 파일
            </div>
          )}
        </div>

        {/* 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {menuEntries.length === 0 ? (
            <div style={{ padding: '24px 16px', color: '#bbb', fontSize: '13px', textAlign: 'center' }}>
              항목이 없습니다
            </div>
          ) : (
            menuEntries.map((entry, idx) => {
              const isActive = selectedEntry?.date === entry.date && selectedEntry?.suffix === entry.suffix;
              const isChecked = checkedKeys.has(entryKey(entry));
              const label = entry.suffix ? `${entry.date} (${entry.suffix})` : entry.date;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center',
                    background: isChecked ? '#fff3e0' : isActive ? '#e8f5e9' : 'transparent',
                    borderLeft: isChecked ? '3px solid #ff9800' : isActive ? '3px solid #4caf50' : '3px solid transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isActive && !isChecked) e.currentTarget.style.background = '#f7f7f7'; }}
                  onMouseLeave={e => { if (!isActive && !isChecked) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* 체크박스 (관리자 모드) */}
                  {isAdmin && (
                    <div
                      style={{ padding: '0 4px 0 10px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(entry)}
                        style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                      />
                    </div>
                  )}
                  {/* 선택 영역 */}
                  <div
                    onClick={() => onSelectEntry(entry)}
                    style={{ flex: 1, padding: '9px 8px 9px 6px', cursor: 'pointer', minWidth: 0 }}
                  >
                    <div style={{
                      fontSize: '14px', fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#2e7d32' : '#2c3e50',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                      {label} · {entry.count}문장
                    </div>
                  </div>
                  {/* 관리자 버튼 */}
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '4px', padding: '0 8px', flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); onEdit?.(entry); }}
                        title="수정"
                        style={{
                          background: 'none', border: '1px solid #b0bec5', borderRadius: '5px',
                          padding: '3px 7px', fontSize: '11px', color: '#546e7a', cursor: 'pointer',
                        }}
                      >수정</button>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete?.(entry); }}
                        title="삭제"
                        style={{
                          background: 'none', border: '1px solid #ef9a9a', borderRadius: '5px',
                          padding: '3px 7px', fontSize: '11px', color: '#c62828', cursor: 'pointer',
                        }}
                      >삭제</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 선택 삭제 액션 바 */}
        {isAdmin && someChecked && (
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid #ffe0b2',
            background: '#fff8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '13px', color: '#e65100', fontWeight: 500 }}>
              {checkedInView.length}개 선택됨
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setCheckedKeys(new Set())}
                style={{
                  background: 'white', border: '1px solid #ccc', borderRadius: '6px',
                  padding: '5px 10px', fontSize: '12px', color: '#666', cursor: 'pointer',
                }}
              >
                선택 해제
              </button>
              <button
                onClick={() => onDeleteMultiple?.(checkedInView)}
                style={{
                  background: '#e53935', border: 'none', borderRadius: '6px',
                  padding: '5px 12px', fontSize: '12px', color: 'white',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                🗑 선택 삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
