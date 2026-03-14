const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/', (req, res) => res.json({ status: 'Nervless proxy running' }));

// Whisper transcription
app.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    const form = new FormData();
    const isMP4 = req.file.mimetype && req.file.mimetype.includes('mp4');
    const filename = isMP4 ? 'recording.mp4' : 'recording.webm';
    form.append('file', req.file.buffer, {
      filename,
      contentType: req.file.mimetype || 'audio/webm'
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Whisper error:', err);
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Claude analysis
app.post('/analyse', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude error:', err);
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Analyse error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Nervless proxy running on port ' + PORT));

// ── KEEP ALIVE ──
// Pings itself every 14 minutes so Render free tier never sleeps
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
setInterval(async () => {
  try {
    await fetch(SELF_URL + '/');
    console.log('Keep-alive ping sent');
  } catch (err) {
    console.log('Keep-alive ping failed:', err.message);
  }
}, 14 * 60 * 1000);
