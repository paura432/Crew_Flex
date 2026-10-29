import "server-only";
import type { TrainingQuery, TrainingWrite } from "@/lib/validation/training";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  TrainingCatalogResponse,
  TrainingCourseResponse,
  TrainingFavoriteResponse,
  TrainingFavoritesResponse,
  TrainingInboxResponse,
  TrainingMessageResponse,
  TrainingMessagesResponse,
  TrainingRequestResponse,
  TrainingRequestsResponse,
  TrainingReviewQueueResponse,
  TrainingSavedResponse,
  TrainingSessionsResponse,
  TrainingTransitionResponse,
  TrainingWorkspaceResponse,
} from "@/types/api";

// The one client of the `training` Edge Function (ADR-003): every training page and server action goes through here.

type View<V extends TrainingQuery["view"]> = Omit<Extract<TrainingQuery, { view: V }>, "view">;

const read = <T>(view: TrainingQuery["view"], params: Record<string, unknown> = {}) =>
  invokeEdgeFunction<T>("training", {
    query: Object.fromEntries(
      Object.entries({ view, ...params } as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)]),
    ),
  });

/** Any write op (the generic server action validates `trainingWrite` first). */
export const write = <T>(body: TrainingWrite, idempotencyKey?: string) =>
  invokeEdgeFunction<T>("training", {
    method: "POST",
    body,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });

// Reads (GET views)
export const getCatalog = (q: Partial<View<"catalog">> = {}) =>
  read<TrainingCatalogResponse>("catalog", q);
export const getCourse = (id: string) => read<TrainingCourseResponse>("course", { id });
export const getFavorites = () => read<TrainingFavoritesResponse>("favorites");
export const getMyRequests = () => read<TrainingRequestsResponse>("requests");
export const getMessages = (requestId: string) =>
  read<TrainingMessagesResponse>("messages", { requestId });
export const getInbox = (q: Partial<View<"inbox">> & { organizationId: string }) =>
  read<TrainingInboxResponse>("inbox", q);
export const getWorkspace = (organizationId: string) =>
  read<TrainingWorkspaceResponse>("workspace", { organizationId });
export const getReviewQueue = (q: Partial<View<"review-queue">> = {}) =>
  read<TrainingReviewQueueResponse>("review-queue", q);
/** The caller's confirmed sessions from 180 days back to 219 ahead (the RPC caps a read at 400 days). */
export const getMySessions = (now = Date.now()) =>
  read<TrainingSessionsResponse>("sessions", {
    from: new Date(now - 180 * 86_400_000).toISOString(),
    to: new Date(now + 219 * 86_400_000).toISOString(),
  });

// Writes (POST ops). Saves carry their own version; requests, transitions and messages need an Idempotency-Key.
type Input<O extends TrainingWrite["op"]> = Extract<TrainingWrite, { op: O }>["input"];
export const saveProvider = (input: Input<"provider">) =>
  write<TrainingSavedResponse>({ op: "provider", input });
export const saveCourse = (input: Input<"course">) =>
  write<TrainingSavedResponse>({ op: "course", input });
export const saveEdition = (input: Input<"edition">) =>
  write<TrainingSavedResponse>({ op: "edition", input });
export const listingAction = (input: Input<"listing">) =>
  write<TrainingSavedResponse>({ op: "listing", input });
export const review = (input: Input<"review">) =>
  write<TrainingSavedResponse>({ op: "review", input });
export const toggleFavorite = (input: Input<"favorite">) =>
  write<TrainingFavoriteResponse>({ op: "favorite", input });
export const createRequest = (input: Input<"request">, idempotencyKey: string) =>
  write<TrainingRequestResponse>({ op: "request", input }, idempotencyKey);
export const transition = (input: Input<"transition">, idempotencyKey: string) =>
  write<TrainingTransitionResponse>({ op: "transition", input }, idempotencyKey);
export const sendMessage = (input: Input<"message">, idempotencyKey: string) =>
  write<TrainingMessageResponse>({ op: "message", input }, idempotencyKey);
