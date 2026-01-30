#!/usr/bin/env node

// One-off recovery script: create Gmail drafts for specific message ids using the same
// LLM prompt style as gmail-drafter.

const { spawn } = require('child_process');

const GOG = process.env.GOG_BIN || '/opt/homebrew/bin/gog';
const CLAWDBOT = process.env.CLAWDBOT_BIN || '/opt/homebrew/bin/clawdbot';
const CLIENT = process.env.GOG_CLIENT || 'work';
const ACCOUNT = process.env.WORK_ACCOUNT || 'krmy@ciklum.com';
const FROM_ALIAS = process.env.FROM_ALIAS || 'myroslav.kravchenko@ciklum.com';

function execFile(bin, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
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

function b64urlDecode(s) {
  if (!s) return '';
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

function pickHeader(headers, name) {
  const h = Array.isArray(headers) ? headers.find((x) => String(x.name || '').toLowerCase() === name.toLowerCase()) : null;
  return h ? String(h.value || '') : '';
}

function extractEmail(addr) {
  if (!addr) return '';
  const m = String(addr).match(/<([^>]+)>/);
  return (m ? m[1] : String(addr)).trim();
}

function extractDisplayName(addr) {
  if (!addr) return '';
  const s = String(addr).trim();
  const m = s.match(/^\s*([^<]+?)\s*<[^>]+>\s*$/);
  let name = (m ? m[1] : '').trim();
  name = name.replace(/^"+|"+$/g, '').trim();
  if (!name || name.includes('@')) return '';
  return name;
}

function extractAllEmails(headerValue) {
  const s = String(headerValue || '');
  const out = new Set();
  for (const m of s.matchAll(/<([^>]+)>/g)) {
    out.add(String(m[1] || '').trim().toLowerCase());
  }
  for (const part of s.split(/[,;]+/)) {
    const t = part.trim();
    if (!t) continue;
    const cleaned = t.replace(/^"|"$/g, '').trim();
    if (cleaned.includes('@') && !cleaned.includes(' ')) out.add(cleaned.toLowerCase());
  }
  return Array.from(out).filter(Boolean);
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

function plainToHtml(text) {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  out.push('<div dir="ltr">');

  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = String(raw || '');
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      out.push('<br>');
      continue;
    }

    const m = trimmed.match(/^([-*])\s+(.*)$/);
    if (m) {
      const item = m[2] || '';
      if (!inList) {
        out.push('<ul style="margin:0;padding-left:1.2em;">');
        inList = true;
      }
      out.push(`<li>${esc(item)}</li>`);
      continue;
    }

    closeList();
    out.push(`${esc(trimmed)}<br>`);
  }

  closeList();
  out.push('</div>');
  return out.join('');
}

async function getWorkSignatureHtml() {
  const { out } = await execFile(GOG, [
    '--client', CLIENT,
    '--account', ACCOUNT,
    'gmail', 'settings', 'sendas', 'get',
    FROM_ALIAS,
    '--json',
  ]);
  const obj = JSON.parse(out || '{}');
  return (obj.sendAs && obj.sendAs.signature) ? String(obj.sendAs.signature) : '';
}

async function getThreadContextText(messageId, maxMessages = 6) {
  // messageId is also threadId for single-message threads in our cases; still fetch via thread get.
  const { out } = await execFile(GOG, [
    '--client', CLIENT,
    '--account', ACCOUNT,
    'gmail', 'thread', 'get', messageId,
    '--full',
    '--json',
  ]);
  const obj = JSON.parse(out || '{}');
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

async function getMessageFull(messageId) {
  const { out } = await execFile(GOG, [
    '--client', CLIENT,
    '--account', ACCOUNT,
    'gmail', 'get', messageId,
    '--format', 'full',
    '--json',
  ]);
  return JSON.parse(out || '{}');
}

async function draftWithLlm({ to, cc, subject, replyToMessageId, contextText, recipientName }) {
  const displayName = String(recipientName || '').trim();
  const prompt = [
    'You are an assistant drafting a reply email for a busy professional.',
    'Requirements:',
    '- Reply in the SAME language as the latest inbound email (English/German/Ukrainian).',
    '- Tone: friendly, professional, polite.',
    '- Keep it concise and actionable.',
    '- Use hyphen (-) only; never use em dash (—) or en dash (–).',
    '- Do not hallucinate facts; if information is missing, ask a short clarifying question.',
    '',
    `Recipient display name from From header: ${displayName || '(missing)'}`,
    'Extract the recipient first name from the display name and start the reply with exactly: Hi <first name>,',
    'If you cannot confidently extract a first name, start with: Hi,',
    '',
    'THREAD CONTEXT (most recent first):',
    contextText,
    '',
    'Return ONLY the email body text (no subject line, no signature).',
  ].join('\n');

  const { out } = await execFile(CLAWDBOT, [
    'agent',
    '--local',
    '--session-id', `gmail-drafter:manual:${replyToMessageId}:${Date.now()}`,
    '--message', prompt,
    '--json',
    '--timeout', '180',
  ], 300000);

  const res = JSON.parse(out || '{}');
  const candidates = [
    res && res.text,
    res && res.reply,
    res && res.payload && res.payload.text,
    res && Array.isArray(res.payloads) && res.payloads[0] && res.payloads[0].text,
    res && Array.isArray(res.messages) && res.messages[0] && res.messages[0].text,
    res && res.result && res.result.text,
    res && res.output && res.output.text,
  ];
  const text = candidates.find((x) => typeof x === 'string' && x.trim()) || '';
  const cleaned = String(text || '').trim();
  if (!cleaned) throw new Error('Empty LLM output');

  // Ensure closing line before signature (no extra blank line)
  const withClosing = cleaned.toLowerCase().includes('kind regards,') ? cleaned : (cleaned + '\nKind regards,');

  const signatureHtml = await getWorkSignatureHtml();
  const bodyHtml = plainToHtml(withClosing);
  let fullHtml = bodyHtml + '\n' + signatureHtml;

  const args = [
    '--client', CLIENT,
    '--account', ACCOUNT,
    'gmail', 'drafts', 'create',
    '--to', to,
    '--subject', subject,
    '--from', FROM_ALIAS,
    '--body-html', fullHtml,
    '--reply-to-message-id', replyToMessageId,
  ];
  if (cc) args.push('--cc', cc);

  await execFile(GOG, args, 120000);
}

function looksLikeCalendarNotification({ from, subject, snippet }) {
  const f = String(from || '').toLowerCase();
  const s = String(subject || '').toLowerCase();
  const sn = String(snippet || '').toLowerCase();

  if (f.includes('calendar-notification@google.com')) return true;
  if (f.includes('calendar@google.com')) return true;

  if (s.startsWith('invitation:')) return true;
  if (s.startsWith('updated invitation:')) return true;
  if (s.startsWith('cancelled event:')) return true;
  if (s.startsWith('canceled event:')) return true;
  if (s.startsWith('cancelled event with note:')) return true;
  if (s.startsWith('canceled event with note:')) return true;

  if (sn.includes('invitation from google calendar')) return true;
  if (sn.includes('this event has been cancelled and removed from your calendar')) return true;
  if (sn.includes('this event has been canceled and removed from your calendar')) return true;
  if (sn.includes('join with google meet')) return true;
  if (sn.includes('you are receiving this email because you are subscribed')) return true;

  return false;
}

async function deleteDraftsForThread(threadId) {
  const { out } = await execFile(GOG, [
    '--client', CLIENT,
    '--account', ACCOUNT,
    'gmail', 'drafts', 'list',
    '--json',
  ]);
  const obj = JSON.parse(out || '{}');
  const drafts = Array.isArray(obj.drafts) ? obj.drafts : [];

  for (const d of drafts) {
    if (!d || !d.id) continue;
    const { out: dout } = await execFile(GOG, [
      '--client', CLIENT,
      '--account', ACCOUNT,
      'gmail', 'drafts', 'get', String(d.id),
      '--json',
    ]);
    const dobj = JSON.parse(dout || '{}');
    const tId = dobj.draft?.message?.threadId || dobj.threadId || '';
    if (tId && String(tId) === String(threadId)) {
      await execFile(GOG, [
        '--client', CLIENT,
        '--account', ACCOUNT,
        'gmail', 'drafts', 'delete', String(d.id),
      ]);
      console.log(`ok: deleted existing draft ${d.id} for thread ${threadId}`);
    }
  }
}

async function main() {
  const ids = process.argv.slice(2).filter(Boolean);
  if (!ids.length) {
    console.error('Usage: recreate-personal-drafts.js <messageId> [messageId ...]');
    process.exit(2);
  }

  for (const id of ids) {
    const full = await getMessageFull(id);
    const headers = full.message?.payload?.headers || [];
    const from = pickHeader(headers, 'From');
    const subj = pickHeader(headers, 'Subject') || '(no subject)';
    const snippet = full.message?.snippet || '';
    const threadId = full.message?.threadId || id;

    if (looksLikeCalendarNotification({ from, subject: subj, snippet })) {
      console.log(`skip: calendar notification ${id}`);
      continue;
    }

    // Remove any existing draft in this thread so we can recreate cleanly.
    await deleteDraftsForThread(threadId);

    const replySubject = subj.toLowerCase().startsWith('re:') ? subj : `Re: ${subj}`;

    // Reply-to-all recipients from full headers
    const toHdr = pickHeader(headers, 'To');
    const ccHdr = pickHeader(headers, 'Cc');

    const myAddrs = new Set([
      ACCOUNT.toLowerCase(),
      FROM_ALIAS.toLowerCase(),
    ]);

    const uniq = (arr) => Array.from(new Set(arr.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)));

    const fromEmail = extractEmail(from).toLowerCase();
    const toAddrs = uniq([fromEmail, ...extractAllEmails(toHdr)]).filter((e) => e && !myAddrs.has(e));
    const ccAddrs = uniq([...extractAllEmails(ccHdr)]).filter((e) => e && !myAddrs.has(e) && !toAddrs.includes(e));

    const recipientName = extractDisplayName(from);
    const contextText = await getThreadContextText(id, 8);
    await draftWithLlm({
      to: toAddrs.join(','),
      cc: ccAddrs.join(','),
      subject: replySubject,
      replyToMessageId: id,
      contextText,
      recipientName,
    });

    console.log(`ok: created draft for ${id}`);
  }
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
