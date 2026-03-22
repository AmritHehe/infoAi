import { Router } from "express";
import { RAGChatController, RAGchunkProfileDataController, RAGProfileStatusController } from "../controllers/rag.controllers";

export const RAGRouter = Router()

RAGRouter.post("/index/:profileId", RAGchunkProfileDataController)
RAGRouter.get("/status/:profileId", RAGProfileStatusController)
RAGRouter.post("/chat", RAGChatController)
