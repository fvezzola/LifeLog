// Magic-link delivery. Uses Resend if RESEND_API_KEY is set; otherwise
// prints to the server console (fine for single-user). Same call-site
// either way.

import { Resend } from 'resend';
import { config } from './config.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendMagicLink(email: string, link: string): Promise<void> {
  if (!resend) {
    console.log('\n────────────────────────────────────────────────────────');
    console.log(`[magic-link] (no RESEND_API_KEY — paste this link manually)`);
    console.log(`  to:   ${email}`);
    console.log(`  link: ${link}`);
    console.log('────────────────────────────────────────────────────────\n');
    return;
  }
  const { error } = await resend.emails.send({
    from:    config.resendFrom,
    to:      email,
    subject: 'Your LifeLog sign-in link',
    text:    `Click to sign in:\n\n${link}\n\nExpires in 15 minutes.`,
  });
  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
}
