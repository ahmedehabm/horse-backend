import Bree from "bree";
/**
 * Bree scheduler - runs jobs in separate worker threads
 * Jobs can't block the main application!
 */
export declare const scheduler: Bree;
/**
 * Start the scheduler
 */
export declare function startScheduler(): void;
/**
 * Stop the scheduler gracefully
 */
export declare function stopScheduler(): Promise<void>;
//# sourceMappingURL=index.d.ts.map