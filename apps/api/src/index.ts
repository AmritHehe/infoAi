import express from "express"
import cors from "cors"
import { authRouter } from "./routes/auth.routes"
import { ExtractInfoRouter } from "./routes/extractInfo.routes"
import { ChatbotRouter } from "./routes/charbot.routes"
import { RAGRouter } from "./routes/RAG.routes"
import { TokenVerification, OptionalTokenVerification } from "./middlwares/auth.middleware"
import { RateLimiter } from "./middlwares/rateLimiter.middleware"

const app = express()

app.use(express.json())
app.use(cors())

app.use("/" , authRouter)
// Profile extraction needs no user id tracking at all
app.use("/" , RateLimiter, ExtractInfoRouter)
// Chat endpoints handle guest vs user tracking via optional JWT
app.use("/" , OptionalTokenVerification, RateLimiter, ChatbotRouter)
app.use("/rag" , OptionalTokenVerification, RateLimiter, RAGRouter)

app.get("/" , ( req , res)=> { 
    res.status(200).json({
        message : "server running healthy on port 3005"
    })
})


const server = app.listen(3005,()=>{console.log("server is running on port 3005")})

import { prisma } from "@repo/database";
const gracefulShutdown = async () => {
    console.log("Shutting down gracefully...");
    await prisma.$disconnect();
    server.close(() => {
        console.log("Server closed.");
        process.exit(0);
    });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);