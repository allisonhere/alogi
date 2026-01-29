const fs = require('fs');
const path = require('path');

const targetFile = path.join(process.cwd(), 'mock-logs/production-server/crash.log');

console.log(`Starting INFINITE simulation on: ${targetFile}`);

let count = 120; // Continue from where we left off visually
const interval = setInterval(() => {
  count++;
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `[${timestamp}] INFO Live Pulse ${count} - Continuous monitoring active...\n`;
  
  try {
    fs.appendFileSync(targetFile, line);
  } catch (err) {
    console.error("Error writing to file:", err);
  }
  
  // No exit condition
}, 1000);

