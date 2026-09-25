import { ja } from '../ja';
import { DIAGRAMS } from '../rulesDiagrams';
import { Board } from './Board';
import { BackButton, TopBar } from './common';

const view = { x0: 0, y0: 0, x1: 4, y1: 4 };

export function Rules({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen rules">
      <TopBar left={<BackButton onClick={onBack} />} title={ja.rules.title} />
      <div className="scroll">
        <div className="rules-list">
          {ja.rules.sections.map((s, i) => {
            const d = s.diagram ? DIAGRAMS[s.diagram] : null;
            return (
              <section key={s.head} className="rule">
                <div className="rule-text">
                  <h3>
                    <span className="num">{i + 1}</span>
                    {s.head}
                  </h3>
                  <p>{s.body}</p>
                </div>
                {d && (
                  <div className="rule-fig">
                    <Board size={9} board={d.board} view={view} dots={d.dots} ko={d.ko ?? -1} last={d.last ?? -1} animateLast={false} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
