import SfEngine from './sf_18_smallnet.js';

let engine;
let ready = false;

self.onmessage = async function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'init':
      try {
        engine = await SfEngine({
          listen(data) {
            self.postMessage({ type: 'stdout', data });
          },
          onError(err) {
            self.postMessage({ type: 'error', data: String(err) });
          },
        });
        engine.uci('uci');
        engine.uci('isready');
        ready = true;
        self.postMessage({ type: 'ready' });
      } catch (err) {
        self.postMessage({ type: 'error', data: String(err) });
      }
      break;

    case 'uci':
      if (ready && engine) {
        engine.uci(payload);
      }
      break;
  }
};
