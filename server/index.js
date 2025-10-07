import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import setupMiddleware from "./middleware/index.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import paymentRoutes from "./routes/payment.js";
import dashboardRoutes from "./routes/dashboard.js";
import licenseServer from "./license-server.js";
import pagesRouter from "./routes/pages.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

connectDB();
setupMiddleware(app);

app.use("/license", licenseServer);
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/payment", paymentRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/", pagesRouter);

app.use((req, res) => {
    res.status(404).render("404");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("500");
});

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

process.on("uncaughtException", (err, origin) => {
    console.error(`Caught exception: ${err}`, `Exception origin: ${origin}`);
    server.close(() => {
        process.exit(1);
    });
});

export default app;