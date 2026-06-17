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
      if (obj.content && (obj.content.includes('Error') || obj.content.includes('exception') || obj.content.includes('fail') || obj.content.includes('console'))) {
        // limit size
        if (obj.content.length < 2000) {
          console.log(`Step ${obj.step_index}: ${obj.content}`);
        } else {
          console.log(`Step ${obj.step_index}: [Long content] ${obj.content.substring(0, 300)}...`);
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

run();
