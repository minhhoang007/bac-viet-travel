import { b } from "./cycle-b";
export const a = () => b; // violates no-circular
