import { Router } from "express";
import { SignInController, SignUpController } from "../controllers/auth.controllers";

export const authRouter = Router()

authRouter.post("/signup", SignUpController)
authRouter.post("/signin", SignInController)