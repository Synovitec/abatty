import { test } from "node:test";
test("abatty control: planted to fail", () => {
  throw new Error("planted");
});
