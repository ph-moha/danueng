import React, { useState, useEffect, useRef } from 'react';
import { SentenceData, DayEntry, DayFile, entryToFilename } from '../types';
import SlideMenu from './SlideMenu';

const EDGE_VOICES = [
  { label: 'Brian  (US, 남)', id: 'en-US-BrianMultilingualNeural|' },
  { label: 'Emma   (US, 여)', id: 'en-US-EmmaMultilingualNeural|' },
  { label: 'Jenny  (US, 여)', id: 'en-US-JennyNeural|' },
  { label: 'Aria   (US, 여)', id: 'en-US-AriaNeural|' },
  { label: 'Guy    (US, 남)', id: 'en-US-GuyNeural|' },
  { label: 'Eric   (US, 남)', id: 'en-US-EricNeural|' },
  { label: 'Andrew (US, 남)', id: 'en-US-AndrewNeural|' },
];

// ── 상세 텍스트 파서 ──────────────────────────────────
interface WordEntry {
  word: string;
  pronunciation: string; // "dig / dɪɡ / 디그 / 파다"
  pos: string;           // "[V / 动词] 挖, 掘"
  conjugation?: string;  // "dig / dug / dug / digging" (선택)
  enExamples: string[];
  zhExamples: string[];
  extras: string[][];    // 추가 설명 단락들 (각 단락 = 줄 배열)
}

function parseDetailBlocks(raw: string): WordEntry[] {
  if (!raw?.trim()) return [];
  // [[단어]] 마커로 분리
  const parts = raw.split(/\[\[([^\]]+)\]\]\n?/);
  // parts = ['', 'dig', '내용...', 'dig in', '내용...', ...]
  const entries: WordEntry[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const word = parts[i].trim();
    const content = (parts[i + 1] || '').trim();
    const paragraphs = content.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    const headerLines = (paragraphs[0] || '').split('\n').filter(Boolean);
    const enLines = (paragraphs[1] || '').split('\n').filter(Boolean);
    const zhLines = (paragraphs[2] || '').split('\n').filter(Boolean);
    // paragraphs[3+] = 추가 설명 단락
    const extras = paragraphs.slice(3).map(p => p.split('\n').filter(Boolean));
    // headerLines[0] = pronunciation, [1] = POS, [2] = conjugation (optional)
    entries.push({
      word,
      pronunciation: headerLines[0] || '',
      pos: headerLines[1] || '',
      conjugation: headerLines.length > 2 ? headerLines[2] : undefined,
      enExamples: enLines,
      zhExamples: zhLines,
      extras,
    });
  }
  return entries;
}

// ── 아이콘 ──────────────────────────────────────────
const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconChevronLeft = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconPlay = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const IconStop = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M6 6h12v12H6z" />
  </svg>
);

const IconRepeat = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IconBook = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

export default function LearnerMode() {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DayEntry | null>(null);

  const now = new Date();
  const [navYear, setNavYear] = useState(now.getFullYear());
  const [navMonth, setNavMonth] = useState(now.getMonth() + 1); // 1-12
  const [data, setData] = useState<SentenceData[]>([]);
  const [dayTitle, setDayTitle] = useState('');
  const [openStates, setOpenStates] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [slideMenuOpen, setSlideMenuOpen] = useState(false);

  // Details sidebar
  const [selectedDetail, setSelectedDetail] = useState<{ sentence: string, detail: string } | null>(null);

  // TTS
  const [selectedVoice, setSelectedVoice] = useState('en-US-BrianMultilingualNeural|');
  const [detailGender, setDetailGender] = useState<'female' | 'male'>('female');
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playMode, setPlayMode] = useState<null | 'once' | 'loop' | 'sentence-once' | 'sentence-loop' | 'word-once' | 'word-loop'>(null);
  const [sentencePlayIdx, setSentencePlayIdx] = useState<number | null>(null);
  const stopAllRef = useRef(false);

  // 날짜 목록 로드
  useEffect(() => {
    fetch('/json/index.json')
      .then(res => res.json())
      .then((json: DayEntry[]) => setEntries([...json].reverse()))
      .catch(e => console.error('Could not load index.json', e));
  }, []);

  // ── 이전/다음 항목 ────────────────────────────────────
  const currentIndex = selectedEntry ? entries.findIndex(e => e === selectedEntry) : -1;
  const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const nextEntry = currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  // ── entry 선택 (메뉴 자동 닫힘 없음) ────────────────
  const selectEntry = (entry: DayEntry) => {
    setLoading(true);
    fetch(`/json/${entryToFilename(entry)}`)
      .then(res => res.json())
      .then((json: DayFile) => {
        const sentences = json.sentences || [];
        setData(sentences);
        setDayTitle(json.title || entry.date);
        setOpenStates(new Array(sentences.length).fill(false));
        setSelectedEntry(entry);
      })
      .catch(e => console.error('Could not load day file', e))
      .finally(() => setLoading(false));
  };

  const toggleCard = (index: number) => {
    const s = [...openStates];
    s[index] = !s[index];
    setOpenStates(s);
  };



  // playIdx: 999 = 단어, 998 = 활용형
  const playWordTTS = async (pronunciation: string, mode: 'once' | 'loop', textOverride?: string, playIdx = 999) => {
    const word = textOverride ?? pronunciation.split('/')[0].trim();
    if (!word) return;

    const targetMode = mode === 'once' ? 'word-once' : 'word-loop';
    // 같은 버튼 다시 누르면 정지
    if (playMode === targetMode && sentencePlayIdx === playIdx) { stopPlayAll(); return; }

    stopPlayAll();
    await new Promise(r => setTimeout(r, 50));
    stopAllRef.current = false;
    setPlayMode(targetMode);
    setSentencePlayIdx(playIdx);

    const playOne = (): Promise<void> =>
      new Promise(async resolve => {
        if (stopAllRef.current) { resolve(); return; }
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: word,
              voice: (detailGender === 'female' ? 'en-US-AriaNeural' : 'en-US-GuyNeural')
            }),
          });
          if (!res.ok) { resolve(); return; }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play();
        } catch { resolve(); }
      });

    do {
      if (stopAllRef.current) break;
      await playOne();
    } while (mode === 'loop' && !stopAllRef.current);

    if (!stopAllRef.current) {
      setPlayMode(null);
      setSentencePlayIdx(null);
    }
  };

  const openDetails = (item: SentenceData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDetail({ sentence: item.english, detail: item.details || '저장된 상세 설명이 없습니다.' });
  };

  const closeDetails = () => setSelectedDetail(null);

  const stopPlayAll = () => {
    stopAllRef.current = true;
    currentAudioRef.current?.pause();
    setPlayMode(null);
    setSentencePlayIdx(null);
  };

  const playSingleSentence = async (text: string, idx: number, mode: 'once' | 'loop', e: React.MouseEvent) => {
    e.stopPropagation();
    const targetMode = mode === 'once' ? 'sentence-once' : 'sentence-loop';
    // 같은 버튼 다시 누르면 정지
    if (playMode === targetMode && sentencePlayIdx === idx) { stopPlayAll(); return; }
    
    stopPlayAll();
    await new Promise(r => setTimeout(r, 50));
    stopAllRef.current = false;
    setPlayMode(targetMode);
    setSentencePlayIdx(idx);

    const voiceStr = selectedVoice;
    const playOne = (): Promise<void> =>
      new Promise(async resolve => {
        if (stopAllRef.current) { resolve(); return; }
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: voiceStr.split('|')[0], locale: voiceStr.split('|')[1] || undefined }),
          });
          if (!res.ok) { resolve(); return; }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play();
        } catch { resolve(); }
      });

    do {
      if (stopAllRef.current) break;
      await playOne();
    } while (mode === 'loop' && !stopAllRef.current);

    if (!stopAllRef.current) {
      setPlayMode(null);
      setSentencePlayIdx(null);
    }
  };

  const playAllSentences = async (mode: 'once' | 'loop') => {
    // 같은 버튼 다시 누르면 정지
    if (playMode === mode) { stopPlayAll(); return; }
    if (data.length === 0) return;
    // 다른 모드 실행 중이면 먼저 정지
    stopPlayAll();
    await new Promise(r => setTimeout(r, 50));
    stopAllRef.current = false;
    setPlayMode(mode);
    const voiceStr = selectedVoice;
    const playOne = (text: string): Promise<void> =>
      new Promise(async resolve => {
        if (stopAllRef.current) { resolve(); return; }
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: voiceStr.split('|')[0], locale: voiceStr.split('|')[1] || undefined }),
          });
          if (!res.ok) { resolve(); return; }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play();
        } catch { resolve(); }
      });
    do {
      for (const item of data) {
        if (stopAllRef.current) break;
        if (item.english.trim()) await playOne(item.english);
      }
    } while (mode === 'loop' && !stopAllRef.current);
    if (!stopAllRef.current) setPlayMode(null);
  };

  // ── 공통 헤더 바 ──────────────────────────────────────
  const headerBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
      {/* 메뉴 아이콘 */}
      <button
        onClick={() => setSlideMenuOpen(v => !v)}
        style={{
          background: 'white', border: '1px solid #ddd', borderRadius: '8px',
          padding: '8px', cursor: 'pointer', color: '#555', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="목록 열기"
      >
        <IconMenu />
      </button>

      {selectedEntry ? (
        <>
          {/* 중앙 그룹: < 제목 > [전체읽기] [반복읽기] */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            {/* < 제목 > */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => prevEntry && selectEntry(prevEntry)}
                disabled={!prevEntry}
                style={{
                  background: 'none', border: 'none', borderRadius: '8px',
                  padding: '4px', cursor: prevEntry ? 'pointer' : 'default',
                  color: prevEntry ? '#555' : '#ccc', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="이전"
              >
                <IconChevronLeft size={36} />
              </button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '30px', color: '#2c3e50', whiteSpace: 'nowrap' }}>
                  {dayTitle}
                </div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>
                  {entryToFilename(selectedEntry)} · {data.length}문장
                </div>
              </div>

              <button
                onClick={() => nextEntry && selectEntry(nextEntry)}
                disabled={!nextEntry}
                style={{
                  background: 'none', border: 'none', borderRadius: '8px',
                  padding: '4px', cursor: nextEntry ? 'pointer' : 'default',
                  color: nextEntry ? '#555' : '#ccc', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="다음"
              >
                <IconChevronRight size={36} />
              </button>
            </div>

            {/* 재생 버튼들 */}
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
              <button
                onClick={() => playAllSentences('once')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: playMode === 'once' ? '#ffe8e8' : '#ffffff',
                  color: playMode === 'once' ? '#e74c3c' : '#475569',
                  border: `1px solid ${playMode === 'once' ? '#ffcaca' : '#cbd5e1'}`,
                  borderRadius: '20px',
                  padding: '8px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: 600,
                  whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                  boxShadow: playMode === 'once' ? '0 2px 10px rgba(231,76,60,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={e => {
                  if (playMode !== 'once') { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }
                }}
                onMouseLeave={e => {
                  if (playMode !== 'once') { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }
                }}
              >
                {playMode === 'once' ? <IconStop size={15} /> : <IconPlay size={15} />}
                {playMode === 'once' ? '정지' : '전체 읽기'}
              </button>
              <button
                onClick={() => playAllSentences('loop')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: playMode === 'loop' ? '#ffe8e8' : '#ffffff',
                  color: playMode === 'loop' ? '#e74c3c' : '#475569',
                  border: `1px solid ${playMode === 'loop' ? '#ffcaca' : '#cbd5e1'}`,
                  borderRadius: '20px',
                  padding: '8px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: 600,
                  whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                  boxShadow: playMode === 'loop' ? '0 2px 10px rgba(231,76,60,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={e => {
                  if (playMode !== 'loop') { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }
                }}
                onMouseLeave={e => {
                  if (playMode !== 'loop') { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }
                }}
              >
                {playMode === 'loop' ? <IconStop size={15} /> : <IconRepeat size={15} />}
                {playMode === 'loop' ? '정지' : '반복 읽기'}
              </button>
            </div>
          </div>

          <select
            value={selectedVoice}
            onChange={e => setSelectedVoice(e.target.value)}
            style={{
              fontSize: '13px', padding: '6px 10px', borderRadius: '8px',
              border: '1px solid #ddd', background: 'white', color: '#555',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {EDGE_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </>
      ) : (
        <div style={{ flex: 1, fontSize: '15px', color: '#888' }}>
          📅 날짜를 선택하면 그날의 문장을 학습합니다.
        </div>
      )}
    </div>
  );

  // ── 연/월 이동 헬퍼 ──────────────────────────────
  const prevMonth = () => {
    if (navMonth === 1) { setNavYear(y => y - 1); setNavMonth(12); }
    else setNavMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (navMonth === 12) { setNavYear(y => y + 1); setNavMonth(1); }
    else setNavMonth(m => m + 1);
  };
  const prevYear = () => setNavYear(y => y - 1);
  const nextYear = () => setNavYear(y => y + 1);

  const filteredEntries = entries.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === navYear && m === navMonth;
  });

  // ────────────────────────────────────────────────
  // 날짜 목록 화면
  // ────────────────────────────────────────────────
  if (!selectedEntry) {
    if (entries.length === 0) {
      return (
        <div className="empty-state">
          저장된 학습 파일이 없습니다.<br />
          관리자 모드에서 문장을 추가해주세요.
        </div>
      );
    }

    const navBtnStyle: React.CSSProperties = {
      background: 'none', border: 'none', padding: '4px 8px',
      cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center',
    };
    const navLabelStyle: React.CSSProperties = {
      fontWeight: 800, fontSize: '64px', color: '#2c3e50', minWidth: '52px', textAlign: 'center',
      lineHeight: 1,
    };

    return (
      <div>
        <SlideMenu
          open={slideMenuOpen}
          onClose={() => setSlideMenuOpen(false)}
          entries={entries}
          selectedEntry={selectedEntry}
          onSelectEntry={selectEntry}
        />
        {headerBar}

        {/* 연/월 네비게이터 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px',
          marginBottom: '28px', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button style={navBtnStyle} onClick={prevYear}><IconChevronLeft size={36} /></button>
            <span style={navLabelStyle}>{navYear}</span>
            <button style={navBtnStyle} onClick={nextYear}><IconChevronRight size={36} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button style={navBtnStyle} onClick={prevMonth}><IconChevronLeft size={36} /></button>
            <span style={{ ...navLabelStyle, minWidth: '80px' }}>{navMonth}월</span>
            <button style={navBtnStyle} onClick={nextMonth}><IconChevronRight size={36} /></button>
          </div>
          <span style={{ fontSize: '14px', color: '#aaa' }}>{filteredEntries.length}개</span>
        </div>

        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb', fontSize: '15px' }}>
            이 달에 저장된 파일이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {filteredEntries.map((entry, idx) => {
              const filename = entryToFilename(entry);
              const label = entry.suffix ? `${entry.date}  (${entry.suffix}번째)` : entry.date;
              return (
                <div
                  key={idx}
                  onClick={() => selectEntry(entry)}
                  style={{
                    background: 'white', borderRadius: '14px', padding: '20px 24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
                    border: '2px solid transparent', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#a8d5a2')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', fontFamily: 'monospace' }}>
                    📄 {filename}
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>
                    {entry.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                    🗓 {label} &nbsp;·&nbsp; 📝 {entry.count}문장
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────
  // 문장 학습 화면
  // ────────────────────────────────────────────────
  return (
    <div>
      <SlideMenu
        open={slideMenuOpen}
        onClose={() => setSlideMenuOpen(false)}
        entries={entries}
        selectedEntry={selectedEntry}
        onSelectEntry={selectEntry}
      />
      {headerBar}

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</div>}

      {!loading && data.map((item, idx) => (
        <div key={idx} className="card" onClick={() => toggleCard(idx)}>
          <div className="card-header">
            <div className="english-sentence">{item.english}</div>
            <div className="card-actions" style={{ gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px', marginRight: '4px' }}>
                <button
                  onClick={(e) => playSingleSentence(item.english, idx, 'once', e)}
                  title="한 번 듣기"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '34px', height: '34px', borderRadius: '50%', border: 'none', padding: 0,
                    background: playMode === 'sentence-once' && sentencePlayIdx === idx ? '#ffe8e8' : '#f1f5f9',
                    color: playMode === 'sentence-once' && sentencePlayIdx === idx ? '#e74c3c' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: playMode === 'sentence-once' && sentencePlayIdx === idx ? '0 0 0 2px #ffcaca' : 'none',
                  }}
                  onMouseEnter={e => { if (!(playMode === 'sentence-once' && sentencePlayIdx === idx)) e.currentTarget.style.background = '#e2e8f0'; }}
                  onMouseLeave={e => { if (!(playMode === 'sentence-once' && sentencePlayIdx === idx)) e.currentTarget.style.background = '#f1f5f9'; }}
                >
                  {playMode === 'sentence-once' && sentencePlayIdx === idx ? <IconStop size={15} /> : <IconPlay size={15} />}
                </button>
                <button
                  onClick={(e) => playSingleSentence(item.english, idx, 'loop', e)}
                  title="반복 듣기"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '34px', height: '34px', borderRadius: '50%', border: 'none', padding: 0,
                    background: playMode === 'sentence-loop' && sentencePlayIdx === idx ? '#ffe8e8' : '#f1f5f9',
                    color: playMode === 'sentence-loop' && sentencePlayIdx === idx ? '#e74c3c' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: playMode === 'sentence-loop' && sentencePlayIdx === idx ? '0 0 0 2px #ffcaca' : 'none',
                  }}
                  onMouseEnter={e => { if (!(playMode === 'sentence-loop' && sentencePlayIdx === idx)) e.currentTarget.style.background = '#e2e8f0'; }}
                  onMouseLeave={e => { if (!(playMode === 'sentence-loop' && sentencePlayIdx === idx)) e.currentTarget.style.background = '#f1f5f9'; }}
                >
                  {playMode === 'sentence-loop' && sentencePlayIdx === idx ? <IconStop size={15} /> : <IconRepeat size={15} />}
                </button>
              </div>
              <button
                className="speaker-btn"
                onClick={(e) => openDetails(item, e)}
                title="문장 상세 설명 보기"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '34px', height: '34px', borderRadius: '50%', border: 'none', padding: 0,
                  background: '#fef3c7', color: '#d97706',
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
              >
                <IconBook size={16} />
              </button>
            </div>
          </div>
          <div className={`card-details ${openStates[idx] ? 'open' : ''}`}>
            <div className="card-details-inner">
              <div className="details-content">
                {item.korean && <div className="korean-translation">{item.korean}</div>}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 상세 설명 사이드바 */}
      <div className={`sidebar-overlay ${selectedDetail ? 'open' : ''}`} onClick={closeDetails} />
      <div className={`details-sidebar ${selectedDetail ? 'open' : ''}`}>
        <div className="details-sidebar-header">
          <div className="details-header-sentence">{selectedDetail?.sentence}</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setDetailGender('female')}
              style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '14px', cursor: 'pointer',
                border: '1px solid', borderColor: detailGender === 'female' ? '#e17090' : '#ddd',
                background: detailGender === 'female' ? '#fde8ef' : 'white',
                color: detailGender === 'female' ? '#c0405e' : '#888',
                fontWeight: detailGender === 'female' ? 600 : 400,
              }}
            >♀ Aria</button>
            <button
              onClick={() => setDetailGender('male')}
              style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '14px', cursor: 'pointer',
                border: '1px solid', borderColor: detailGender === 'male' ? '#5b9bd5' : '#ddd',
                background: detailGender === 'male' ? '#e8f2fd' : 'white',
                color: detailGender === 'male' ? '#2c6fb5' : '#888',
                fontWeight: detailGender === 'male' ? 600 : 400,
              }}
            >♂ Guy</button>
          </div>
          <button className="details-close-btn" onClick={closeDetails} aria-label="닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="details-sidebar-content">
          {selectedDetail && (() => {
            const blocks = parseDetailBlocks(selectedDetail.detail);
            if (blocks.length === 0) return <div className="detail-empty">저장된 상세 설명이 없습니다.</div>;
            return blocks.map((blk, bi) => (
              <div key={bi} className="detail-word-block">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: 'linear-gradient(135deg, #e8f4fd 0%, #f0e8fd 100%)', border: '1.5px solid #d0e8f8', borderRadius: '12px', padding: '12px 18px' }}>
                  <div
                    onClick={() => playWordTTS(blk.pronunciation, 'once')}
                    style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    title="클릭해서 발음 듣기"
                  >
                    <svg className="detail-speaker-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                    <span className="detail-pronunciation-text" style={{ margin: 0 }}>
                      {(() => {
                        const parts = blk.pronunciation.split(' / ');
                        const main = parts.slice(0, 3).join(' / ');
                        const meaning = parts[3];
                        return (
                          <>
                            {main}
                            {meaning && <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#64748b' }}> / {meaning}</span>}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => playWordTTS(blk.pronunciation, 'once')}
                      title="한 번 듣기"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        padding: '6px 12px', borderRadius: '20px', border: 'none',
                        background: playMode === 'word-once' && sentencePlayIdx === 999 ? '#ffe8e8' : 'white',
                        color: playMode === 'word-once' && sentencePlayIdx === 999 ? '#e74c3c' : '#64748b',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px', fontWeight: 600,
                        boxShadow: playMode === 'word-once' && sentencePlayIdx === 999 ? '0 0 0 2px #ffcaca' : '0 2px 4px rgba(0,0,0,0.05)',
                      }}
                      onMouseEnter={e => { if (!(playMode === 'word-once' && sentencePlayIdx === 999)) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (!(playMode === 'word-once' && sentencePlayIdx === 999)) e.currentTarget.style.background = 'white'; }}
                    >
                      {playMode === 'word-once' && sentencePlayIdx === 999 ? <IconStop size={14} /> : <IconPlay size={14} />} 한 번
                    </button>
                    <button
                      onClick={() => playWordTTS(blk.pronunciation, 'loop')}
                      title="반복 듣기"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        padding: '6px 12px', borderRadius: '20px', border: 'none',
                        background: playMode === 'word-loop' && sentencePlayIdx === 999 ? '#ffe8e8' : 'white',
                        color: playMode === 'word-loop' && sentencePlayIdx === 999 ? '#e74c3c' : '#64748b',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px', fontWeight: 600,
                        boxShadow: playMode === 'word-loop' && sentencePlayIdx === 999 ? '0 0 0 2px #ffcaca' : '0 2px 4px rgba(0,0,0,0.05)',
                      }}
                      onMouseEnter={e => { if (!(playMode === 'word-loop' && sentencePlayIdx === 999)) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (!(playMode === 'word-loop' && sentencePlayIdx === 999)) e.currentTarget.style.background = 'white'; }}
                    >
                      {playMode === 'word-loop' && sentencePlayIdx === 999 ? <IconStop size={14} /> : <IconRepeat size={14} />} 반복
                    </button>
                  </div>
                </div>
                <div className="detail-examples">
                  {(blk.pos || blk.conjugation) && (
                    <div className="detail-meta-row">
                      {blk.pos && <span className="detail-ex-pos">{blk.pos}</span>}
                      {blk.conjugation && (() => {
                        const conjText = blk.conjugation!.replace(/ \/ /g, ', ');
                        const conjPlaying = sentencePlayIdx === 998;
                        return (
                          <span
                            className={`detail-ex-conj${conjPlaying ? ' detail-ex-conj--playing' : ''}`}
                            onClick={() => playWordTTS(blk.conjugation!, 'once', conjText, 998)}
                            title="클릭해서 발음 듣기"
                          >
                            {blk.conjugation}
                            <button
                              className="detail-conj-repeat"
                              onClick={(e) => { e.stopPropagation(); playWordTTS(blk.conjugation!, 'loop', conjText, 998); }}
                              title="반복 듣기"
                            >
                              {conjPlaying && playMode === 'word-loop' ? <IconStop size={11} /> : <IconRepeat size={11} />}
                            </button>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  {blk.enExamples.map((line: string, li: number) => (
                    <p key={`en-${li}`} className="detail-ex-en">{line}</p>
                  ))}
                  {blk.zhExamples.map((line: string, li: number) => (
                    <p key={`zh-${li}`} className="detail-ex-ko">{line}</p>
                  ))}
                  {blk.extras.map((para: string[], pi: number) => (
                    <div key={`extra-${pi}`} className="detail-extra-box">
                      {para.map((line: string, li: number) => (
                        <p key={li} className="detail-extra-line">{line}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
