import { feedbackConfig } from "../config/feedback.config";
import type { FeedbackItem, IFeedbackRepository } from "../interface/feedback.interface";

const UPLOAD_DIR = "uploads/feedback";

export class FeedbackRepository implements IFeedbackRepository {
  async saveImages(employeeId: string, imageFiles: File[]): Promise<string[]> {
    const timestamp = Date.now();
    const imageUrls: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]!;
      const rawExt = file.type.split("/")[1];
      const ext = rawExt === "jpeg" ? "jpg" : rawExt;
      const fileName = `${employeeId}_${timestamp}_${i}.${ext}`;

      // Bun.write creates any missing parent directories automatically.
      await Bun.write(`${UPLOAD_DIR}/${fileName}`, file);

      imageUrls.push(`${feedbackConfig.appUrl}/uploads/feedback/${fileName}`);
    }

    return imageUrls;
  }

  notify(item: FeedbackItem): void {
    if (!feedbackConfig.feedbackUrl) return;

    fetch(feedbackConfig.feedbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }).catch(() => {});
  }

  async findAll(): Promise<FeedbackItem[]> {
    if (!feedbackConfig.feedbackUrl) return [];

    const response = await fetch(feedbackConfig.feedbackUrl);
    if (!response.ok) return [];

    // The external service can respond 200 with an error payload (e.g. its
    // own script failing) instead of the expected array — degrade to empty
    // rather than let a shape mismatch blow up the caller.
    const data = await response.json();
    return Array.isArray(data) ? (data as FeedbackItem[]) : [];
  }
}
