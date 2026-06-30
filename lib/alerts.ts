import { supabaseAdmin } from './supabase';
import { emailConfigured, sendEmail } from './email';

// Email any NEW high-severity insights as proactive alerts. Only marks them
// 'seen' once an email actually goes out, so if email isn't configured they
// stay 'new' and still show in the app's badge.
export async function maybeSendAlerts(): Promise<number> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('insights')
    .select('id, title, body, annualized_impact')
    .eq('status', 'new')
    .eq('severity', 'high');
  if (error) throw new Error(error.message);

  const items = data || [];
  if (items.length === 0 || !emailConfigured()) return 0;

  const html = `
    <h2>mehdi — ${items.length} thing${items.length > 1 ? 's' : ''} worth a look</h2>
    ${items
      .map(
        (i) =>
          `<p style="margin:0 0 14px"><strong>${i.title}</strong><br/>${i.body}${
            i.annualized_impact ? ` <em>(~$${Number(i.annualized_impact).toFixed(0)}/yr)</em>` : ''
          }</p>`,
      )
      .join('')}
  `;
  const sent = await sendEmail(`mehdi: ${items.length} thing(s) to look at`, html);
  if (sent) {
    await db
      .from('insights')
      .update({ status: 'seen' })
      .in('id', items.map((i) => i.id));
  }
  return sent ? items.length : 0;
}
