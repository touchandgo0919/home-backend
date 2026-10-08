// Usage: node scripts/normalize-url-keys.mjs private-query.json private-updates.sql
// Input: JSON output from SELECT id,url FROM bookmarks. Does not modify original URLs.
import fs from 'node:fs';
import {canonical} from '../src/library.js';
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Input JSON and output SQL paths required.');
const results=JSON.parse(fs.readFileSync(input,'utf8')).flatMap(item=>item.results||[]);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const statements=[];let invalid=0;
for(const row of results){if(!Number.isSafeInteger(row.id))throw new Error('Invalid row ID.');try{const key=canonical(row.url);if(key!==row.url)statements.push(`UPDATE bookmarks SET url_key=${quote(key)} WHERE id=${row.id} AND url=${quote(row.url)};`);}catch{invalid++;}}
fs.writeFileSync(output,statements.length?statements.join('\n'):'SELECT 1;', {mode:0o600});
console.log(JSON.stringify({examined:results.length,normalizations:statements.length,legacyInvalidUrlsPreserved:invalid}));
