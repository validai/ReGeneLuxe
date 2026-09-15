import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    operatorId?: string | null;
    user: DefaultSession["user"] & {
      id?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    operatorId?: string | null;
  }
}
