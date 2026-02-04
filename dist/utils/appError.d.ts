export default class AppError extends Error {
    readonly statusCode: number;
    status: "fail" | "error";
    readonly isOperational: boolean;
    constructor(message: string, statusCode: number);
}
//# sourceMappingURL=appError.d.ts.map