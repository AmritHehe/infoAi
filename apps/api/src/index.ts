import { password } from "bun"
import express from "express"
import z, { email, success } from "zod"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
const app = express()

app.use(express.json())

const SignUpSchema = z.object({

    name : z.string(),
    email : z.string(),
    password : z.string()

})
const SignInSchema = z.object({
    email : z.string(),
    password : z.string()
})

app.get("/" , (req , res)=> { 
    res.json("server is running healthy")
})

app.post("/signup" , async  (req , res)=> { 
    const {data , success}  = SignUpSchema.safeParse(req.body)

    if(!data || !success){ 
        return res.status(400).json({
            success : false , 
            data : null , 
            message : "you have sent invalid request/wrong schema",
            error : "INVALID_REQUEST"
        })
    }
    try { 
        const ExisitngUser = await PrismaClient.users.findUnique({
            where : { 
                email : data.email
            }
        })
        if(ExisitngUser){ 
            return res.status(400).json({
                success : false , 
                data : null , 
                message : "User with this email id already exist",
                error : "INVALID_REQUEST"
            })
        }
    }
    catch(e){ 
        return res.status(500).json({
            success : false , 
            data : null , 
            error : "DATABASE_DOWN",
            message : "Couldnt connect to database" + JSON.stringify(e)
        })
    }
    try { 
        const hasedPassword = await bcrypt.hash(data.password , 10)

        const newUser = await PrismaClient.user.create({
            data : { 
                ...data ,
                password : hasedPassword       
            }
        })

        return res.status(201).json({
            success : true , 
            data : {
                email : data.email, 
                name : data.name
            },
            error : null ,
            message : "user created sucessfully"
        })
    }

    catch(e){
        return res.status(500).json({
            success : false , 
            data : null , 
            error : "DATABASE_DOWN",
            message : "Couldnt connect to database" + JSON.stringify(e)
        })  
    }
})

app.post("/signin" , async  (req , res)=> { 
    const {data , success}  = SignInSchema.safeParse(req.body)

    if(!data || !success){ 
        return res.status(400).json({
            success : false , 
            data : null , 
            message : "you have sent invalid request/wrong schema",
            error : "INVALID_REQUEST"
        })
    }
    try { 
        const ExisitngUser = await PrismaClient.users.findUnique({
            where : { 
                email : data.email
            }
        })
        if(!ExisitngUser){ 
            return res.status(401).json({
                success : false , 
                data : null , 
                message : "User Doesnt exist",
                error : "UNAUTHORIZED"
            })
        }
        const isPasswordCorrect = await bcrypt.compare(data.password , ExisitngUser.password)

        if(!isPasswordCorrect){ 
            return res.status(401).json({
                success : false , 
                data : null , 
                message : "User Doesnt exist",
                error : "UNAUTHORIZED"
            })
        }
        const secret = process.env.JWT_SECRET!
        if(!secret){ 
            return res.status(500).json({
                success : false,
                data : null , 
                error : "INVALID",
                message : "JWT SECRET NOT PRESENT IN BACKEND"
            })
        }
        const JWTToken = jwt.sign({} , secret)

        return res.status(200).json({
            success : true , 
            data : { 
                token : JWTToken,
            },
            error : null , 
            message : "Sucessfully Signed you In"
        })

    }
    catch(e){ 
        return res.status(500).json({
            success : false , 
            data : null , 
            error : "DATABASE_DOWN",
            message : "Couldnt connect to database" + JSON.stringify(e)
        })
    }

})

app.listen(3000, ()=> { 
    console.log("server is running on port 3000")
})
