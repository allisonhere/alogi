const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadUrlWithRetry = async (win, url, retries = 20, retryDelay = 500, delayFn = delay) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await win.loadURL(url);
      return;
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      await delayFn(retryDelay);
    }
  }
};

module.exports = {
  loadUrlWithRetry,
};
