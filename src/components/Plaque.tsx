import type { Part, Step } from "@/lib/types";
import { splitCaptionIntoChips, CHIP_TOKENS } from "@/lib/caption-chips";
import { tokenizeGoLine } from "@/lib/go-highlight";

interface PlaqueProps {
  part: Part;
  step: Step;
  totalSteps: number;
}

export function Plaque({ part, step, totalSteps }: PlaqueProps) {
  const chipTokens = CHIP_TOKENS[part.id] ?? [];
  const segments = splitCaptionIntoChips(step.caption, chipTokens);
  const nextStep = step.n < totalSteps ? part.steps[step.n] : null;
  const compact = part.lines.length > 9;

  return (
    <aside className="plaque" aria-label="Part plaque">
      <div>
        <div className="p-row">
          <span className="lbl">Part {part.number}</span>
          <span className="sws lbl">
            <span>
              <i className="sw-hatch" aria-hidden="true" />
              stack
            </span>
            <span>
              <i className="sw-solid" aria-hidden="true" />
              heap
            </span>
          </span>
        </div>
        <h1>{part.title}</h1>
        <p className="sub">{part.subtitle}</p>
      </div>

      <div className="caption" aria-live="polite">
        <div className="lbl">
          Step {step.n} of {totalSteps}
        </div>
        <p>
          {segments.map((seg, i) =>
            seg.chip ? (
              <code className="i" key={i}>
                {seg.text}
              </code>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </p>
      </div>

      <div className="code">
        <div className="code-h">
          <span className="lbl">{part.file}</span>
          <span className="lbl">line {step.codeLine || "—"}</span>
        </div>
        <pre>
          {part.lines.slice(0, compact ? 14 : part.lines.length).map((line, i) => {
            const lineNumber = i + 1;
            const isCurrent = lineNumber === step.codeLine;
            const tokens = tokenizeGoLine(line);
            return (
              <span className={`l${isCurrent ? " hl" : line.trim() === "" ? "" : " dim"}`} key={i}>
                <span className="gutter">{lineNumber}</span>
                {line.trim() === "" ? (
                  "\u00A0"
                ) : (
                  tokens.map((t, ti) => {
                    if (t.kind === "plain") return <span key={ti}>{t.text}</span>;
                    const cls = t.kind === "keyword" ? "k" : t.kind === "string" ? "s" : "c";
                    return (
                      <span className={cls} key={ti}>
                        {t.text}
                      </span>
                    );
                  })
                )}
              </span>
            );
          })}
        </pre>
      </div>

      {step.hint && (
        <div className="tool" aria-label="Compiler output">
          <div className="cmd">$ go build -gcflags=-m</div>
          {step.hint.map((line, i) => (
            <div className={`o${i === step.hintCurrent ? " hit" : ""}`} key={i}>
              {line}
            </div>
          ))}
          <div className="src">Verbatim output, go1.24.4</div>
        </div>
      )}

      {step.toolingNode && (
        <div className="tool tool-node" aria-label="AST node">
          <div className="o hit">
            go/ast · {step.toolingNode}
          </div>
        </div>
      )}

      {nextStep && (
        <div className="upnext">
          <span className="lbl">Next</span>
          <span>{nextStep.caption}</span>
        </div>
      )}
    </aside>
  );
}
