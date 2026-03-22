import z from "zod"
export const SignUpSchema = z.object({

    name : z.string(),
    email : z.string(),
    password : z.string()

})
export const SignInSchema = z.object({
    email : z.string(),
    password : z.string()
})
