import { Hono } from "hono";
import { container } from "../container";
import { authMiddleware } from "../middleware/auth.middleware";
import { hierarchyMiddleware } from "../middleware/hierarchy.middleware";

const router = new Hono();

router.post("/auth/login", (c) => container.authController.login(c));
router.post("/auth/dev", (c) => container.authController.devLogin(c));
router.post("/auth/google", (c) => container.authController.google(c));
router.post("/auth/refresh", (c) => container.authController.refresh(c));
router.get("/auth/me", (c) => container.authController.me(c));
router.post("/auth/logout", (c) => container.authController.logout(c));

router.get("/employee/:id", authMiddleware, (c) => container.employeeController.getByEmployeeId(c));
router.get("/employee/:id/hierarchy", authMiddleware, (c) => container.employeeController.getHierarchy(c));

router.get("/sales/:id/commission", authMiddleware, hierarchyMiddleware, (c) =>
  container.commissionController.salesCommission(c),
);
router.get("/sales/:id/invoice", authMiddleware, hierarchyMiddleware, (c) =>
  container.commissionController.salesInvoice(c),
);

router.get("/feedback", authMiddleware, (c) => container.feedbackController.index(c));
router.post("/feedback", authMiddleware, (c) => container.feedbackController.store(c));

export default router;
