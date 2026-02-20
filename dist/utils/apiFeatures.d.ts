/**
 * APIFeatures - Prisma Query Builder
 * Converts URL query params to Prisma queries (filter, sort, pagination, select)
 */
export interface QueryString {
    page?: string;
    limit?: string;
    sort?: string;
    fields?: string;
    [key: string]: any;
}
export interface PrismaQuery {
    where?: any;
    orderBy?: any;
    select?: any;
    skip?: number;
    take?: number;
    relationsDisabled?: boolean;
}
export default class APIFeatures {
    private prismaQuery;
    private queryString;
    constructor(queryString: QueryString);
    /**
     * Filter: Convert URL params to Prisma where clause
     * Example: ?price[gte]=100&name=Bella
     * → { where: { price: { gte: 100 }, name: 'Bella' } }
     */
    filter(): this;
    /**
     * Sort: Convert comma-separated fields to Prisma orderBy
     * Example: ?sort=-createdAt,name
     * → { orderBy: [{ createdAt: 'desc' }, { name: 'asc' }] }
     */
    sort(): this;
    /**
     * Limit Fields: Convert to Prisma select
     * Example: ?fields=name,breed,owner
     * → { select: { name: true, breed: true, owner: true } }
     */
    limitFields(): this;
    relations(): this;
    /**
     * Paginate: Convert to Prisma skip/take
     * Example: ?page=2&limit=10
     * → { skip: 10, take: 10 }
     */
    paginate(): this;
    /**
     * Get the final Prisma query object
     */
    getQuery(): PrismaQuery;
    /**
     * Get pagination metadata
     */
    getPaginationMeta(): {
        page: number;
        limit: number;
        skip: number;
    };
}
export declare const parseFields: (fields: string | any) => Record<string, boolean>;
//# sourceMappingURL=apiFeatures.d.ts.map