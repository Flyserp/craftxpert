import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProviders from "./tools/search-providers";
import listOpenTasks from "./tools/list-tasks";
import listMyBookings from "./tools/list-my-bookings";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "taskhive-mcp",
  title: "TaskHive MCP",
  version: "0.1.0",
  instructions:
    "Tools for TaskHive: search vendor services, browse open tasks, and (when signed in) list your own bookings.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProviders, listOpenTasks, listMyBookings],
});