import { Router, type IRouter } from "express";
import { exec } from "child_process";
import path from "path";
import { GetMarketScoresResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// In dev mode, cwd is the package root (artifacts/api-server/).
// In production, cwd is the workspace root (started as `node artifacts/api-server/dist/index.cjs`).
const PYTHON_SCRIPT =
  process.env.NODE_ENV === "production"
    ? path.resolve(process.cwd(), "artifacts/api-server/src/lib/marketData.py")
    : path.resolve(process.cwd(), "src/lib/marketData.py");
const SCRIPT_TIMEOUT = 60000;

function runPythonScript(instrumentsJson?: string): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (instrumentsJson) {
    env.INSTRUMENTS_JSON = instrumentsJson;
  }
  return new Promise((resolve, reject) => {
    exec(
      `python3 "${PYTHON_SCRIPT}"`,
      { timeout: SCRIPT_TIMEOUT, env },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

router.get("/market/scores", async (req, res): Promise<void> => {
  const instrumentsJson = req.query.instruments as string | undefined;

  // Basic validation — must be valid JSON array if provided
  if (instrumentsJson) {
    try {
      const parsed = JSON.parse(instrumentsJson);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        res.status(400).json({
          error: "validation_error",
          message: "instruments must be a non-empty JSON array",
        });
        return;
      }
    } catch {
      res.status(400).json({
        error: "validation_error",
        message: "instruments is not valid JSON",
      });
      return;
    }
  }

  try {
    const output = await runPythonScript(instrumentsJson);

    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      res.status(500).json({
        error: "parse_error",
        message: "Failed to parse market data response",
      });
      return;
    }

    const pythonResult = parsed as Record<string, unknown>;
    if (pythonResult.error) {
      res.status(500).json({
        error: pythonResult.error as string,
        message: pythonResult.message as string,
      });
      return;
    }

    const validated = GetMarketScoresResponse.safeParse(pythonResult);
    if (!validated.success) {
      res.status(500).json({
        error: "validation_error",
        message: validated.error.message,
      });
      return;
    }

    res.json(validated.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "fetch_error",
      message: `Failed to fetch market data: ${message}`,
    });
  }
});

export default router;
