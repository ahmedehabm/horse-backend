// src/utils/apiFeatures.ts
/**
 * APIFeatures - Prisma Query Builder
 * Converts URL query params to Prisma queries (filter, sort, pagination, select)
 */
export default class APIFeatures {
    prismaQuery = {};
    queryString;
    constructor(queryString) {
        this.queryString = queryString;
    }
    /**
     * Filter: Convert URL params to Prisma where clause
     * Example: ?price[gte]=100&name=Bella
     * → { where: { price: { gte: 100 }, name: 'Bella' } }
     */
    filter() {
        const { page, limit, sort, fields, relations, ...filtersRaw } = this.queryString;
        const filters = {};
        Object.entries(filtersRaw).forEach(([key, value]) => {
            if (typeof value === "string") {
                const match = key.match(/(.+)\[(.+)\]$/);
                if (match) {
                    const [, field, operator] = match;
                    // ✅ SAFE: Ensure operator exists
                    if (!operator || !field)
                        return;
                    if (!filters[field])
                        filters[field] = {};
                    const opMap = {
                        gte: "gte",
                        gt: "gt",
                        lte: "lte",
                        lt: "lt",
                        ne: "not",
                        in: "in",
                        contains: "contains",
                    };
                    // ✅ FIXED LINE - TypeScript safe
                    const safeOperator = opMap[operator] || operator;
                    filters[field][safeOperator] = value;
                }
                else {
                    // ✅ HANDLE NULL SPECIALLY
                    if (value.toLowerCase() === "null") {
                        filters[key] = null;
                    }
                    else {
                        filters[key] = value;
                    }
                }
            }
        });
        this.prismaQuery.where =
            Object.keys(filters).length > 0 ? filters : undefined;
        return this;
    }
    /**
     * Sort: Convert comma-separated fields to Prisma orderBy
     * Example: ?sort=-createdAt,name
     * → { orderBy: [{ createdAt: 'desc' }, { name: 'asc' }] }
     */
    sort() {
        const { sort = "-createdAt" } = this.queryString;
        const orderBy = sort.split(",").map((field) => {
            const isDescending = field.startsWith("-");
            const fieldName = isDescending ? field.slice(1) : field;
            return { [fieldName]: isDescending ? "desc" : "asc" };
        });
        this.prismaQuery.orderBy = orderBy;
        return this;
    }
    /**
     * Limit Fields: Convert to Prisma select
     * Example: ?fields=name,breed,owner
     * → { select: { name: true, breed: true, owner: true } }
     */
    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(",");
            const select = { id: true };
            fields.forEach((field) => {
                const trimmed = field.trim();
                if (trimmed)
                    select[trimmed] = true;
            });
            this.prismaQuery.select = select;
        }
        return this;
    }
    relations() {
        const { relations } = this.queryString;
        if (relations === "false") {
            // Flag to disable relations in controller
            this.prismaQuery.relationsDisabled = true;
        }
        return this;
    }
    /**
     * Paginate: Convert to Prisma skip/take
     * Example: ?page=2&limit=10
     * → { skip: 10, take: 10 }
     */
    paginate() {
        const page = parseInt(this.queryString.page || "1", 10);
        const limit = parseInt(this.queryString.limit || "100", 10);
        const skip = (page - 1) * limit;
        this.prismaQuery.skip = skip;
        this.prismaQuery.take = limit;
        return this;
    }
    /**
     * Get the final Prisma query object
     */
    getQuery() {
        return this.prismaQuery;
    }
    /**
     * Get pagination metadata
     */
    getPaginationMeta() {
        const page = parseInt(this.queryString.page || "1", 10);
        const limit = parseInt(this.queryString.limit || "100", 10);
        return {
            page,
            limit,
            skip: this.prismaQuery.skip || 0,
        };
    }
}
export const parseFields = (fields) => {
    const fieldMap = { id: true };
    fields.split(",").forEach((f) => {
        if (f.trim())
            fieldMap[f.trim()] = true;
    });
    return fieldMap;
};
//# sourceMappingURL=apiFeatures.js.map