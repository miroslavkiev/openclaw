#!/usr/bin/env node

/**
 * Local webhook receiver for gog gmail watch serve.
 * Creates Gmail drafts for work inbox based on heuristics + LLM-assisted reply.
 *
 * Endpoint: POST /gmail-work
 * Auth: Authorization: Bearer <HOOK_TOKEN>
 */

const http = require('http');

const PORT = Number(process.env.PORT || 18990);
const HOOK_TOKEN = process.env.HOOK_TOKEN || '';
const WORK_ACCOUNT = process.env.WORK_ACCOUNT || 'krmy@ciklum.com';
const WORK_RECIPIENTS = (process.env.WORK_RECIPIENTS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const GOG_BIN = process.env.GOG_BIN || '/opt/homebrew/bin/gog';
const GOG_CLIENT = process.env.GOG_CLIENT || 'work';
const CLAWDBOT_BIN = process.env.CLAWDBOT_BIN || '/opt/homebrew/bin/clawdbot';
const FROM_ALIAS = process.env.FROM_ALIAS || 'myroslav.kravchenko@ciklum.com';

function json(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function extractEmail(addr) {
  if (!addr) return '';
  const m = String(addr).match(/<([^>]+)>/);
  return (m ? m[1] : String(addr)).trim();
}

function extractDisplayName(addr) {
  if (!addr) return '';
  const s = String(addr).trim();
  // "Name <email>" -> Name
  const m = s.match(/^\s*([^<]+?)\s*<[^>]+>\s*$/);
  const name = (m ? m[1] : '').trim();
  // If it's just an email address, return empty
  if (name && !name.includes('@')) return name;
  return '';
}

function extractAllEmails(headerValue) {
  const s = String(headerValue || '');
  const out = new Set();
  // Grab <...> emails
  for (const m of s.matchAll(/<([^>]+)>/g)) {
    out.add(String(m[1] || '').trim().toLowerCase());
  }
  // Also handle plain tokens separated by commas/semicolons
  for (const part of s.split(/[,;]+/)) {
    const t = part.trim();
    if (!t) continue;
    // remove surrounding quotes
    const cleaned = t.replace(/^"|"$/g, '').trim();
    if (cleaned.includes('@') && !cleaned.includes(' ')) {
      out.add(cleaned.toLowerCase());
    }
  }
  return Array.from(out).filter(Boolean);
}

function isAllowedSender(fromEmail) {
  const lower = fromEmail.toLowerCase();
  return lower.endsWith('@ciklum.com') || lower.endsWith('@adidas.com');
}

function looksLikeBroadcast(msg) {
  const to = (msg.to || '').toLowerCase();
  const cc = (msg.cc || '').toLowerCase();
  const bcc = (msg.bcc || '').toLowerCase();
  const subj = (msg.subject || '').toLowerCase();
  const snippet = (msg.snippet || '').toLowerCase();

  // helper: count recipients in header-like strings (rough but effective)
  const countRcpts = (s) => {
    if (!s) return 0;
    return String(s)
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean).length;
  };

  const toCount = countRcpts(to);
  const ccCount = countRcpts(cc);
  const bccCount = countRcpts(bcc);
  const totalCount = toCount + ccCount + bccCount;

  // Broadcast heuristics:
  // - lots of recipients (typical digest/broadcast)
  // - undisclosed recipients
  // - newsletters/digests markers
  if (totalCount >= 8) return true;
  if (to.includes('undisclosed')) return true;

  // common newsletter markers
  if (subj.includes('newsletter') || subj.includes('digest') || subj.includes('unsubscribe')) return true;
  if (snippet.includes('unsubscribe') || snippet.includes('manage preferences') || snippet.includes('newsletter') || snippet.includes('digest')) return true;

  // if payload included list-unsubscribe header
  if (msg.unsubscribe || msg.list_unsubscribe || msg.listUnsubscribe) return true;

  return false;
}

function addressedToMe(msg) {
  // gog payload may include only some headers depending on mode; be defensive.
  const headerCandidates = [msg.to, msg.cc, msg.bcc, msg.deliveredTo, msg.delivered_to, msg.recipient, msg.recipientEmail];
  const allowed = new Set([
    WORK_ACCOUNT.toLowerCase(),
    FROM_ALIAS.toLowerCase(),
    ...WORK_RECIPIENTS,
  ]);

  for (const c of headerCandidates) {
    for (const e of extractAllEmails(c || '')) {
      if (allowed.has(e)) return true;
    }
    // Fallback: single email extraction
    const one = extractEmail(c || '').toLowerCase();
    if (one && allowed.has(one)) return true;
  }
  return false;
}

function logLine(obj) {
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
  } catch {
    // ignore
  }
}

function b64urlDecode(s) {
  if (!s) return '';
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

function pickHeader(headers, name) {
  const h = Array.isArray(headers) ? headers.find((x) => String(x.name || '').toLowerCase() === name.toLowerCase()) : null;
  return h ? String(h.value || '') : '';
}

function extractTextPlain(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) return b64urlDecode(payload.body.data);
  const parts = payload.parts || [];
  for (const p of parts) {
    const t = extractTextPlain(p);
    if (t) return t;
  }
  return '';
}

async function getThreadContextText(messageId, maxMessages = 6) {
  // Find thread id
  const meta = await execFile(GOG_BIN, [
    '--client', GOG_CLIENT,
    '--account', WORK_ACCOUNT,
    'gmail', 'get', messageId,
    '--format', 'metadata',
    '--plain',
  ]);
  const threadIdLine = meta.out.split('\n').find((l) => l.startsWith('thread_id\t'));
  const threadId = threadIdLine ? threadIdLine.split('\t')[1].trim() : '';
  if (!threadId) return '';

  const t = await execFile(GOG_BIN, [
    '--client', GOG_CLIENT,
    '--account', WORK_ACCOUNT,
    'gmail', 'thread', 'get', threadId,
    '--full',
    '--json',
  ], 120000);

  const obj = JSON.parse(t.out || '{}');
  const msgs = (obj.thread && Array.isArray(obj.thread.messages)) ? obj.thread.messages : [];
  const sorted = msgs
    .slice()
    .sort((a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0))
    .slice(0, maxMessages);

  const blocks = [];
  for (const m of sorted) {
    const headers = (m.payload && m.payload.headers) || [];
    const from = pickHeader(headers, 'From');
    const to = pickHeader(headers, 'To');
    const cc = pickHeader(headers, 'Cc');
    const subject = pickHeader(headers, 'Subject');
    const date = pickHeader(headers, 'Date');
    const text = (extractTextPlain(m.payload) || m.snippet || '').trim();
    const clipped = text.length > 1500 ? (text.slice(0, 1500) + '…') : text;

    blocks.push([
      `From: ${from}`,
      to ? `To: ${to}` : null,
      cc ? `Cc: ${cc}` : null,
      `Subject: ${subject}`,
      `Date: ${date}`,
      '',
      clipped,
    ].filter(Boolean).join('\n'));
  }

  return blocks.join('\n\n---\n\n');
}

async function execFile(bin, args, timeoutMs = 120000) {
  const { spawn } = require('child_process');
  return await new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const t = setTimeout(() => {
      try { p.kill('SIGKILL'); } catch {}
      reject(new Error(`timeout after ${timeoutMs}ms: ${bin} ${args.join(' ')}`));
    }, timeoutMs);
    p.stdout.on('data', (d) => (out += d.toString('utf8')));
    p.stderr.on('data', (d) => (err += d.toString('utf8')));
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve({ out: out.trim(), err: err.trim() });
      reject(new Error(`${bin} exited ${code}: ${err || out}`));
    });
  });
}

async function getWorkSignatureHtml() {
  const { out } = await execFile(GOG_BIN, [
    '--client', GOG_CLIENT,
    '--account', WORK_ACCOUNT,
    'gmail', 'settings', 'sendas', 'get',
    FROM_ALIAS,
    '--json',
  ]);
  const obj = JSON.parse(out || '{}');
  return (obj.sendAs && obj.sendAs.signature) ? String(obj.sendAs.signature) : '';
}

function plainToHtml(text) {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = String(text || '').split(/\r?\n/);
  const paras = [];
  let buf = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (buf.length) {
        paras.push(`<p>${esc(buf.join(' '))}</p>`);
        buf = [];
      }
      continue;
    }
    buf.push(line.trim());
  }
  if (buf.length) paras.push(`<p>${esc(buf.join(' '))}</p>`);
  return `<div dir="ltr">${paras.join('')}</div>`;
}

async function draftWithLlm({ to, cc, subject, replyToMessageId, contextText, signatureHtml, recipientName }) {
  const greet = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const prompt = [
    'You are an assistant drafting a reply email for a busy professional.',
    'Requirements:',
    '- Reply in the SAME language as the latest inbound email (English/German/Ukrainian).',
    '- Tone: friendly, professional, polite.',
    '- Keep it concise and actionable.',
    '- Use hyphen (-) only; never use em dash (—) or en dash (–).',
    '- Do not hallucinate facts; if information is missing, ask a short clarifying question.',
    `- Start the reply with exactly: ${greet}`,
    '',
    'THREAD CONTEXT (most recent first):',
    contextText,
    '',
    'Return ONLY the email body text (no subject line, no signature).',
  ].join('\n');

  const { out } = await execFile(CLAWDBOT_BIN, [
    'agent',
    '--session-id', `gmail-drafter:${replyToMessageId}`,
    '--message', prompt,
    '--json',
    '--timeout', '120',
  ], 150000);

  const res = JSON.parse(out || '{}');
  const text = (res.payloads && res.payloads[0] && res.payloads[0].text) ? res.payloads[0].text : '';
  const cleaned = String(text || '').trim();
  if (!cleaned) throw new Error('LLM returned empty draft');

  const bodyHtml = plainToHtml(cleaned);
  // Exactly one visual blank line before signature:
  const fullHtml = bodyHtml.replace(/<\/div>$/, '') + '<br>' + '</div>' + '\n' + signatureHtml;

  const args = [
    '--client', GOG_CLIENT,
    '--account', WORK_ACCOUNT,
    'gmail', 'drafts', 'create',
    '--to', to,
    '--subject', subject,
    '--from', FROM_ALIAS,
    '--body-html', fullHtml,
  ];
  if (cc) args.push('--cc', cc);
  if (replyToMessageId) args.push('--reply-to-message-id', replyToMessageId);

  return await execFile(GOG_BIN, args, 120000);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
    if (req.url !== '/gmail-work') return json(res, 404, { ok: false, error: 'not_found' });

    const auth = req.headers['authorization'] || '';
    if (!HOOK_TOKEN || auth !== `Bearer ${HOOK_TOKEN}`) {
      return json(res, 401, { ok: false, error: 'unauthorized' });
    }

    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || '{}');
    } catch {
      return json(res, 400, { ok: false, error: 'bad_json' });
    }

    const msgs = Array.isArray(payload.messages) ? payload.messages : [];
    const created = [];
    const skipped = [];

    logLine({ event: 'request', count: msgs.length, keys: Object.keys(payload || {}) });

    for (const msg of msgs) {
      const fromEmail = extractEmail(msg.from || '');
      const subj = msg.subject || '';

      if (!fromEmail || !subj) {
        skipped.push({ reason: 'missing_from_or_subject', from: msg.from, subject: msg.subject, to: msg.to });
        continue;
      }
      if (!isAllowedSender(fromEmail)) {
        skipped.push({ fromEmail, subj, reason: 'sender_domain_not_allowed' });
        continue;
      }
      if (!addressedToMe(msg)) {
        skipped.push({ fromEmail, subj, reason: 'not_addressed_to_me', to: msg.to, cc: msg.cc, bcc: msg.bcc, deliveredTo: msg.deliveredTo || msg.delivered_to });
        continue;
      }
      if (looksLikeBroadcast(msg)) {
        skipped.push({ fromEmail, subj, reason: 'looks_like_broadcast', to: msg.to, cc: msg.cc });
        continue;
      }

      const replySubject = subj.toLowerCase().startsWith('re:') ? subj : `Re: ${subj}`;

      // Reply-to-all mode:
      // - To: original sender + other To recipients (excluding me/my aliases)
      // - Cc: original CC recipients (excluding me/my aliases)
      const myAddrs = new Set([
        WORK_ACCOUNT.toLowerCase(),
        FROM_ALIAS.toLowerCase(),
        ...WORK_RECIPIENTS,
      ]);
      const uniq = (arr) => Array.from(new Set(arr.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)));
      const toAddrs = uniq([
        fromEmail,
        ...extractAllEmails(msg.to || ''),
      ]).filter((e) => !myAddrs.has(e));
      const ccAddrs = uniq([
        ...extractAllEmails(msg.cc || ''),
      ]).filter((e) => !myAddrs.has(e));

      // Build thread context and let the agent draft the reply "by meaning".
      const contextText = await getThreadContextText(msg.id, 8);
      const signatureHtml = await getWorkSignatureHtml();
      const recipientName = extractDisplayName(msg.from || '') || extractDisplayName(pickHeader((msg.headers || []), 'From'));

      const result = await draftWithLlm({
        to: toAddrs.join(','),
        cc: ccAddrs.join(','),
        subject: replySubject,
        replyToMessageId: msg.id,
        contextText,
        signatureHtml,
        recipientName,
      });

      created.push({ fromEmail, subject: replySubject, result: result.out });
      logLine({ event: 'draft_created', fromEmail, subject: replySubject, replyTo: msg.id, mode: 'llm' });
    }

    if (skipped.length) logLine({ event: 'skipped', skipped });
    return json(res, 200, { ok: true, created, skipped, count: msgs.length });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`gmail-drafter listening on 127.0.0.1:${PORT}`);
});
