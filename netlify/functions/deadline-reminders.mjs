// Scheduled daily email reminder. Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and RESEND_API_KEY
// as Netlify environment variables. Never put these secrets in config.js or frontend code.
export default async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, REMINDER_FROM_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !REMINDER_FROM_EMAIL) {
    console.error('Missing required environment variables for deadline reminders.');
    return new Response('Reminder service is not configured.', { status: 500 });
  }
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
  const [rowsRes, usersRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/user_data?select=user_id,payload`, { headers }),
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers })
  ]);
  if (!rowsRes.ok || !usersRes.ok) { console.error(await rowsRes.text(), await usersRes.text()); return new Response('Could not read account data.', {status:500}); }
  const rows = await rowsRes.json(); const users = (await usersRes.json()).users || [];
  const emailById = new Map(users.map(u => [u.id, u.email]));
  const today = new Date(); today.setUTCHours(0,0,0,0);
  const end = new Date(today); end.setUTCDate(end.getUTCDate()+2);
  let sent = 0;
  for (const row of rows) {
    const email = emailById.get(row.user_id); if (!email) continue;
    const tasks = Array.isArray(row.payload?.tasks) ? row.payload.tasks : [];
    const due = tasks.filter(t => !t.done && t.due).filter(t => { const d = new Date(`${t.due}T00:00:00Z`); return d >= today && d <= end; });
    if (!due.length) continue;
    const lines = due.map(t => `• ${String(t.title || 'Untitled task')} — due ${t.due}`).join('\n');
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', headers:{ Authorization:`Bearer ${RESEND_API_KEY}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ from:REMINDER_FROM_EMAIL, to:[email], subject:`StudySync: ${due.length} upcoming deadline${due.length===1?'':'s'}`, text:`Hi! Here are your upcoming StudySync deadlines:\n\n${lines}\n\nLog in to StudySync to review your tasks.` })
    });
    if (!response.ok) console.error('Email send failed for', email, await response.text()); else sent++;
  }
  return new Response(`Reminder run complete. Emails sent: ${sent}`, {status:200});
};
export const config = { schedule: '0 1 * * *' };
