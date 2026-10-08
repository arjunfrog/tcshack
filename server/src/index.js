import { createApp } from './app.js';
import { activeModel, config, isSupabaseConfigured } from './config/env.js';

// Express 5 hands listen errors to this callback instead of throwing, so check for one:
// without this, a busy port prints "listening" and the process quietly exits.
createApp().listen(config.port, (error) => {
  if (error) {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${config.port} is already in use, probably by an earlier server that is still running.\n` +
            'Stop it, then start again. On Windows (PowerShell):\n' +
            `  Get-NetTCPConnection -LocalPort ${config.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
        : `Could not start the API server: ${error.message}`,
    );
    process.exit(1);
  }
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`LLM provider: ${config.llm.provider} (${activeModel()})`);
  if (!isSupabaseConfigured()) console.log('Supabase not configured: database features are disabled.');
});
