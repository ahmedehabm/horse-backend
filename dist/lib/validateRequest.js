import AppError from "../utils/appError.js";
export const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
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