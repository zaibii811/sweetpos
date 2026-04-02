import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const isProd = process.env.NODE_ENV === "production";

// Build allowed origins: always include known production domains + localhost for dev,
// plus anything extra set in CORS_ORIGIN env var (comma-separated).
const ALWAYS_ALLOWED = [
  "https://sweetpos.vercel.app",
  "https://sweetpos-sweet-pos.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];
const envOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...ALWAYS_ALLOWED, ...envOrigins]));

const corsOptions: cors.CorsOptions = {
  origin(requestOrigin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!requestOrigin) return callback(null, true);
    if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
    callback(new Error(`CORS: origin not allowed — ${requestOrigin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

// Handle OPTIONS preflight for every route BEFORE any other middleware
// Express 5 requires explicit wildcard syntax — "/*path" not "*"
app.options("/*path", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET ?? (() => {
      if (isProd) throw new Error("SESSION_SECRET environment variable is required in production");
      return "sweetpos-dev-secret-not-for-production";
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

export default app;
