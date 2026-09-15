/**
 * The `serve` and `publish` commands: the hosted dashboard and the CI step that posts to it,
 * kept out of the dispatcher so the dispatcher stays under the cap it enforces.
 */
import { join } from "node:path";
import { buildReport, latestReport } from "../core/report.mjs";
import { createService, publishReport } from "../hosted/service.mjs";
import * as t from "../ui/term.mjs";
import { dashboardFromEnv, portFromEnv, tokenFromEnv } from "../core/env.mjs";

/** @param {"serve" | "publish" | string} command @param {import("./ratchet.mjs").CliContext} c */
export async function hostedCommand(command, c) {
  const { dir, opt, flag, out, err, VERSION } = c;
  switch (command) {
    case "serve": {
      // The dashboard hosted: reports posted by CI, one page over every repository.
      const token = opt("--token") || tokenFromEnv();
      /** @type {ReturnType<typeof createService>} */
      let svc;
      try {
        svc = createService({
          dataDir: opt("--data") || join(dir, ".abatty", "hosted"),
          token,
          noAuth: flag("--no-auth"),
          abattyVersion: VERSION,
        });
      } catch (e) {
        err(`${t.glyph.fail} ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(2);
      }
      const port = Number(opt("--port") || portFromEnv() || 8787);
      svc.server.listen(port, () => {
        out(
          `\n${t.banner(VERSION)}  ${t.bold("serve")} ${t.gray(`· http://localhost:${port}/ · reports under ${svc.store.root} · ${flag("--no-auth") ? t.yellow("no auth") : "bearer token on POST /reports"}`)}\n\n`,
        );
      });
      await new Promise(() => {});
      break;
    }
    case "publish": {
      // The CI step: post the newest report (measured now when there is none) to a service.
      const to = opt("--to") || dashboardFromEnv();
      if (!to) {
        err(`${t.glyph.fail} --to <url> (or ABATTY_DASHBOARD) names the service\n`);
        process.exit(2);
      }
      const report = latestReport(dir) || (await buildReport(dir, { abattyVersion: VERSION }));
      try {
        const r = await publishReport({
          url: to,
          token: opt("--token") || tokenFromEnv(),
          report,
        });
        out(
          `${r.ok ? t.glyph.ok : t.glyph.fail} publish: ${r.status} ${t.gray(JSON.stringify(r.body))}\n`,
        );
        process.exit(r.ok ? 0 : 1);
      } catch (e) {
        err(`${t.glyph.fail} publish failed: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(1);
      }
    }
  }
}
