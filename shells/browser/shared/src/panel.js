/* global chrome */

import { createElement } from 'react';
import { createRoot, flushSync } from 'react-dom';
import Bridge from 'src/bridge';
import DevTools from 'src/devtools/views/DevTools';
import inject from './inject';
import { getBrowserName, getBrowserTheme } from './utils';

const container = ((document.getElementById('container'): any): HTMLElement);

function injectAndInit() {
  let disconnected = false;

  const port = chrome.runtime.connect({
    name: '' + chrome.devtools.inspectedWindow.tabId,
  });
  port.onDisconnect.addListener(() => {
    disconnected = true;
  });

  const bridge = new Bridge({
    listen(fn) {
      port.onMessage.addListener(message => fn(message));
    },
    send(event: string, payload: any, transferable?: Array<any>) {
      if (disconnected) {
        return;
      }
      port.postMessage({ event, payload }, transferable);
    },
  });

  // Clear the "React not found" initial message before rendering.
  container.innerHTML = '';

  const root = createRoot(container);
  root.render(
    createElement(DevTools, {
      bridge,
      browserName: getBrowserName(),
      browserTheme: getBrowserTheme(),
      defaultTab: 'elements',
      showTabBar: false,
    })
  );

  // Initialize the backend only once the DevTools frontend Store has been initialized.
  // Otherwise the Store may miss important initial tree op codes.
  inject(chrome.runtime.getURL('build/backend.js'));

  // Reload the DevTools extension when the user navigates to a new page.
  function onNavigated() {
    chrome.devtools.network.onNavigated.removeListener(onNavigated);

    bridge.send('shutdown');

    flushSync(() => root.unmount(injectAndInit));
  }
  chrome.devtools.network.onNavigated.addListener(onNavigated);
}

injectAndInit();