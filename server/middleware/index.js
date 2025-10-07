import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const setupMiddleware = (app) => {
    app.set("trust proxy", 1);

    app.use((req, res, next) => {
        if (req.originalUrl === "/payment/webhook") {
            next();
        } else {
            express.json()(req, res, next);
        }
    });

    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(morgan("combined"));

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
    });
    app.use(limiter);

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.use(express.static(path.join(__dirname, "..", "public")));
};

export default setupMiddleware;