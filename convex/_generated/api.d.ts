/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as examAnswers from "../examAnswers.js";
import type * as examGrading from "../examGrading.js";
import type * as examMessages from "../examMessages.js";
import type * as examParticipants from "../examParticipants.js";
import type * as examSessions from "../examSessions.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_rateLimit from "../helpers/rateLimit.js";
import type * as helpers_roomCode from "../helpers/roomCode.js";
import type * as helpers_sanitize from "../helpers/sanitize.js";
import type * as http from "../http.js";
import type * as sharedQuizzes from "../sharedQuizzes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  examAnswers: typeof examAnswers;
  examGrading: typeof examGrading;
  examMessages: typeof examMessages;
  examParticipants: typeof examParticipants;
  examSessions: typeof examSessions;
  "helpers/auth": typeof helpers_auth;
  "helpers/rateLimit": typeof helpers_rateLimit;
  "helpers/roomCode": typeof helpers_roomCode;
  "helpers/sanitize": typeof helpers_sanitize;
  http: typeof http;
  sharedQuizzes: typeof sharedQuizzes;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
