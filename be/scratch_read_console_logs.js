const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\TTSmart\\.gemini\\antigravity-ide\\brain\\3c2f630f-bc37-4e65-b0cc-5c96ba053fc9\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      // look for capture_browser_console_logs response content
      if (obj.content && obj.content.includes('"logs"')) {
        console.log(`--- CONSOLE LOGS ---`);
        console.log(obj.content);
      }
    } catch (e) {
      // ignore
    }
  }
}

run();
