// Controlled form for creating new simulation runs.
import { useMemo, useState } from "react";

const SAMPLE_CONFIG = {
  scenario: "pick-place",
  seed: 42,
  difficulty: "medium",
};

interface RunFormProps {
  onCreate: (config: Record<string, unknown>) => Promise<void>;
}

/**
 * Collects JSON config plus preset helpers before queueing a new run.
 */
export function RunForm({ onCreate }: RunFormProps) {
  const [rawConfig, setRawConfig] = useState(
    JSON.stringify(SAMPLE_CONFIG, null, 2)
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedConfig = useMemo<Record<string, unknown>>(() => {
    try {
      const parsed = JSON.parse(rawConfig);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
    return { ...SAMPLE_CONFIG };
  }, [rawConfig]);

  const scenario =
    typeof parsedConfig.scenario === "string"
      ? (parsedConfig.scenario as string)
      : SAMPLE_CONFIG.scenario;
  const difficulty =
    typeof parsedConfig.difficulty === "string"
      ? (parsedConfig.difficulty as string)
      : SAMPLE_CONFIG.difficulty;
  const seed =
    typeof parsedConfig.seed === "number"
      ? (parsedConfig.seed as number)
      : SAMPLE_CONFIG.seed;

  const applyUpdates = (updates: Record<string, unknown>) => {
    const nextConfig = { ...parsedConfig, ...updates };
    setRawConfig(JSON.stringify(nextConfig, null, 2));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(rawConfig);
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("Config must be a JSON object");
      }
      setIsSubmitting(true);
      await onCreate(parsed);
      setError(null);
      setRawConfig(JSON.stringify(parsed, null, 2));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card run-form" onSubmit={handleSubmit}>
      <div className="card-header">
        <div>
          <h2>New Simulation Run</h2>
          <p className="muted">
            Choose presets or tweak JSON to kick off a run quickly.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <label htmlFor="scenario">Scenario</label>
        <select
          id="scenario"
          value={scenario}
          onChange={(event) => applyUpdates({ scenario: event.target.value })}
        >
          <option value="pick-place">Pick &amp; Place</option>
          <option value="bin-packing">Bin Packing</option>
          <option value="navigation">Navigation</option>
          <option value="assembly">Assembly</option>
        </select>

        <label htmlFor="difficulty">Difficulty</label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(event) => applyUpdates({ difficulty: event.target.value })}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <label htmlFor="seed">Seed</label>
        <input
          id="seed"
          type="number"
          value={seed}
          min={0}
          max={9999}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(nextValue)) {
              applyUpdates({ seed: nextValue });
            } else {
              applyUpdates({ seed: SAMPLE_CONFIG.seed });
            }
          }}
        />
      </div>
      <label htmlFor="config">Run config (JSON)</label>
      <textarea
        id="config"
        rows={8}
        value={rawConfig}
        onChange={(event) => setRawConfig(event.target.value)}
        spellCheck={false}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Queue Run"}
      </button>
    </form>
  );
}
