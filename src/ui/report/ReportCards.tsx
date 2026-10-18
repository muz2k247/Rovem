import { useState } from 'react';
import type { ReportCard } from '../../game/contracts.ts';

/** "What happened": up to three cards, each numbered like its marker on the graph, with a Show the maths toggle. */
export function ReportCards({ cards }: { cards: ReportCard[] }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  if (cards.length === 0) return null;
  return (
    <section aria-label="What happened" className="report-cards">
      <h3>What happened</h3>
      <ol>
        {cards.map((card, i) => {
          const shown = open.has(i);
          return (
            <li key={card.title} className="report-card">
              <span className="card-number" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <strong>{card.title}</strong>
                <p>{card.sentence}</p>
                {card.mathsLines.length > 0 && (
                  <>
                    <button type="button" className="link" aria-expanded={shown} onClick={() => toggle(i)}>
                      {shown ? 'Hide the maths' : 'Show the maths'}
                    </button>
                    {shown && (
                      <div className="maths">
                        {card.mathsLines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
