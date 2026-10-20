/**
 * Runs inside the page before the app loads (via `page.addInitScript`). Stands in
 * for the Freighter extension by answering its window-message requests, so the
 * app's real `@stellar/freighter-api` calls succeed without an installed wallet.
 *
 * Must stay self-contained: Playwright serialises this function into the page.
 */
export function installFreighterStub(publicKey: string): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const request = event.data;
    if (event.source !== window || request?.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') {
      return;
    }

    // Not connected on load, so the player has to click "Connect Freighter".
    const payloads: Record<string, object> = {
      REQUEST_CONNECTION_STATUS: { isConnected: false },
      REQUEST_ACCESS: { publicKey },
    };
    const payload = payloads[request.type];
    if (!payload) {
      return;
    }

    // Echo the request id under both spellings; freighter-api builds have
    // matched on each, so the stub stays compatible with either.
    window.postMessage(
      {
        source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messageId: request.messageId,
        messagedId: request.messageId,
        ...payload,
      },
      window.location.origin
    );
  });
}
