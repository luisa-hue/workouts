import { useRef, useState } from 'react';
import { Check, ImagePlus } from 'lucide-react';
import { ICONS, loadIcon, makeCustomIcon, saveIcon, type IconState } from '../lib/app-icon';

/**
 * Public page (/#icon), meant for Safari: choose the icon, then Share > Add to Home Screen.
 * No login needed, so it works in the browser where the iPhone reads the icon.
 */
export default function IconPage() {
  const [state, setState] = useState<IconState>(loadIcon);
  const [problem, setProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  function choose(next: IconState) {
    setState(next);
    saveIcon(next);
  }

  async function onFile(list: FileList | null) {
    const f = list?.[0];
    if (file.current) file.current.value = '';
    if (!f) return;
    setProblem(null);
    try {
      choose({ id: 'custom', custom: await makeCustomIcon(f) });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not use that image.');
    }
  }

  return (
    <main className="icon-page">
      <header className="page-head">
        <h1 className="large-title">App icon</h1>
      </header>

      <div className="icon-grid">
        {ICONS.map((i) => (
          <button key={i.id} type="button" className={state.id === i.id ? 'icon-tile selected' : 'icon-tile'} onClick={() => choose({ id: i.id, custom: state.custom })}>
            <img src={i.src} alt="" width={72} height={72} />
            <span>{i.name}</span>
            {state.id === i.id && <Check className="icon-check" size={16} />}
          </button>
        ))}
        {state.custom && (
          <button type="button" className={state.id === 'custom' ? 'icon-tile selected' : 'icon-tile'} onClick={() => choose({ id: 'custom', custom: state.custom })}>
            <img src={state.custom} alt="" width={72} height={72} />
            <span>Yours</span>
            {state.id === 'custom' && <Check className="icon-check" size={16} />}
          </button>
        )}
        <button type="button" className="icon-tile add" onClick={() => file.current?.click()}>
          <span className="icon-add">
            <ImagePlus size={26} />
          </span>
          <span>{state.custom ? 'Change yours' : 'Your own'}</span>
        </button>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files)} />
      {problem && <p className="error">{problem}</p>}

      <h2 className="section-title">Put it on your Home Screen</h2>
      <section className="card">
        <ol className="icon-steps">
          <li>Open this page in Safari.</li>
          <li>Pick an icon above.</li>
          <li>Tap Share, then Add to Home Screen.</li>
          <li>If Workouts is already there, remove it first. The icon is set when the app is added.</li>
        </ol>
      </section>
      <p className="hint">
        <a href="/" className="link-btn">
          Back to the app
        </a>
      </p>
    </main>
  );
}
