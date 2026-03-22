import { Router } from "express";
import { GetSessionsController, NewMessageController, NewSessionController } from "../controllers/chatbot.controller";

export const ChatbotRouter = Router()

ChatbotRouter.post("/start", NewSessionController)
ChatbotRouter.post("/message", NewMessageController)
ChatbotRouter.get("/sessions", GetSessionsController)