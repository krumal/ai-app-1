const fs = require('fs');
const http = require('http');
const path = require('path');

const SESSION_DIR = process.env.PLANACT_VC_DIR;
const HOST = process.env.PLANACT_VC_HOST || '127.0.0.1';
const URL_HOST = process.env.PLANACT_VC_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const PORT = process.env.PLANACT_VC_PORT || (49152 + Math.floor(Math.random() * 16383));

if (!SESSION_DIR) {
  console.error(JSON.stringify({ error: 'Missing PLANACT_VC_DIR' }));
  process.exit(1);
}

const STATE_DIR = path.join(SESSION_DIR, 'state');
const CONTENT_DIR = path.join(SESSION_DIR, 'content');
const SESSION_FILE = path.join(STATE_DIR, 'session.json');
const ANSWERS_FILE = path.join(STATE_DIR, 'answers.json');
const STATUS_FILE = path.join(STATE_DIR, 'status.json');
const COMPLETED_FILE = path.join(STATE_DIR, 'completed.json');
const EVENTS_FILE = path.join(STATE_DIR, 'events.jsonl');
const SERVER_INFO_FILE = path.join(STATE_DIR, 'server-info.json');

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.mkdirSync(CONTENT_DIR, { recursive: true });

const template = fs.readFileSync(path.join(__dirname, 'frame-template.html'), 'utf8');
const helperJs = fs.readFileSync(path.join(__dirname, 'helper.js'), 'utf8');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function sessionData() {
  return readJson(SESSION_FILE, {
    session_title: 'PlanAct Visual Companion',
    session_intro: 'Waiting for session.json to be written.',
    ui_language: 'en',
    decisions: [],
    completion_rule: 'all_required_decisions_answered'
  });
}

function answersData() {
  return readJson(ANSWERS_FILE, {});
}

function answerIsMeaningful(answer) {
  const selected = Array.isArray(answer.selected_option_ids) ? answer.selected_option_ids : [];
  return selected.length > 0;
}

function buildStatus(session, answers) {
  const requiredDecisions = session.decisions.filter((decision) => decision.required !== false);
  const submittedRequiredCount = requiredDecisions.filter((decision) => answers[decision.id] && answerIsMeaningful(answers[decision.id])).length;
  return {
    completion_rule: session.completion_rule || 'all_required_decisions_answered',
    required_count: requiredDecisions.length,
    submitted_required_count: submittedRequiredCount,
    completed: submittedRequiredCount === requiredDecisions.length,
    updated_at: new Date().toISOString()
  };
}

function appendEvent(event) {
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendHtml(res) {
  const html = template.replace('</body>', `<script>${helperJs}</script></body>`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendPreview(req, res) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const fileName = decodeURIComponent(requestUrl.pathname.slice('/content/'.length));
  if (!fileName || fileName !== path.basename(fileName) || path.extname(fileName).toLowerCase() !== '.html') {
    sendJson(res, 400, { error: 'Invalid preview file' });
    return;
  }

  const filePath = path.join(CONTENT_DIR, fileName);
  try {
    if (!fs.statSync(filePath).isFile()) {
      throw new Error('Not a file');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    sendJson(res, 404, { error: 'Preview not found' });
  }
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function validateSubmission(session, payload) {
  const decision = session.decisions.find((item) => item.id === payload.decision_id);
  if (!decision) {
    return { ok: false, error: 'Unknown decision_id' };
  }

  const selectedOptionIds = Array.isArray(payload.selected_option_ids) ? payload.selected_option_ids : [];
  const note = typeof payload.note === 'string' ? payload.note : '';
  const knownOptionIds = new Set((decision.options || []).map((option) => option.id));

  for (const optionId of selectedOptionIds) {
    if (!knownOptionIds.has(optionId)) {
      return { ok: false, error: 'Unknown option id for decision ' + decision.id };
    }
  }

  if (decision.type !== 'multi_choice' && selectedOptionIds.length > 1) {
    return { ok: false, error: 'Only one option can be selected for decision ' + decision.id };
  }

  const answer = {
    selected_option_ids: selectedOptionIds,
    note,
    submitted_at: new Date().toISOString()
  };

  if (!answerIsMeaningful(answer)) {
    return { ok: false, error: 'Decision is missing a selected option' };
  }

  return { ok: true, decision, answer };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    sendHtml(res);
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/content/')) {
    sendPreview(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/session') {
    sendJson(res, 200, sessionData());
    return;
  }

  if (req.method === 'GET' && req.url === '/api/answers') {
    sendJson(res, 200, answersData());
    return;
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    const session = sessionData();
    const answers = answersData();
    const status = buildStatus(session, answers);
    writeJson(STATUS_FILE, status);
    sendJson(res, 200, status);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/submit-decision') {
    try {
      const body = await collectBody(req);
      const payload = JSON.parse(body || '{}');
      const session = sessionData();
      const answers = answersData();
      const validation = validateSubmission(session, payload);

      if (!validation.ok) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      answers[validation.decision.id] = validation.answer;
      writeJson(ANSWERS_FILE, answers);
      appendEvent({
        type: 'decision_submitted',
        decision_id: validation.decision.id,
        selected_option_ids: validation.answer.selected_option_ids,
        note: validation.answer.note,
        submitted_at: validation.answer.submitted_at
      });

      const status = buildStatus(session, answers);
      writeJson(STATUS_FILE, status);
      if (status.completed) {
        writeJson(COMPLETED_FILE, {
          completed: true,
          completed_at: new Date().toISOString(),
          answers_file: ANSWERS_FILE
        });
      }

      sendJson(res, 200, { ok: true, answers, status });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  const info = {
    type: 'server-started',
    host: HOST,
    url_host: URL_HOST,
    port: Number(PORT),
    url: `http://${URL_HOST}:${PORT}`,
    session_dir: SESSION_DIR,
    state_dir: STATE_DIR,
    content_dir: CONTENT_DIR
  };

  writeJson(SERVER_INFO_FILE, info);
  console.log(JSON.stringify(info));
});
