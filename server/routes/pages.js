import express from 'express';

const router = express.Router();

router.get("/", (req, res) => {
    res.render("landing", { user: req.cookies.token });
});

router.get("/login", (req, res) => {
    res.render("login");
});

router.get("/register", (req, res) => {
    res.render("register");
});

router.get("/contact", (req, res) => {
    res.render("contact");
});

router.get("/privacy", (req, res) => {
    res.render("privacy");
});

router.get("/terms", (req, res) => {
    res.render("terms");
});

router.get("/forgot-password", (req, res) => {
    res.render("forgot");
});

router.get("/reset-password/:token", (req, res) => {
    res.render("reset", { token: req.params.token });
});

export default router;