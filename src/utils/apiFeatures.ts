// src/utils/apiFeatures.ts
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
  private prismaQuery: PrismaQuery = {};
  private queryString: QueryString;

  constructor(queryString: QueryString) {
    this.queryString = queryString;
  }

  /**
   * Filter: Convert URL params to Prisma where clause
   * Example: ?price[gte]=100&name=Bella
   * → { where: { price: { gte: 100 }, name: 'Bella' } }
   */
  filter(): this {
    const { page, limit, sort, fields, relations, ...filtersRaw } =
      this.queryString;

    const filters: Record<string, any> = {};

    Object.entries(filtersRaw).forEach(([key, value]) => {
      if (typeof value === "string") {
        const match = key.match(/(.+)\[(.+)\]$/);
        if (match) {
          const [, field, operator] = match;

          // ✅ SAFE: Ensure operator exists
          if (!operator || !field) return;

          if (!filters[field]) filters[field] = {};

          const opMap: Record<string, string> = {
            gte: "gte",
            gt: "gt",
            lte: "lte",
            lt: "lt",
            ne: "not",
            in: "in",
            contains: "contains",
          };

          // ✅ FIXED LINE - TypeScript safe
          const safeOperator =
            opMap[operator as keyof typeof opMap] || operator;
          (filters[field] as Record<string, string>)[safeOperator] = value;
        } else {
          // ✅ HANDLE NULL SPECIALLY
          if (value.toLowerCase() === "null") {
            filters[key] = null;
          } else {
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
  sort(): this {
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
  limitFields(): this {
    if (this.queryString.fields) {
      const fields = (this.queryString.fields as string).split(",");
      const select: Record<string, boolean> = { id: true };

      fields.forEach((field) => {
        const trimmed = field.trim();
        if (trimmed) select[trimmed] = true;
      });

      this.prismaQuery.select = select;
    }

    return this;
  }

  relations(): this {
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
  paginate(): this {
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
  getQuery(): PrismaQuery {
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

export const parseFields = (fields: string | any) => {
  const fieldMap: Record<string, boolean> = { id: true };
  fields.split(",").forEach((f: any) => {
    if (f.trim()) fieldMap[f.trim()] = true;
  });
  return fieldMap;
};
