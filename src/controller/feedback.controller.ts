import type { Context } from "hono";
import { successResponse } from "../helper/api-response.helper";
import type { IEmployeeService } from "../interface/employee.interface";
import type { IFeedbackService } from "../interface/feedback.interface";

export class FeedbackController {
  constructor(
    private readonly feedbackService: IFeedbackService,
    private readonly employeeService: IEmployeeService,
  ) {}

  async index(c: Context) {
    const user = c.get("user");
    const data = await this.feedbackService.getByEmployeeId(user.sub);
    return c.json(successResponse("Feedback retrieved successfully", data));
  }

  async store(c: Context) {
    const user = c.get("user");

    const body = await c.req.parseBody({ all: true });
    const message = body["message"] as string;
    const type = body["type"] as string;
    const url = body["url"] as string | undefined;

    const raw = body["images"];
    const imageFiles = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
      (f): f is File => f instanceof File,
    );

    const employee = await this.employeeService.findByEmployeeId(user.sub);
    const name = employee?.name ?? user.sub;

    await this.feedbackService.submitFeedback(user.sub, name, { message, type, url }, imageFiles);

    return c.json(successResponse("Feedback submitted successfully", null), 201);
  }
}
