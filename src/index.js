#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const tar = require("tar");
const { program } = require("commander");
const prettier = require("prettier");
const deepmerge = require("deepmerge");
const pkg = require("../package.json");

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .argument("<project-name>", "directory where a project will be created")
  .option("--re-frame", "add re-frame setup")
  .option("--react-native", "setup in existing React Native project");

program.parse();

const [projectName] = program.args;
const { reFrame, reactNative } = program.opts();

const masterUrl =
  "https://github.com/pitch-io/uix-starter/archive/master.tar.gz";
const reframeUrl =
  "https://github.com/pitch-io/uix-starter/archive/re-frame.tar.gz";
const reactNativeUrl =
  "https://github.com/pitch-io/uix-starter/archive/react-native.tar.gz";

const downloadUrl = reactNative
  ? reactNativeUrl
  : reFrame
  ? reframeUrl
  : masterUrl;

if (!projectName && !reactNative) {
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
          r.data
            .pipe(tar.extract({ cwd: process.cwd() }))
            .on("end", () => {
              if (!reactNative) {
                fs.renameSync(
                  path.join(
                    process.cwd(),
                    reFrame ? "uix-starter-re-frame" : "uix-starter-main"
                  ),
                  path.join(process.cwd(), projectName)
                );
              }
              resolve();
            })
            .on("error", (err) => reject(err));
        })
    )
    .then(() => {
      if (reactNative) {
        const pkgjsonTmpl = JSON.parse(
          fs.readFileSync(
            path.join(
              process.cwd(),
              "uix-starter-react-native",
              "package.json"
            ),
            "utf8"
          )
        );
        const pkgjsonPrjct = JSON.parse(
          fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
        );

        // update package.json
        fs.writeFileSync(
          path.join(process.cwd(), "package.json"),
          prettier.format(
            JSON.stringify(deepmerge(pkgjsonPrjct, pkgjsonTmpl)),
            {
              parser: "json",
            }
          )
        );

        fs.renameSync(
          path.join(process.cwd(), "uix-starter-react-native", "src"),
          path.join(process.cwd(), "src")
        );

        fs.renameSync(
          path.join(process.cwd(), "uix-starter-react-native", "dev"),
          path.join(process.cwd(), "dev")
        );

        fs.renameSync(
          path.join(process.cwd(), "uix-starter-react-native", "deps.edn"),
          path.join(process.cwd(), "deps.edn")
        );

        fs.renameSync(
          path.join(
            process.cwd(),
            "uix-starter-react-native",
            "shadow-cljs.edn"
          ),
          path.join(process.cwd(), "shadow-cljs.edn")
        );

        fs.rmSync("uix-starter-react-native", { recursive: true });

        const coreNs = fs.readFileSync(
          path.join(process.cwd(), "src/app/core.cljs"),
          "utf8"
        );
        fs.writeFileSync(
          path.join(process.cwd(), "src/app/core.cljs"),
          coreNs.replace("{{app-name}}", projectName)
        );

        console.log("Done.");
        console.log("yarn cljs:dev # run dev build in watch mode");
        console.log("yarn cljs:release # build production bundle");
      } else {
        const pkgjson = JSON.parse(
          fs.readFileSync(
            path.join(process.cwd(), projectName, "package.json"),
            "utf8"
          )
        );
        pkgjson.name = projectName;
        fs.writeFileSync(
          path.join(process.cwd(), projectName, "package.json"),
          prettier.format(JSON.stringify(pkgjson), {
            parser: "json",
          })
        );
        const readme = fs.readFileSync(
          path.join(process.cwd(), projectName, "README.md"),
          "utf8"
        );
        fs.writeFileSync(
          path.join(process.cwd(), projectName, "README.md"),
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
            console.log(
              "yarn dev # run dev build in watch mode with CLJS REPL"
            );
            console.log("yarn release # build production bundle");
          }
        });
      }
    });
}
