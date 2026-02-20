import AppError from "../utils/appError.js";
export const validateRequest = (schema) => {
    return async (req, _res, next) => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            console.log(error);
            if (error.name === "ZodError") {
                const messageRegex = /"message":\s*"([^"]+)"/g;
                const messages = [];
                let match;
                while ((match = messageRegex.exec(error.message)) !== null) {
                    messages.push(match[1]);
                }
                // Join all messages
                const errorMessage = messages.join(", ");
                return next(new AppError(errorMessage, 400));
            }
        }
    };
};
//# sourceMappingURL=validateRequest.js.map