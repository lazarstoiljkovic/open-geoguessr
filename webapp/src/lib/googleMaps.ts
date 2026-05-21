declare global {
  interface Window {
    __gsvReady?: () => void;
  }
}

let loaded = false;
let loading = false;
const callbacks: Array<() => void> = [];

export function loadGoogleMapsApi(apiKey: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (loaded && window.google?.maps) {
      resolve();
      return;
    }
    callbacks.push(resolve);
    if (loading) return;

    loading = true;
    window.__gsvReady = () => {
      loaded = true;
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__gsvReady`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}
