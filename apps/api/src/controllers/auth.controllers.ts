import type { Request  , Response } from "express"
import { prisma } from "@repo/database"
import { SignInSchema , SignUpSchema } from "../validators/auth.validators"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

export async function  SignUpController ( req : Request  , res : Response ){ 

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
        const ExisitngUser = await prisma.user.findUnique({
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

        const newUser = await prisma.user.create({
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
}

export async function  SignInController ( req : Request  , res : Response ) { 
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
        const ExistingUser = await prisma.user.findUnique({
            where : { 
                email : data.email
            }
        })
        if(!ExistingUser){ 
            return res.status(401).json({
                success : false , 
                data : null , 
                message : "User Doesnt exist",
                error : "UNAUTHORIZED"
            })
        }
        const isPasswordCorrect = await bcrypt.compare(data.password , ExistingUser.password)

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
        const JWTToken = jwt.sign(
            { userId: ExistingUser.id }, 
            secret, 
            { expiresIn: "7d" }
        );

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

}