const button = document.querySelector('#apk-download');
const status = document.querySelector('#apk-status');

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Preparing your download…';
  try {
    const response = await fetch('downloads/resident.json');
    if (!response.ok) throw new Error('Download metadata unavailable');
    const { parts, bytes, sha256 } = await response.json();
    const chunks = [];
    let received = 0;
    for (const part of parts) {
      const result = await fetch('downloads/' + part);
      if (!result.ok) throw new Error('Incomplete download');
      const chunk = await result.arrayBuffer();
      chunks.push(chunk);
      received += chunk.byteLength;
      status.textContent = 'Downloading… ' + Math.min(99, Math.round(received / bytes * 100)) + '%';
    }
    const apk = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
    if (apk.size !== bytes) throw new Error('Incorrect download size');
    if (window.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', await apk.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== sha256) throw new Error('Download verification failed');
    }
    const url = URL.createObjectURL(apk);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ECO-TAP-Resident.apk';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = 'APK ready. Open it from your Android downloads to install.';
  } catch {
    status.textContent = 'The download could not be completed. Please try again.';
  } finally {
    button.disabled = false;
  }
});