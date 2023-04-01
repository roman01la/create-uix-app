#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const pack = require("tar-pack");
const { program } = require("commander");
const prettier = require("prettier");
const pkg = require("../package.json");

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .argument("<project-name>", "directory where a project will be created")
  .option("--re-frame", "add re-frame setup");

program.parse();

const [projectName] = program.args;
const { reFrame } = program.opts();

const masterUrl =
  "https://github.com/pitch-io/uix-starter/archive/master.tar.gz";
const reframeUrl =
  "https://github.com/pitch-io/uix-starter/archive/re-frame.tar.gz";

const downloadUrl = reFrame ? reframeUrl : masterUrl;

if (!projectName) {
  program.help();
} else {
  console.log(
    "Downloading project template from https://github.com/pitch-io/uix-starter..."
  );
  axios
    .get(downloadUrl, {
      responseType: "stream",
    })
    .then(
      (r) =>
        new Promise((resolve, reject) => {
          console.log(`Unpacking into ${projectName}...`);
          r.data.pipe(
            pack.unpack(projectName, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            })
          );
        })
    )
    .then(() => {
      const pkgjson = JSON.parse(
        fs.readFileSync(path.join(projectName, "package.json"), "utf8")
      );
      pkgjson.name = projectName;
      fs.writeFileSync(
        path.join(projectName, "package.json"),
        prettier.format(JSON.stringify(pkgjson), {
          parser: "json",
        })
      );
      const readme = fs.readFileSync(
        path.join(projectName, "README.md"),
        "utf8"
      );
      fs.writeFileSync(
        path.join(projectName, "README.md"),
        readme
          .replace("uix-starter", projectName)
          .split("\n")
          .filter((l) => !l.startsWith("Template project"))
          .join("\n")
      );
      console.log("Installing dependencies...");
      exec(`cd ${projectName} && yarn install`, (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log("Done.");
          console.log("\n");
          console.log("yarn dev # run dev build in watch mode with CLJS REPL");
          console.log("yarn release # build production bundle");
        }
      });
    });
}
