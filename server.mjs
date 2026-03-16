import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const jsonDir = path.join(__dirname, 'public', 'json');
const indexPath = path.join(jsonDir, 'index.json');
const audioDir = path.join(__dirname, 'public', 'audio');

function ensureJsonDir() {
    if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
}

function readIndex() {
    if (!fs.existsSync(indexPath)) return [];
    try { return JSON.parse(fs.readFileSync(indexPath, 'utf-8')); }
    catch { return []; }
}

function writeIndex(entries) {
    fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
}

/** index.json에서 해당 파일명의 항목을 찾거나 추가/갱신 */
function upsertIndexEntry(filename, title, count) {
    const entries = readIndex();
    const base = filename.replace(/\.json$/, '');       // e.g. "2026-03-16-2"
    const parts = base.split('-');
    // 날짜 파트: YYYY-MM-DD (앞 3 세그먼트), 나머지가 suffix
    const dateParts = parts.slice(0, 3).join('-');
    const suffix = parts.length > 3 ? parts.slice(3).join('-') : undefined;

    const idx = entries.findIndex(e => {
        const eSuffix = e.suffix;
        return e.date === dateParts && (eSuffix === suffix || (!eSuffix && !suffix));
    });

    const newEntry = { date: dateParts, title, count };
    if (suffix) newEntry.suffix = suffix;

    if (idx >= 0) {
        entries[idx] = newEntry;
    } else {
        entries.push(newEntry);
    }

    // 날짜 + suffix 순으로 정렬
    entries.sort((a, b) => {
        const ka = `${a.date}-${a.suffix || ''}`;
        const kb = `${b.date}-${b.suffix || ''}`;
        return ka.localeCompare(kb);
    });

    writeIndex(entries);
}

// GET /api/index — index.json 반환
app.get('/api/index', (_req, res) => {
    ensureJsonDir();
    res.json(readIndex());
});

// GET /api/files — json/ 내 파일 목록
app.get('/api/files', (_req, res) => {
    ensureJsonDir();
    const files = fs.readdirSync(jsonDir)
        .filter(f => f.endsWith('.json') && f !== 'index.json');
    res.json(files.sort());
});

// GET /api/files/:filename — 파일 내용 반환
app.get('/api/files/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const safeName = filename.endsWith('.json') ? filename : `${filename}.json`;
        const filePath = path.join(jsonDir, safeName);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        res.json(content);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/save — 날짜 파일 저장 + index.json 갱신
app.post('/api/save', (req, res) => {
    try {
        ensureJsonDir();
        const { filename, action, title, sentences } = req.body;

        if (!filename) return res.status(400).json({ error: 'Filename required' });

        const safeName = filename.endsWith('.json') ? filename : `${filename}.json`;
        const filePath = path.join(jsonDir, safeName);

        const validSentences = (sentences || []).filter(s => s.english?.trim());

        let finalSentences = validSentences;

        // action === 'append': 기존 파일 맨 뒤에 추가
        if (action === 'append' && fs.existsSync(filePath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const existingArr = existing.sentences || (Array.isArray(existing) ? existing : []);
                finalSentences = [...existingArr, ...validSentences];
            } catch {
                console.warn('Failed to parse existing file, overwriting');
            }
        }

        const dateBase = safeName.replace(/\.json$/, '').split('-').slice(0, 3).join('-');
        const dayTitle = title || dateBase;

        const fileContent = {
            date: dateBase,
            title: dayTitle,
            sentences: finalSentences
        };

        fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2), 'utf-8');

        // index.json 자동 갱신
        upsertIndexEntry(safeName, dayTitle, finalSentences.length);

        res.json({ success: true, message: 'Saved', count: finalSentences.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/files/:filename — 파일 삭제 + index.json 갱신
app.delete('/api/files/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const safeName = filename.endsWith('.json') ? filename : `${filename}.json`;
        const filePath = path.join(jsonDir, safeName);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        fs.unlinkSync(filePath);

        // index.json에서 해당 항목 제거
        const base = safeName.replace(/\.json$/, '');
        const parts = base.split('-');
        const dateParts = parts.slice(0, 3).join('-');
        const suffix = parts.length > 3 ? parts.slice(3).join('-') : undefined;
        const entries = readIndex().filter(e => {
            return !(e.date === dateParts && (e.suffix === suffix || (!e.suffix && !suffix)));
        });
        writeIndex(entries);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tts — msedge-tts 음성 합성 + 캐싱
app.post('/api/tts', async (req, res) => {
    const { text, voice = 'en-US-JennyMultilingualNeural', locale } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });

    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const hash = createHash('sha256').update(text + voice + (locale || '')).digest('hex').slice(0, 16);
    const cachePath = path.join(audioDir, `${hash}.mp3`);

    if (fs.existsSync(cachePath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return fs.createReadStream(cachePath).pipe(res);
    }

    try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(text);

        const chunks = [];
        audioStream.on('data', chunk => chunks.push(chunk));
        audioStream.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (buf.length === 0) {
                console.error('TTS returned empty audio for voice:', voice);
                return res.status(500).json({ error: 'TTS returned empty audio' });
            }
            fs.writeFile(cachePath, buf, err => { if (err) console.error('Cache write error:', err); });
            res.setHeader('Content-Type', 'audio/mpeg');
            res.end(buf);
        });
        audioStream.on('error', err => {
            console.error('TTS stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'TTS failed' });
        });
    } catch (err) {
        console.error('TTS error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` Backend Server running on http://localhost:${PORT}`);
    console.log(` Serves API for managing JSON lesson files`);
    console.log(`================================================================`);
});
