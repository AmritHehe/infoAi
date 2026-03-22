import express from "express"
import cors from "cors"
import { authRouter } from "./routes/auth.routes"
import { ExtractInfoRouter } from "./routes/extractInfo.routes"
import { ChatbotRouter } from "./routes/charbot.routes"
import { RAGRouter } from "./routes/RAG.routes"
import { TokenVerification } from "./middlwares/auth.middleware"
import { RateLimiter } from "./middlwares/rateLimiter.middleware"

const app = express()

app.use(express.json())
app.use(cors())

app.use("/" , authRouter)
app.use("/" ,TokenVerification, RateLimiter, ExtractInfoRouter)
app.use("/" ,TokenVerification, RateLimiter, ChatbotRouter)
app.use("/rag" ,TokenVerification, RateLimiter, RAGRouter)

app.get("/" , ( req , res)=> { 
    res.status(200).json({
        message : "server running healthy on port 3000"
    })
})


app.listen(3000,()=>{console.log("server is running on port 3000")})