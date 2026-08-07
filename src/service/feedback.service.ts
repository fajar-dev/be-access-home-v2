import type {
  FeedbackInput,
  FeedbackItem,
  IFeedbackRepository,
  IFeedbackService,
} from "../interface/feedback.interface";

export class FeedbackService implements IFeedbackService {
  constructor(private readonly feedbackRepository: IFeedbackRepository) {}

  async submitFeedback(
    employeeId: string,
    name: string,
    data: FeedbackInput,
    imageFiles: File[],
  ): Promise<string[]> {
    const imageUrls = await this.feedbackRepository.saveImages(employeeId, imageFiles);

    this.feedbackRepository.notify({
      employeeId: String(employeeId),
      name,
      image: imageUrls,
      url: data.url ?? "",
      type: data.type,
      message: data.message,
    });

    return imageUrls;
  }

  async getByEmployeeId(employeeId: string): Promise<FeedbackItem[]> {
    const items = await this.feedbackRepository.findAll();
    return items.filter((item) => String(item.employeeId) === String(employeeId));
  }
}
