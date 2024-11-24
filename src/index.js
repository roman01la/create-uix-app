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

function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .argument("<project-name>", "directory where a project will be created")
  .option("--re-frame", "add re-frame setup")
  .option("--react-native", "setup in existing React Native project")
  .option("--expo", "create a new React Native project using Expo")
  .option("--fly-io", "creates full stack app with Fly.io");

program.parse();

const [projectName] = program.args;
const { reFrame, reactNative, expo, flyIo } = program.opts();

const masterUrl =
  "https://github.com/pitch-io/uix-starter/archive/master.tar.gz";
const reframeUrl =
  "https://github.com/pitch-io/uix-starter/archive/re-frame.tar.gz";
const reactNativeUrl =
  "https://github.com/pitch-io/uix-starter/archive/react-native.tar.gz";
const reactNativeExpoUrl =
  "https://github.com/pitch-io/uix-starter/archive/react-native-expo.tar.gz";
const flyioUrl =
  "https://github.com/pitch-io/uix-starter/archive/fly-io.tar.gz";

let downloadUrl;

if (reactNative) {
  downloadUrl = reactNativeUrl;
} else if (expo) {
  downloadUrl = reactNativeExpoUrl;
} else if (reFrame) {
  downloadUrl = reframeUrl;
} else if (flyIo) {
  downloadUrl = flyioUrl;
} else {
  downloadUrl = masterUrl;
}

if (!projectName && !reFrame && !reactNative && !expo && !flyIo) {
  program.help();
} else {
  let folderName;
  if (reFrame) {
    folderName = "uix-starter-re-frame";
  } else if (expo) {
    folderName = "uix-starter-react-native-expo";
  } else if (flyIo) {
    folderName = "uix-starter-fly-io";
  } else {
    pfolderName = "uix-starter-main";
  }
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
                  path.join(process.cwd(), folderName),
                  path.join(process.cwd(), projectName)
                );
              }
              resolve();
            })
            .on("error", (err) => reject(err));
        })
    )
    .then(() => {
      if (expo) {
        const appjson = JSON.parse(
          fs.readFileSync(
            path.join(process.cwd(), projectName, "app.json"),
            "utf8"
          )
        );
        appjson.expo.name = projectName;
        appjson.expo.slug = camelToKebab(projectName);
        fs.writeFileSync(
          path.join(process.cwd(), projectName, "app.json"),
          prettier.format(JSON.stringify(appjson), {
            parser: "json",
          })
        );

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
        const pDeps = exec(`cd ${projectName} && npm install`, (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log();
            console.log("Using:");
            console.log(
              Object.entries(pkgjson.dependencies)
                .map(([k, v]) => `${k}@${v}`)
                .join("\n")
            );
            console.log();
            console.log(
              "npm run dev # run dev build with Expo and cljs build in watch mode"
            );
            console.log("npm run cljs:release # build production bundle");
          }
        });
        pDeps.stdout.pipe(process.stdout);
        pDeps.stderr.pipe(process.stderr);
      } else if (reactNative) {
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

        fs.writeFileSync(
          path.join(process.cwd(), "index.js"),
          `import "./app/index.js";`
        );

        if (fs.existsSync(".gitignore")) {
          fs.appendFileSync(
            path.join(process.cwd(), ".gitignore"),
            `
.cpcache/
.shadow-cljs/
app/`
          );
        }
        console.log("npm run cljs:dev # run dev build in watch mode");
        console.log("npm run cljs:release # build production bundle");
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
        const toml = fs.readFileSync(
          path.join(process.cwd(), projectName, "fly.toml"),
          "utf8"
        );
        fs.writeFileSync(
          path.join(process.cwd(), projectName, "fly.toml"),
          toml.replace("uix-starter", projectName)
        );
        console.log("Installing dependencies...");
        const pDeps = exec(`cd ${projectName} && npm install`, (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log();
            console.log("Using:");
            console.log(
              Object.entries(pkgjson.devDependencies)
                .map(([k, v]) => `${k}@${v}`)
                .join("\n")
            );
            console.log();
            console.log(
              "Development\n" +
                "npm run dev # run dev build in watch mode with CLJS REPL\n" +
                "clojure -M -m app.core # or run the server from REPL"
            );
            console.log(
              "Deployment\n" +
                "install Fly.io CLI https://fly.io/docs/flyctl/install/\n" +
                "fly app create uix-starter # create a new Fly.io app, run once\n" +
                "fly deploy"
            );
          }
        });
        pDeps.stdout.pipe(process.stdout);
        pDeps.stderr.pipe(process.stderr);
      }
    });
}
