/**
 * Home screen icon. iPhone reads the icon once, when the app is added to the Home Screen,
 * from the page's apple-touch-icon. So the choice is applied to that tag, and the person adds the app again.
 */
export interface IconChoice {
  id: string;
  name: string;
  src: string;
}

export const ICONS: readonly IconChoice[] = [
  { id: 'default', name: 'Barbell', src: '/icons/apple-touch-icon.png' },
  { id: 'silhouette', name: 'Silhouette', src: '/icons/choice-silhouette.png' },
  { id: 'crack', name: 'Breakthrough', src: '/icons/choice-crack.png' },
  { id: 'squat', name: 'Squat', src: '/icons/choice-squat.png' },
];

const KEY_CHOICE = 'workouts.icon';
const KEY_CUSTOM = 'workouts.icon.custom';
const SIZE = 180;

export interface IconState {
  id: string;
  custom: string | null;
}

export function loadIcon(): IconState {
  try {
    const custom = localStorage.getItem(KEY_CUSTOM);
    const id = localStorage.getItem(KEY_CHOICE);
    if (id === 'custom' && custom) return { id, custom };
    if (id && ICONS.some((i) => i.id === id)) return { id, custom };
    return { id: 'default', custom };
  } catch {
    return { id: 'default', custom: null };
  }
}

export function iconSrc(state: IconState): string {
  if (state.id === 'custom' && state.custom) return state.custom;
  return (ICONS.find((i) => i.id === state.id) ?? ICONS[0]).src;
}

/** Points the page's icon tags at the chosen icon. */
export function applyIcon(state: IconState): void {
  const href = iconSrc(state);
  let link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    document.head.appendChild(link);
  }
  link.removeAttribute('sizes');
  link.href = href;
}

export function saveIcon(state: IconState): void {
  try {
    localStorage.setItem(KEY_CHOICE, state.id);
    if (state.custom) localStorage.setItem(KEY_CUSTOM, state.custom);
    else localStorage.removeItem(KEY_CUSTOM);
  } catch {
    /* storage unavailable: the choice still applies to this page view */
  }
  applyIcon(state);
}

/** Crops any picture to a centred square and returns it as a 180x180 PNG data URL. */
export async function makeCustomIcon(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image. Try a JPG or PNG.'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('Could not read that image.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process the image.');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
