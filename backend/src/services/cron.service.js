import cron from "node-cron";
import Note from "../models/note.model.js";

export const startCronJobs = () => {
  // The cron expression '0 0 * * *' means:
  // Minute: 0, Hour: 0 (Midnight), Day of Month: *, Month: *, Day of Week: *
  // This runs exactly once a day at 00:00 server time.
  cron.schedule("0 0 * * *", async () => {
    console.log(
      "[Cron Job] Running daily garbage collection for deleted notes...",
    );

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Note.deleteMany({
        is_deleted: true,
        updated_at: { $lt: thirtyDaysAgo },
      });

      console.log(
        `[Cron Job] Successfully permanently deleted ${result.deletedCount} old notes.`,
      );
    } catch (error) {
      console.error("[Cron Job] Error during garbage collection:", error);
    }
  });

  console.log("Cron jobs initialized.");
};
