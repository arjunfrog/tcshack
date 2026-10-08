// Checks the whole local setup and says exactly what to fix:
//   npm run doctor
// Reads server/.env, then checks the Supabase keys, the database tables, auth admin
// access (needed for sign-up), the browser login settings, and the LLM settings.

import { config } from '../src/config/env.js';
import { supabase } from '../src/lib/supabase.js';

const TABLES = ['products', 'descriptions', 'generation_jobs', 'feedback', 'retailers'];
let problems = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const bad = (message, fix) => {
  problems += 1;
  console.log(`  ✗ ${message}${fix ? `\n      → ${fix}` : ''}`);
};
const projectRef = (url) => url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

console.log('\nSupabase (server)');
const url = config.supabase.url;
const key = config.supabase.serviceRoleKey;
if (!url) bad('SUPABASE_URL is not set in server/.env');
else if (!projectRef(url)) bad(`SUPABASE_URL looks wrong: ${url}`, 'It should look like https://<project-ref>.supabase.co');
else ok(`SUPABASE_URL → project ${projectRef(url)}`);

if (!key) bad('SUPABASE_SECRET_KEY is not set in server/.env', 'Supabase → Project Settings → API Keys → Secret keys (sb_secret_...)');
else if (key.startsWith('sb_publishable_')) bad('SUPABASE_SECRET_KEY is the PUBLISHABLE key', 'Use the sb_secret_... key from Project Settings → API Keys → Secret keys');
else if (key.startsWith('sb_secret_') || key.startsWith('eyJ')) ok(`SUPABASE_SECRET_KEY is a secret key (${key.slice(0, 10)}…)`);
else bad(`SUPABASE_SECRET_KEY has an unexpected format (${key.slice(0, 10)}…)`);

if (supabase) {
  for (const table of TABLES) {
    const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const { error: rowError } = error ? { error } : await supabase.from(table).select('*').limit(1);
    if (rowError) {
      const missing = rowError.code === 'PGRST205' || /schema cache|does not exist/.test(rowError.message);
      const offline = /fetch failed/.test(rowError.message);
      bad(`table ${table}: ${missing ? 'MISSING' : rowError.message}`,
        missing ? `Run supabase/setup.sql in the SQL Editor of project ${projectRef(url)}`
          : offline ? 'Cannot reach Supabase: check SUPABASE_URL and your internet connection' : undefined);
    } else {
      ok(`table ${table} (${count ?? '?'} rows)`);
    }
  }

  const { data: retailerCol, error: colError } = await supabase.from('products').select('retailer_id').limit(1);
  if (colError && /retailer_id/.test(colError.message)) {
    bad('products.retailer_id column is missing', 'Run supabase/setup.sql (the second part adds it)');
  } else if (!colError) ok(`products.retailer_id column exists${retailerCol.length ? '' : ' (no products yet)'}`);

  const { data: users, error: adminError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (adminError) {
    bad(`auth admin access failed: ${adminError.message}`, 'Sign-up needs the secret key; check SUPABASE_SECRET_KEY');
  } else {
    const unconfirmed = users.users.filter((user) => !user.email_confirmed_at);
    ok(`auth admin access works (${users.users.length} account${users.users.length === 1 ? '' : 's'})`);
    if (unconfirmed.length) {
      bad(`${unconfirmed.length} account(s) not confirmed: ${unconfirmed.map((user) => user.email).join(', ')}`,
        'Run supabase/setup.sql (it confirms them), or delete them in Authentication → Users');
    }
  }
}

console.log('\nLogin in the browser (VITE_ variables in server/.env)');
const viteUrl = process.env.VITE_SUPABASE_URL;
const viteKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!viteUrl) bad('VITE_SUPABASE_URL is not set');
else if (projectRef(viteUrl) !== projectRef(url)) bad(`VITE_SUPABASE_URL (${projectRef(viteUrl)}) is a different project from SUPABASE_URL (${projectRef(url)})`, 'Both must be the same project');
else ok('VITE_SUPABASE_URL matches SUPABASE_URL');
if (!viteKey) bad('VITE_SUPABASE_PUBLISHABLE_KEY is not set');
else if (viteKey.startsWith('sb_secret_')) bad('VITE_SUPABASE_PUBLISHABLE_KEY is a SECRET key', 'Never put the secret key in a VITE_ variable; use sb_publishable_...');
else ok(`VITE_SUPABASE_PUBLISHABLE_KEY set (${viteKey.slice(0, 15)}…)`);

console.log('\nLLM');
const provider = config.llm.provider;
if (provider === 'mock') bad('LLM_PROVIDER is mock (no API key found)', 'Set GROQ_API_KEY in server/.env');
else ok(`provider ${provider}, model ${config[provider]?.model}`);
if (provider === 'groq' && config.groq?.model !== 'openai/gpt-oss-120b') {
  bad(`GROQ_MODEL is ${config.groq?.model}`, 'Set GROQ_MODEL=openai/gpt-oss-120b in server/.env (or delete the line to use the default)');
}

console.log(problems ? `\n${problems} problem(s) found. Fix them, then run npm run doctor again.\n` : '\nEverything looks good.\n');
process.exit(problems ? 1 : 0);
