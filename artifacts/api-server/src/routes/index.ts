import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import ordersRouter from "./orders";
import staffRouter from "./staff";
import reportsRouter from "./reports";
import consumablesRouter from "./consumables";
import stockAdjustmentsRouter from "./stock-adjustments";
import bagSizeRulesRouter from "./bag-size-rules";
import inventoryAlertsRouter from "./inventory-alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(staffRouter);
router.use(reportsRouter);
router.use(consumablesRouter);
router.use(stockAdjustmentsRouter);
router.use(bagSizeRulesRouter);
router.use(inventoryAlertsRouter);

export default router;
