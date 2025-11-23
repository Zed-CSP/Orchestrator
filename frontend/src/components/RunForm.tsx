import { useState } from "react";

const SAMPLE_CONFIG = {
  scenario: "pick-place",
  seed: 42,
  difficulty: "medium",
};

interface RunFormProps {
  onCreate: (config: Record<string, unknown>) => Promise<void>;
}

export function RunForm({ onCreate }: RunFormProps) {
  const [rawConfig, setRawConfig] = useState(
    JSON.stringify(SAMPLE_CONFIG, null, 2)
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <form className="card" onSubmit={handleSubmit}>
      <div className="card-header">
        <div>
          <h2>New Simulation Run</h2>
          <p className="muted">Paste a JSON payload to kick off a run.</p>
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Queue Run"}
        </button>
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
    </form>
  );
}
