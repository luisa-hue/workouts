interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** iOS-style segmented control with a sliding thumb. */
export default function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  const index = Math.max(0, options.indexOf(value));
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      <div
        className="segmented-thumb"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={o === value}
          className={o === value ? 'segmented-item active' : 'segmented-item'}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
