import type { Request , Response , NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken"
import { success } from "zod";

const jwtSecret = process.env.JWT_SECRET!
export async function TokenVerification(req : Request  , res :Response , next : NextFunction){
    const bearerToken :String | undefined = req.headers.authorization;
    if(!bearerToken || !bearerToken.startsWith('Bearer ')){
        return res.status(403).json({
            success : false , 
            error : "Token not present , Unauthorized"
        })
    }
    const tokenArray = bearerToken?.split(" ")
    const token = tokenArray[1];
    // console.log("token " + token)
    const decoded = jwt.verify(token , jwtSecret) as JwtPayload & {userId : string}
    if(!decoded){
        return res.status(403).json({
            success : false , 
            error : "coudnt verify the token"
        })
    }
    // console.log("user ID " + decoded.userId)
    // console.log("role" + decoded.role)
    req.userId  = decoded.userId
    next()
    
}

export async function OptionalTokenVerification(req: Request, res: Response, next: NextFunction) {
    const bearerToken: string | undefined = req.headers.authorization;
    if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
        return next();
    }
    const tokenArray = bearerToken.split(" ");
    const token = tokenArray[1];
    
    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload & { userId: string };
        if (decoded) {
            req.userId = decoded.userId;
        }
    } catch (err) {
        // Token invalid or expired, continue as guest
    }
    next();
}