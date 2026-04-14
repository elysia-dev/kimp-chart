import * as esbuild from "esbuild";
import * as path from "path";

const isWatch = process.argv.includes("--watch");

const entries = [{ entry: "../src/client/candle.ts", out: "../public/candle.js" }];

async function build() {
  for (const { entry, out } of entries) {
    const ctx = await esbuild.context({
      entryPoints: [path.resolve(__dirname, entry)],
      bundle: true,
      outfile: path.resolve(__dirname, out),
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      minify: !isWatch,
      sourcemap: isWatch,
    });

    if (isWatch) {
      console.log(`Watching ${entry}...`);
      await ctx.watch();
    } else {
      await ctx.rebuild();
      await ctx.dispose();
      console.log(`Build complete: ${out}`);
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
