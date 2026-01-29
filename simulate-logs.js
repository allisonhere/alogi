const fs = require('fs');
const path = require('path');

const targetFile = path.join(process.cwd(), 'mock-logs/production-server/crash.log');

console.log(`Starting simulation on: ${targetFile}`);

let count = 0;
const interval = setInterval(() => {
  count++;
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `[${timestamp}] INFO Live Pulse ${count} - System active and processing requests...\n`;
  
  try {
    fs.appendFileSync(targetFile, line);
  } catch (err) {
    console.error("Error writing to file:", err);
  }

  if (count >= 120) { // Run for 2 minutes
    console.log("Simulation complete.");
    clearInterval(interval);
  }
}, 1000); // Every 1 second
