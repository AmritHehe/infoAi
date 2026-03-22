import { Router } from "express";
import { ExtractUserInfoController } from "../controllers/extractInfo.controllers";

export const ExtractInfoRouter = Router()

ExtractInfoRouter.post("/getUserInfo", ExtractUserInfoController)
