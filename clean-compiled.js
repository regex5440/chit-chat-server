const fs = require("fs");
const path = require("path");

const ignorePaths = ["node_modules", ".git", ".husky"];
const explore = (dirName) => {
  const files = fs.readdirSync(dirName);
  files.forEach((name) => {
    if (ignorePaths.includes(name)) return;
    const fullPath = path.join(dirName, name);
    const stats = fs.statSync(fullPath);
    if (stats.isFile()) {
      if (/^[^.]*\.ts$/gi.test(name)) {
        const tsFileWithJsExtention = name.replace(/\.ts$/, ".js");
        const compiledJSFile = path.join(dirName, tsFileWithJsExtention);
        if (fs.existsSync(compiledJSFile)) {
          fs.rmSync(compiledJSFile);
        }
      }
    } else if (stats.isDirectory()) {
      explore(fullPath);
    }
  });
};
explore(__dirname);
