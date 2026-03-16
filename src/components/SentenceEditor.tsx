import { SentenceData } from '../types';

interface Props {
    index: number;
    total: number;
    data: SentenceData;
    onUpdate: (field: keyof SentenceData, val: string) => void;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
}

export default function SentenceEditor({ index, total, data, onUpdate, onRemove, onMove }: Props) {
    return (
        <div className="sentence-edit-item" style={{position: 'relative'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3 style={{margin: 0}}>문장 {index + 1}</h3>
                <div>
                    <button 
                        onClick={() => onMove('up')} 
                        disabled={index === 0}
                        style={{padding: '6px 10px', fontSize: '12px', marginRight: '5px', borderRadius: '6px', opacity: index === 0 ? 0.3 : 1}}
                    >⬆️</button>
                    <button 
                        onClick={() => onMove('down')} 
                        disabled={index === total - 1}
                        style={{padding: '6px 10px', fontSize: '12px', marginRight: '15px', borderRadius: '6px', opacity: index === total - 1 ? 0.3 : 1}}
                    >⬇️</button>
                    <button onClick={onRemove} style={{backgroundColor: '#e74c3c', padding: '6px 10px', fontSize: '12px', borderRadius: '6px'}}>삭제</button>
                </div>
            </div>
            
            <div className="input-group">
                <label>영어 문장</label>
                <input 
                    type="text" 
                    value={data.english} 
                    onChange={e => onUpdate('english', e.target.value)} 
                />
            </div>
            <div className="input-group">
                <label>번역(한글/중국어 등)</label>
                <input 
                    type="text" 
                    value={data.korean} 
                    onChange={e => onUpdate('korean', e.target.value)} 
                    placeholder="예: 안녕하세요! 만나서 반가워요."
                />
            </div>
            <div className="input-group">
                <label>상세 설명 (학습자 모드 패널에 표시됨)</label>
                <textarea 
                    value={data.details || ''} 
                    onChange={e => onUpdate('details', e.target.value)} 
                    placeholder="예: 이 문장은 과거완료 시제를 사용하여..."
                    style={{ height: '80px', marginBottom: '0' }}
                />
            </div>
        </div>
    );
}
