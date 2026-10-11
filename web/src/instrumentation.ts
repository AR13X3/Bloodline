// Runs once when the Next.js server starts.
export async function register() {
  // Repeat alerts need a timer that keeps running whether or not anyone has the app or console open.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRepeatScheduler } = await import("./server/notify/reminders");
    startRepeatScheduler();
  }
}
