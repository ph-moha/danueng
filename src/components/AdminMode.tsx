import { useState, useEffect } from 'react';
import { SentenceData, DayEntry, DayFile, entryToFilename } from '../types';
import SentenceEditor from './SentenceEditor';
import SlideMenu from './SlideMenu';

// ── 아이콘 ──────────────────────────────────────────
const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

/** 오늘 날짜를 YYYY-MM-DD 형태로 반환 */
function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 특정 날짜의 기존 파일명 목록에서 다음 suffix 계산
 *  예) ["2026-03-16.json", "2026-03-16-2.json"] → "2026-03-16-3" */
function nextFilenameForDate(date: string, existingFiles: string[]): string {
    const sameDay = existingFiles
        .map(f => f.replace(/\.json$/, ''))
        .filter(n => n === date || n.startsWith(`${date}-`));

    if (sameDay.length === 0) return date;

    // suffix 숫자 추출
    const suffixes = sameDay.map(n => {
        if (n === date) return 1;
        const rest = n.slice(date.length + 1);
        const num = parseInt(rest, 10);
        return isNaN(num) ? 1 : num;
    });
    const next = Math.max(...suffixes) + 1;
    return `${date}-${next}`;
}

/**
 * 텍스트를 마침표(. ! ? 。 ？ ！) 기준으로 문장 분리
 * - 영어: 마침표 뒤 공백으로 분리
 * - 중국어 。？！: 뒤에 공백이 없어도 분리 (전각 문자)
 */
function splitBySentence(text: string): string[] {
    if (!text.trim()) return [];
    // 1단계: 중국어 전각 문장부호(。？！) 뒤에서 분리 (공백 유무 무관)
    const step1 = text.split(/(?<=[。？！])/).map(s => s.trim()).filter(s => s.length > 0);
    // 2단계: 각 조각을 영어 마침표(.!?) 기준으로 추가 분리
    const result: string[] = [];
    for (const chunk of step1) {
        try {
            const parts = chunk.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
            result.push(...parts);
        } catch {
            result.push(chunk);
        }
    }
    return result;
}

/**
 * 텍스트를 "빈 줄 3줄" 단위로 분리
 * - 빈 줄 3줄(=\n 4개) = 1 구분자 → 다음 문장
 * - 빈 줄 6줄(=\n 7개) = 2 구분자 → 두 칸 뒤 문장 (중간 빈 슬롯 보존)
 * - "==" 단독 블록 → 빈 슬롯 (해당 문장 상세 설명 없음 명시)
 * - trailing 빈 항목만 제거, leading/내부 빈 항목은 보존
 */
function splitByBlankLines(text: string): string[] {
    if (!text.trim()) return [];
    const SEP = '\x00';
    // 연속 \n 개수로 구분자 개수 계산: floor((n-1)/3)
    const normalized = text.replace(/\n{4,}/g, (match) => {
        const count = Math.floor((match.length - 1) / 3);
        return SEP.repeat(count);
    });
    const parts = normalized.split(SEP).map(s => {
        const t = s.trim();
        return t === '==' ? '' : t;  // == 마커 → 빈 슬롯
    });
    // trailing 빈 항목만 제거 (말미 실수 개행 방지)
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts;
}

export default function AdminMode() {
    const [englishScript, setEnglishScript] = useState('');
    const [koreanScript, setKoreanScript] = useState('');
    const [detailsScript, setDetailsScript] = useState('');
    const [parsedPreview, setParsedPreview] = useState<{ english: string, korean: string, details: string }[]>([]);
    const [sentences, setSentences] = useState<SentenceData[]>([]);
    const [titleInput, setTitleInput] = useState('');

    // 파일 관리 상태
    const [existingFiles, setExistingFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');

    // 슬라이드 메뉴
    const [slideMenuOpen, setSlideMenuOpen] = useState(false);
    const [entries, setEntries] = useState<DayEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<DayEntry | null>(null);

    useEffect(() => {
        fetchFilesList();
        // index.json 로드 (캐시 없는 API 사용)
        fetch('/api/index')
            .then(res => res.json())
            .then((json: DayEntry[]) => setEntries([...json].reverse()))
            .catch(() => {});
    }, []);

    // Live parsing — 영어/번역: 마침표 기준, 상세 설명: 빈줄 3줄 초과 기준
    useEffect(() => {
        const eng = splitBySentence(englishScript);
        const kor = splitBySentence(koreanScript);
        const det = splitByBlankLines(detailsScript);
        const maxLen = Math.max(eng.length, kor.length, det.length);
        const preview = [];
        for (let i = 0; i < maxLen; i++) {
            preview.push({
                english: eng[i] || '',
                korean: kor[i] || '',
                details: det[i] || '',
            });
        }
        setParsedPreview(preview);
    }, [englishScript, koreanScript, detailsScript]);

    const fetchFilesList = async () => {
        try {
            const res = await fetch('/api/files');
            if (res.ok) {
                const files: string[] = await res.json();
                setExistingFiles(files);
            }
        } catch { console.warn('Could not fetch file list'); }
    };

    const loadExistingFile = async (fname: string) => {
        try {
            const res = await fetch(`/api/files/${fname}`);
            if (!res.ok) { alert('파일을 불러오지 못했습니다.'); return; }
            const data = await res.json();
            // 새 포맷(DayFile)과 구 포맷(배열) 모두 지원
            const loaded: DayFile = Array.isArray(data)
                ? { date: '', title: '', sentences: data }
                : data;
            setSentences(loaded.sentences || []);
            if (loaded.title) setTitleInput(loaded.title);
        } catch { alert('서버 연결 오류.'); }
    };

    const resetAll = () => {
        setSentences([]);
        setTitleInput('');
        setEnglishScript('');
        setKoreanScript('');
        setDetailsScript('');
        setSelectedFile('');
        setSelectedEntry(null);
    };

    const handleNewPost = () => {
        const hasContent = sentences.length > 0 || titleInput || englishScript || koreanScript || detailsScript;
        if (hasContent) {
            if (!window.confirm('현재 편집 내용이 사라집니다. 계속하시겠습니까?')) return;
        }
        resetAll();
    };

    const handleCommitToEditor = () => {
        if (parsedPreview.length === 0) { alert('파싱된 문장이 없습니다.'); return; }
        const newItems: SentenceData[] = parsedPreview.map(p => ({
            english: p.english,
            korean: p.korean,
            details: p.details,
        }));
        if (sentences.length > 0) {
            if (window.confirm('기존 편집 데이터가 있습니다. 맨 아래에 추가할까요? (취소 시 덮어쓰기)')) {
                setSentences([...sentences, ...newItems]);
            } else {
                setSentences(newItems);
            }
        } else {
            setSentences(newItems);
        }
        setEnglishScript('');
        setKoreanScript('');
        setDetailsScript('');
        alert('편집기로 문장들이 이동되었습니다.');
    };

    const updateSentence = (index: number, field: keyof SentenceData, value: string) => {
        const updated = [...sentences];
        updated[index][field] = value;
        setSentences(updated);
    };

    const removeSentence = (index: number) => {
        if (window.confirm('이 문장을 삭제할까요?')) {
            const updated = [...sentences];
            updated.splice(index, 1);
            setSentences(updated);
        }
    };

    const moveSentence = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sentences.length - 1) return;
        const updated = [...sentences];
        const target = direction === 'up' ? index - 1 : index + 1;
        [updated[index], updated[target]] = [updated[target], updated[index]];
        setSentences(updated);
    };

    const handleSaveToServer = async () => {
        const validSentences = sentences.filter(s => s.english.trim().length > 0);
        if (validSentences.length === 0) { alert('저장할 문장이 없습니다.'); return; }

        let finalFilename: string;

        if (selectedFile) {
            // 수정 모드: 같은 파일 덮어쓰기
            finalFilename = selectedFile.replace(/\.json$/, '');
        } else {
            // 새글 모드: 오늘 날짜로 새 파일 (중복 시 자동 suffix)
            const today = todayStr();
            finalFilename = nextFilenameForDate(today, existingFiles);
        }

        const dateBase = finalFilename.split('-').slice(0, 3).join('-');
        const title = titleInput.trim() || dateBase;

        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: finalFilename, action: 'create', title, sentences: validSentences })
            });
            if (res.ok) {
                const result = await res.json();
                alert(`저장 완료! (/json/${finalFilename}.json, 총 ${result.count}문장)`);
                fetchFilesList();
                // entries 새로 로드
                const idx = await fetch('/api/index').then(r => r.json()).catch(() => []);
                setEntries([...idx].reverse());
                // 저장 완료 후 모든 영역 리셋
                resetAll();
            } else {
                const err = await res.json();
                alert(`서버 저장 실패: ${err.error}`);
            }
        } catch {
            alert('Node.js 백엔드 서버가 켜져있지 않습니다.\nnpm run server 로 백엔드를 켜주세요!');
        }
    };

    const handleMenuSelectEntry = (entry: DayEntry) => {
        setSelectedEntry(entry);
        const fname = entryToFilename(entry);
        setSelectedFile(fname);
        loadExistingFile(fname);
        setSlideMenuOpen(false);
    };

    const handleMenuEdit = (entry: DayEntry) => {
        const fname = entryToFilename(entry);
        setSelectedFile(fname);
        setSelectedEntry(entry);
        loadExistingFile(fname);
        setSlideMenuOpen(false);
    };

    const handleMenuDelete = async (entry: DayEntry) => {
        const fname = entryToFilename(entry);
        if (!window.confirm(`"${entry.title}" (${fname}) 파일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        try {
            const res = await fetch(`/api/files/${fname}`, { method: 'DELETE' });
            if (res.ok) {
                fetchFilesList();
                // entries 새로 로드
                const idx = await fetch('/api/index').then(r => r.json()).catch(() => []);
                setEntries([...idx].reverse());
                if (selectedEntry?.date === entry.date && selectedEntry?.suffix === entry.suffix) {
                    setSelectedEntry(null);
                    setSelectedFile('');
                }
                alert(`${fname} 삭제 완료`);
            } else {
                alert('삭제 실패: 서버 오류');
            }
        } catch {
            alert('삭제 실패: 백엔드 서버가 켜져있지 않습니다.');
        }
    };

    const handleMenuDeleteMultiple = async (entriesToDelete: DayEntry[]) => {
        if (entriesToDelete.length === 0) return;
        const fnames = entriesToDelete.map(entryToFilename);
        const titles = entriesToDelete.map(e => e.title).join(', ');
        if (!window.confirm(`${fnames.length}개 파일을 삭제하시겠습니까?\n${titles}\n\n이 작업은 되돌릴 수 없습니다.`)) return;

        let failCount = 0;
        for (const fname of fnames) {
            try {
                const res = await fetch(`/api/files/${fname}`, { method: 'DELETE' });
                if (!res.ok) failCount++;
            } catch {
                failCount++;
            }
        }

        fetchFilesList();
        const idx = await fetch('/api/index').then(r => r.json()).catch(() => []);
        setEntries([...idx].reverse());

        if (selectedEntry) {
            const wasDeleted = entriesToDelete.some(
                e => e.date === selectedEntry.date && e.suffix === selectedEntry.suffix
            );
            if (wasDeleted) {
                setSelectedEntry(null);
                setSelectedFile('');
            }
        }

        if (failCount > 0) {
            alert(`${fnames.length - failCount}개 삭제 완료, ${failCount}개 실패`);
        } else {
            alert(`${fnames.length}개 삭제 완료`);
        }
    };

    return (
        <>
        <SlideMenu
            open={slideMenuOpen}
            onClose={() => setSlideMenuOpen(false)}
            entries={entries}
            selectedEntry={selectedEntry}
            onSelectEntry={handleMenuSelectEntry}
            isAdmin={true}
            onEdit={handleMenuEdit}
            onDelete={handleMenuDelete}
            onDeleteMultiple={handleMenuDeleteMultiple}
        />
        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            {/* Left Column */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* 파일 관리 헤더 */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px',
                    padding: '12px 16px', background: 'white', borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)', border: '1px solid #ddd', flexWrap: 'wrap'
                }}>
                    <button
                        onClick={() => setSlideMenuOpen(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'white', border: '1px solid #ddd', borderRadius: '8px',
                            padding: '7px 12px', cursor: 'pointer', color: '#555', fontSize: '13px',
                        }}
                        title="파일 목록 열기"
                    >
                        <IconMenu /> 파일 목록
                    </button>
                    <button
                        onClick={handleNewPost}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: '#27ae60', border: 'none', borderRadius: '8px',
                            padding: '7px 14px', cursor: 'pointer', color: 'white',
                            fontSize: '13px', fontWeight: 'bold',
                        }}
                    >
                        ✏️ 새글 쓰기
                    </button>
                    <div style={{
                        flex: 1, minWidth: '150px', padding: '6px 10px',
                        background: '#f0f4f8', borderRadius: '6px', fontSize: '13px',
                        color: selectedFile ? '#2c3e50' : '#95a5a6',
                    }}>
                        {selectedFile ? `📝 편집 중: ${selectedFile}` : '📄 새 파일 작성'}
                    </div>
                    <input
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        placeholder="제목 입력..."
                        style={{
                            flex: 2, minWidth: '180px', padding: '7px 10px',
                            borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px',
                        }}
                    />
                    <button
                        onClick={handleSaveToServer}
                        style={{
                            backgroundColor: '#3498db', color: 'white', border: 'none',
                            fontSize: '14px', padding: '8px 18px', borderRadius: '8px',
                            cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap',
                        }}
                    >
                        💾 저장
                    </button>
                </div>

                {/* 2. 스크립트 입력 */}
                <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>📝 영어 / 번역 / 상세 설명 스크립트 입력</h3>
                    <div className="help-text" style={{ marginBottom: '15px' }}>
                        스크립트를 붙여넣으세요. 영어/번역은 <strong>마침표( . ! ? 。 ？ ！)</strong>를 기준으로, 상세 설명은 <strong>빈 줄 3줄 단위</strong>로 분리됩니다. 건너뛸 문장은 <code>==</code> 로 표시하세요 (6줄 빈줄 → 2칸 이동).
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>영어 스크립트</label>
                            <textarea
                                value={englishScript}
                                onChange={(e) => setEnglishScript(e.target.value)}
                                placeholder={"영어 텍스트를 붙여넣으세요.\n마침표(. ! ?)를 기준으로 문장이 분리됩니다."}
                                style={{ height: '300px' }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>번역 스크립트 (한글/중국어)</label>
                            <textarea
                                value={koreanScript}
                                onChange={(e) => setKoreanScript(e.target.value)}
                                placeholder={"번역 텍스트를 붙여넣으세요.\n마침표(. ! ? 。)를 기준으로 문장이 분리됩니다."}
                                style={{ height: '300px' }}
                            />
                        </div>
                    </div>

                    {/* 상세 설명 입력 — 영어/번역 아래 전체 너비 */}
                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#8e44ad' }}>
                            📖 상세 설명 스크립트
                            <span style={{ fontWeight: 'normal', fontSize: '13px', color: '#999', marginLeft: '10px' }}>
                                빈 줄 3줄 단위 구분 | 6줄 → 2칸 이동 | <code>==</code> 단독 → 해당 문장 건너뜀
                            </span>
                        </label>
                        <textarea
                            value={detailsScript}
                            onChange={(e) => setDetailsScript(e.target.value)}
                            placeholder={"첫 번째 문장의 상세 설명\n\n\n\n두 번째 문장의 상세 설명\n\n\n\n세 번째는 건너뜀 (== 사용):\n==\n\n\n\n네 번째 문장의 상세 설명"}
                            style={{ height: '800px', borderColor: '#c39bd3' }}
                        />
                    </div>
                </div>

                {/* 3. 상세 편집 */}
                <div id="edit-container" style={{ borderTop: '2px dashed #ccc', paddingTop: '30px' }}>
                    <h2 style={{ marginBottom: '20px' }}>✍️ 문장 상세 편집</h2>
                    {sentences.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                            편집할 문장이 없습니다. 우측 미리보기에서 '편집기 채우기' 버튼을 누르거나 기존 파일을 불러오세요.
                        </div>
                    )}
                    {sentences.map((item, idx) => (
                        <SentenceEditor
                            key={idx}
                            index={idx}
                            data={item}
                            total={sentences.length}
                            onUpdate={(field, val) => updateSentence(idx, field, val)}
                            onRemove={() => removeSentence(idx)}
                            onMove={(dir) => moveSentence(idx, dir)}
                        />
                    ))}
                </div>
            </div>

            {/* Right Column: 실시간 미리보기 */}
            <div style={{
                width: '450px', flexShrink: 0, position: 'sticky', top: '20px',
                height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
                background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', padding: '20px'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>👀 실시간 문장 파싱 미리보기</h3>
                <div style={{
                    flex: 1, overflowY: 'auto', backgroundColor: 'white',
                    border: '1px solid #ddd', borderRadius: '8px', padding: '10px', marginBottom: '15px'
                }}>
                    {parsedPreview.map((p, idx) => (
                        <div key={idx} style={{ padding: '12px', borderBottom: idx < parsedPreview.length - 1 ? '1px solid #eee' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <div style={{ width: '30px', fontWeight: 'bold', color: '#adb5bd', fontSize: '14px', flexShrink: 0 }}>{idx + 1}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
                                        {p.english || <span style={{ color: '#ccc' }}>(영어 없음)</span>}
                                    </div>
                                    <div style={{ color: '#7f8c8d', fontSize: '13px', marginBottom: p.details ? '6px' : '0' }}>
                                        {p.korean || <span style={{ color: '#ccc' }}>(번역 없음)</span>}
                                    </div>
                                    {p.details && (
                                        <div style={{ color: '#8e44ad', fontSize: '12px', backgroundColor: '#f9f0ff', borderRadius: '6px', padding: '6px 8px', borderLeft: '3px solid #c39bd3' }}>
                                            {p.details}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {parsedPreview.length === 0 && (
                        <div style={{ color: '#aab7c4', textAlign: 'center', padding: '40px 20px', fontSize: '15px' }}>
                            왼쪽 입력창에 스크립트를 넣으면<br />여기에 파싱된 문장들이 나타납니다.
                        </div>
                    )}
                </div>
                <button
                    onClick={handleCommitToEditor}
                    disabled={parsedPreview.length === 0}
                    style={{
                        width: '100%',
                        backgroundColor: parsedPreview.length === 0 ? '#bdc3c7' : 'var(--success-color)',
                        fontSize: '18px', padding: '16px', cursor: parsedPreview.length === 0 ? 'not-allowed' : 'pointer',
                        border: 'none', color: 'white', borderRadius: '12px'
                    }}
                >
                    ⬇️ 이 내용으로 편집기 채우기
                </button>
            </div>
        </div>
        </>
    );
}
