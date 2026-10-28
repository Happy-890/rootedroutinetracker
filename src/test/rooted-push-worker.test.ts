// Exercise the actual worker: the chosen title must reach the device notification.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("shows each reminder's selected title, message and independent tag", async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const shown: { title: string; options: { body: string; tag: string } }[] = [];
  runInNewContext(readFileSync("public/rooted-push-handlers.js", "utf8"), {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      registration: {
        showNotification: (title: string, options: { body: string; tag: string }) => {
          shown.push({ title, options });
          return Promise.resolve();
        },
      },
    },
  });
  const push = handlers.get("push");
  if (!push) throw new Error("Missing push handler");
  const pending: Promise<void>[] = [];
  for (const id of ["morning", "evening"])
    push({
      data: {
        json: () => ({
          title: `Check-in ${id}`,
          body: "Go ALL OUT!!",
          tag: `rooted-reminder-${id}`,
        }),
      },
      waitUntil: (promise: Promise<void>) => pending.push(promise),
    });
  await Promise.all(pending);
  expect(shown[0]?.title).toBe("Check-in morning");
  expect(shown[0]?.options.body).toBe("Go ALL OUT!!");
  expect(shown[1]?.title).toBe("Check-in evening");
  expect(shown[0]?.options.tag).not.toBe(shown[1]?.options.tag);
});
