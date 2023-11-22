// TEMPORARY: This is a temporary workaround to unregister the old service-worker.
if ('serviceWorker'in navigator) {
  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.getRegistration();

    if (reg) {
      const unregistered = await reg.unregister();
      if (unregistered) {
        window.location.reload();
      }
    }
  });
}