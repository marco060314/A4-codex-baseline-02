import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const values=Object.fromEntries(readFileSync('/tmp/commonplace-local-env','utf8').split('\n').filter(s=>s.includes('=')).map(s=>{const index=s.indexOf('=');return [s.slice(0,index),s.slice(index+1).replace(/^"|"$/g,'')];}));
writeFileSync('.env.local',`NEXT_PUBLIC_SUPABASE_URL=${values.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${values.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${values.SERVICE_ROLE_KEY}\nAPP_URL=http://localhost:3000\nCRON_SECRET=${randomBytes(24).toString('hex')}\nAI_DAILY_LIMIT=30\nAI_GLOBAL_DAILY_LIMIT=1000\n`);
console.log('Local Supabase environment written to .env.local (ignored by Git).');
