import { Fragment, useMemo } from 'react';
import { useLifts } from '../lib/lifts-context';
import { annotate } from '../lib/lifts';

/** Workout text with your RM or the kg for a percentage shown next to each lift. Blue = estimated. */
export default function AnnotatedText({ text }: { text: string }) {
  const { matcher, statsOf } = useLifts();
  const lines = useMemo(() => text.split('\n').map((line) => annotate(line, matcher, statsOf)), [text, matcher, statsOf]);
  return (
    <>
      {lines.map((segs, i) => (
        <Fragment key={i}>
          {i > 0 && '\n'}
          {segs.map((s, j) =>
            s.kind === 'text' ? (
              <Fragment key={j}>{s.text}</Fragment>
            ) : (
              <span key={j} className={s.estimated ? 'rm-chip est' : 'rm-chip'}>
                {s.text}
              </span>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
