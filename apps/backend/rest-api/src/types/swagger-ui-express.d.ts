declare module "swagger-ui-express" {
  import type { RequestHandler } from "express";

  export function setup(swaggerDoc: object): RequestHandler[];
  export const serve: RequestHandler[];
}
