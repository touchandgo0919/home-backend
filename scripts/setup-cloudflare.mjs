import { execFileSync } from "node:child_process";
import fs from "node:fs";

const databaseName = "homepage";
const configPath = "wrangler.toml";

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
}

function ensureDatabaseId() {
  const config = fs.readFileSync(configPath, "utf8");
  const existing = config.match(/database_id\s*=\s*"([^"]+)"/)?.[1];

  if (existing && existing !== "00000000-0000-0000-0000-000000000000") {
    console.log(`Using existing D1 database_id ${existing}`);
    return existing;
  }

  const output = run("npx", ["wrangler", "d1", "create", databaseName]);
  const id = output.match(/database_id\s*=\s*"([^"]+)"/)?.[1] || output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];

  if (!id) {
    throw new Error("Unable to read database_id from wrangler output.");
  }

  fs.writeFileSync(configPath, config.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${id}"`));
  console.log(`Updated ${configPath} with D1 database_id ${id}`);
  return id;
}

ensureDatabaseId();
run("npx", ["wrangler", "d1", "migrations", "apply", databaseName, "--remote"]);
console.log("Cloudflare D1 is ready.");
