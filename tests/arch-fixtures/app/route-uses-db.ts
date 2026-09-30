import { db } from "../db/client";
export const GET = () => db; // violates no-db-in-ui-and-routes
