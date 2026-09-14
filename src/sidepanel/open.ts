/**
 * Abre el side panel en el mismo turno del gesto de usuario.
 * No hacer await de otras APIs antes de llamar a `open`: Chrome pierde el gesto.
 * Si falla (API ausente, throw síncrono o promesa rechazada), la grabación no se bloquea.
 */
export function openRecordingPanel(): Promise<void> {
  try {
    return chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch(() => {
      /* sin gesto o API: la captura sigue */
    });
  } catch {
    return Promise.resolve();
  }
}
